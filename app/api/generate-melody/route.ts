import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120

// All bars pre-verified: each = exactly 8 eighth-note units (4/4, L:1/8)
// C major only, one octave range (C4~C5) — pitch-reading focus, rhythm kept simple.
// Every bar changes direction at least once (no monotonic full-bar runs) so
// concatenated bars read as a melody, not a scale drill. Eighth notes are always
// written in beat-sized pairs ("CD EF", not "CDEF") so abcjs beams per beat.
const BAR_PATTERNS: Record<string, string> = {
  // 이웃음 중심 진행 (4분음표, 방향 전환 포함)
  A: 'C2 D2 E2 D2',
  B: 'E2 D2 C2 D2',
  C: 'G2 A2 G2 F2',
  D: 'E2 F2 G2 F2',
  // 스킵+스텝 혼합
  E: 'C2 E2 D2 C2',
  F: 'G2 E2 F2 D2',
  // 아르페지오 (한 옥타브)
  G: 'C2 E2 G2 c2',
  H: 'c2 G2 E2 C2',
  // 긴 음 + 스텝 조합 (2분음표)
  I: 'C4 D2 E2',
  J: 'E4 D2 C2',
  K: 'G4 F2 E2',
  L: 'C2 D2 E4',
  M: 'G2 F2 E4',
  N: 'G2 B2 c2 G2',
  O: 'G4 E2 C2',
  // 꾸밈/턴 피겨 (8분음표, 박자 단위로 묶임)
  P: 'CD ED C2 D2',
  Q: 'GF EF G2 F2',
  R: 'EF GF E2 D2',
  S: 'DC DE C4',
  T: 'FE FG E4',
  // 반음(임시표) — 순간적인 크로매틱 경과음/이웃음
  U: 'C2 ^C2 D2 E2',
  V: 'E2 _E2 D2 C2',
  W: 'F2 ^F2 G2 A2',
  // 리듬 심화 — 붓점, 셋잇단음표, 16분음표
  X: 'C>D E>F G2 F2',
  Y: '(3CDE F2 G2 F2',
  Z: 'C/D/E/F/ G2 F2 E2',
  // 큰 도약 (4도 이상)
  '1': 'C2 F2 D2 G2',
  '2': 'G2 C2 E2 A2',
  '3': 'C2 A2 F2 D2',
  '4': 'E2 c2 G2 C2',
  // 쉼표 포함 (8분/4분/2분쉼표 다양하게, 8분·16분음표 밀도 높임)
  // 모든 마디는 박자 경계(0,2,4,6)에 맞춰 정렬 — 붙임줄 없이 박자를 넘어가는 긴 음표 금지
  '5': 'z C DE D2 C2',
  '6': 'z2 GF ED C2',
  '7': 'z4 C/D/E/F/ G2',
  '10': 'C2 z2 E/F/G/A/ D2',
  // 당김음 — 붙임줄/오프비트 쉼표로 박자 경계를 넘겨 진짜 싱코페이션을 만듦
  // (점음표로 대체 가능한 박자정렬 붙임줄은 의미가 없어서 제외)
  // 4개가 서로 다른 리듬 모양이 되도록 설계 — 짧은 당김음/긴 당김음/쉼표형/도약+당김음
  '8': 'C2 D E2 F D2',
  '9': 'C2 D E4 D',
  '11': 'z C D2 E2 D2',
  '14': 'C2 G2 E F2 D',
  // 16분음표 추가 패턴
  '12': 'G2 F2 G/F/E/D/ C2',
  '13': 'C/D/E/F/ G2 c2 G2',
  // 복합 패턴 — 리듬 심화·당김음·쉼표·도약을 한 마디 안에 두 개 이상 겹쳐서
  // 훨씬 밀도 높은 마디를 만듦 (매일 비슷하게 들리는 문제의 핵심 해결책)
  '15': 'z2 (3CDE G2 F2',
  '16': 'C>D E2 D3 C',
  '17': '(3CDE z2 F2 E2',
  '18': 'G2 C/D/E/F/ E3 D',
  '19': 'z2 C>D E2 D2',
  '20': 'C2 G3 z F/E/D/C/',
  '21': 'C2 G- G4 F',
  '22': 'E2 c2 (3GFE D2',
  // 2:1:1 리듬(8분+16분+16분) — 한 박 안에서 8분음표의 위치를 앞/중간/뒤로 바꾼 3종
  '23': 'C D/E/ F2 D2 C2',
  '24': 'C/DE/ G2 F2 D2',
  '25': 'C/D/E G2 E2 C2',
  // 마디를 넘어가는 붙임줄 — 반드시 26 바로 다음에 27이 와야 하는 짝 패턴
  // (26의 마지막 음이 27의 첫 음으로 그대로 이어짐)
  '26': 'C2 D2 E2 G2-',
  '27': 'G4 F2 E2',
  // 점4분음표+8분음표
  '28': 'C2>D2 E2 F2',
  '29': 'G2>F2 E2 C2',
}

// 카테고리 소속 — 복합 패턴은 여러 카테고리에 동시에 속해서, 8마디 예산 안에서도
// 더 많은 난이도 요소를 동시에 채울 수 있게 함
const CATEGORY = {
  neighbor: ['A', 'B', 'C', 'D'],
  leap: ['E', 'F', 'G', 'H', 'P', 'Q', 'R', 'S', 'T', '1', '2', '3', '4', '18', '20', '21', '22'],
  bigLeap: ['1', '2', '3', '4', '20', '21', '22'],
  chromatic: ['U', 'V', 'W'],
  rhythm: ['X', 'Y', 'Z', '12', '13', '15', '16', '17', '18', '19', '20', '22', '23', '24', '25', '26', '27', '28', '29'],
  syncopation: ['8', '9', '11', '14', '21', '26', '27'],
  rest: ['5', '6', '7', '10', '15', '17', '19', '20'],
} as const

// 26은 반드시 바로 다음에 27이 와야 하고, 27은 반드시 26 바로 다음에만 올 수 있음
function validatePairing(bars: string[]): string | null {
  for (let i = 0; i < bars.length; i++) {
    if (bars[i] === '26' && bars[i + 1] !== '27') return `"26" must be immediately followed by "27" (at index ${i})`
    if (bars[i] === '27' && bars[i - 1] !== '26') return `"27" must be immediately preceded by "26" (at index ${i})`
  }
  return null
}

function countCategory(bars: string[], ids: readonly string[]) {
  return bars.filter(b => (ids as readonly string[]).includes(b)).length
}

// 개별 프레이즈: 모양(8마디, 알려진 ID, 반복 최대 2회)만 검증
function validatePhraseShape(bars: string[]): string | null {
  if (bars.length !== 8) return `bars.length=${bars.length}`
  for (const id of bars) {
    if (!BAR_PATTERNS[id]) return `unknown id "${id}"`
  }
  const counts: Record<string, number> = {}
  for (const id of bars) counts[id] = (counts[id] ?? 0) + 1
  for (const [id, c] of Object.entries(counts)) {
    if (c > 2) return `id "${id}" repeated ${c} times (max 2)`
  }
  const pairingErr = validatePairing(bars)
  if (pairingErr) return pairingErr
  return null
}

// 카테고리 최소 개수는 "두 프레이즈 합산" 기준으로 검증한다.
// 한 프레이즈는 도약 중심, 다른 프레이즈는 반음 중심처럼 서로 다른 특성을
// 갖도록 유도하면서, 두 프레이즈 각각에 모든 카테고리를 강제하면
// (예: 도약 중심 프레이즈에도 반음을 억지로 넣어야 함) 모순이 생겨
// AI가 계속 실패하게 됨.
function validateCombined(allBars: string[], level: string): string | null {
  const neighborCap = level === 'advanced' ? 2 : 4
  const need = level === 'advanced'
    ? { leap: 5, bigLeap: 3, chromatic: 1, rhythm: 5, syncopation: 2, rest: 2 }
    : { leap: 4, bigLeap: 2, chromatic: 1, rhythm: 5, syncopation: 2, rest: 2 }

  if (countCategory(allBars, CATEGORY.neighbor) > neighborCap) return `neighbor count exceeds cap ${neighborCap}`
  if (countCategory(allBars, CATEGORY.leap) < need.leap) return `leap count < ${need.leap}`
  if (countCategory(allBars, CATEGORY.bigLeap) < need.bigLeap) return `bigLeap count < ${need.bigLeap}`
  if (countCategory(allBars, CATEGORY.chromatic) < need.chromatic) return `chromatic count < ${need.chromatic}`
  if (countCategory(allBars, CATEGORY.rhythm) < need.rhythm) return `rhythm count < ${need.rhythm}`
  if (countCategory(allBars, CATEGORY.syncopation) < need.syncopation) return `syncopation count < ${need.syncopation}`
  if (countCategory(allBars, CATEGORY.rest) < need.rest) return `rest count < ${need.rest}`
  return null
}

function assemblePatternsABC(
  aiPatterns: Array<{ label: string; bars: string[] }>
): Array<{ label: string; abc: string }> | null {
  const result: Array<{ label: string; abc: string }> = []
  for (const p of aiPatterns) {
    if (!Array.isArray(p.bars) || p.bars.length !== 8) {
      console.error(`[melody] bars.length=${p.bars?.length ?? 'missing'}`)
      return null
    }
    const barTexts: string[] = []
    for (const id of p.bars) {
      const barText = BAR_PATTERNS[String(id).toUpperCase()]
      if (!barText) {
        console.error(`[melody] unknown pattern ID: "${id}"`)
        return null
      }
      barTexts.push(barText)
    }
    const abc =
      'X:1\nM:4/4\nL:1/8\nQ:1/4=100\nK:C\nV:1 clef=treble\n|' +
      barTexts.join('|') + '|]'
    result.push({ label: String(p.label || `프레이즈 ${result.length + 1}`), abc })
  }
  return result.length >= 2 ? result : null
}

function buildPrompt(level: string, recentTitles: string[] = []) {
  const levelLabel = level === 'advanced' ? '고급' : '중급'
  const levelRule = level === 'advanced'
    ? '두 프레이즈를 합쳐(총 16마디) 도약 패턴(도약 카테고리 전체) 최소 5개(이 중 4도 이상 큰 도약 최소 3개 포함), 반음 패턴(U,V,W) 최소 1개, 리듬 심화 패턴(리듬 카테고리 전체) 최소 5개, 당김음 패턴(당김음 카테고리 전체) 최소 2개, 쉼표 패턴(쉼표 카테고리 전체) 최소 2개 포함. 두 프레이즈에 균등하게 나눌 필요 없이 한쪽에 몰아도 됨 (예: 도약 중심 프레이즈 + 반음·당김음 중심 프레이즈). 복합 패턴(15~22)은 여러 카테고리에 동시에 속하므로 적극 활용할 것. 이웃음 진행 패턴(A,B,C,D)은 두 프레이즈 합쳐 최대 2개로 제한'
    : '두 프레이즈를 합쳐(총 16마디) 도약 패턴(도약 카테고리 전체) 최소 4개(이 중 4도 이상 큰 도약 최소 2개 포함), 반음 패턴(U,V,W) 최소 1개, 리듬 심화 패턴(리듬 카테고리 전체) 최소 5개, 당김음 패턴(당김음 카테고리 전체) 최소 2개, 쉼표 패턴(쉼표 카테고리 전체) 최소 2개 포함. 두 프레이즈에 균등하게 나눌 필요 없이 한쪽에 몰아도 됨 (예: 도약 중심 프레이즈 + 반음·당김음 중심 프레이즈). 복합 패턴(15~22)은 여러 카테고리에 동시에 속하므로 적극 활용할 것. 이웃음 진행 패턴(A,B,C,D)은 두 프레이즈 합쳐 최대 4개로 제한'

  const recentBlock = recentTitles.length > 0
    ? `\n최근 사용한 제목 (절대 반복 금지):\n${recentTitles.map(t => `- ${t}`).join('\n')}\n`
    : ''

  return `계이름 시창(멜로디 초견) 챌린지를 생성하세요. 서로 다른 멜로디 특징을 가진 프레이즈 2개를 포함합니다.${recentBlock}

난이도: ${levelLabel}
조성: C장조 고정 (계이름 도-레-미-파-솔-라-시-도 읽기 연습)

아래 마디 패턴 라이브러리에서 각 프레이즈에 대해 정확히 8개 마디 ID를 선택하세요.
각 마디는 정확히 4박자입니다.

[이웃음 중심 진행 A~D — 4분음표, 방향 전환 포함]
A: C2 D2 E2 D2 (상행 후 한 음 되돌아옴)
B: E2 D2 C2 D2 (하행 후 한 음 되돌아옴)
C: G2 A2 G2 F2 (위아래 왕복 후 하행)
D: E2 F2 G2 F2 (상행 후 한 음 되돌아옴)

[스킵+스텝 혼합 E~F]
E: C2 E2 D2 C2 (스킵 후 스텝으로 정리)
F: G2 E2 F2 D2 (스킵다운 후 스텝 혼합)

[아르페지오 G~H]
G: C2 E2 G2 c2 (도미솔도 상행)
H: c2 G2 E2 C2 (도솔미도 하행)

[긴 음 + 스텝 조합 I~O — 2분음표]
I: C4 D2 E2 (도- 레미)
J: E4 D2 C2 (미- 레도)
K: G4 F2 E2 (솔- 파미)
L: C2 D2 E4 (도레 -미)
M: G2 F2 E4 (솔파 -미)
N: G2 B2 c2 G2 (솔시도솔 — 이끔음 해결)
O: G4 E2 C2 (솔- 미도)

[꾸밈/턴 피겨 P~T — 8분음표, 박자 단위로 묶임]
P: CD ED C2 D2
Q: GF EF G2 F2
R: EF GF E2 D2
S: DC DE C4
T: FE FG E4

[반음(임시표) U~W — 크로매틱 경과음/이웃음]
U: C2 ^C2 D2 E2 (도-도#-레-미, 상행 경과음)
V: E2 _E2 D2 C2 (미-미♭-레-도, 하행 경과음)
W: F2 ^F2 G2 A2 (파-파#-솔-라, 상행 경과음)

[리듬 심화 X~Z, 12~13 — 붓점·셋잇단음표·16분음표]
X: C>D E>F G2 F2 (붓점 리듬)
Y: (3CDE F2 G2 F2 (셋잇단음표)
Z: C/D/E/F/ G2 F2 E2 (16분음표 상행 런)
12: G2 F2 G/F/E/D/ C2 (16분음표 하행 런)
13: C/D/E/F/ G2 c2 G2 (16분음표 런 + 도약 결합)

[큰 도약 1~4 — 4도 이상]
1: C2 F2 D2 G2 (도-파-레-솔, 4도 도약 위주)
2: G2 C2 E2 A2 (솔-도-미-라, 5도+3도+4도 도약)
3: C2 A2 F2 D2 (도-라-파-레, 6도 도약 후 하행)
4: E2 c2 G2 C2 (미-도(옥타브위)-솔-도, 6도 도약)

[쉼표 포함 5~7, 10 — 8분/4분/2분쉼표를 다양하게, 8분·16분음표와 함께, 모두 박자 경계에 정렬]
5: z C DE D2 C2 (8분쉼표+8분음표로 1박 채움, 이후 박자별로 정렬)
6: z2 GF ED C2 (4분쉼표 + 연속 8분음표)
7: z4 C/D/E/F/ G2 (2분쉼표 + 16분음표 런)
10: C2 z2 E/F/G/A/ D2 (도-4분쉼표-16분음표런-레, 쉼표가 중간 박자에 위치)

[당김음 8, 9, 11, 14 — 붙임줄/쉼표로 박자 경계를 넘겨 진짜 싱코페이션을 만듦. 4개가 서로 다른 리듬 모양]
8: C2 D E2 F D2 (짧은 당김음: 미가 붙임줄 없이 오프비트에서 바로 4분음표로 시작)
9: C2 D E4 D (긴 당김음: 미가 붙임줄 없이 오프비트에서 바로 2분음표로 시작, 2박 지속)
11: z C D2 E2 D2 (쉼표 후 오프비트로 진입)
14: C2 G2 E F2 D (도약 후 당김음: 파가 붙임줄 없이 오프비트에서 바로 4분음표로 시작)

[복합 패턴 15~22 — 리듬 심화·당김음·쉼표·도약 중 두 개 이상을 한 마디 안에 겹쳐서
매일 비슷한 조합처럼 들리지 않게 밀도를 높인 마디. 반드시 여러 개 섞어 쓸 것]
15: z2 (3CDE G2 F2 (4분쉼표 + 셋잇단음표)
16: C>D E2 D3 C (붓점 + 점4분음표)
17: (3CDE z2 F2 E2 (셋잇단음표 + 4분쉼표)
18: G2 C/D/E/F/ E3 D (도약 + 16분음표 런 + 점4분음표)
19: z2 C>D E2 D2 (4분쉼표 + 붓점)
20: C2 G3 z F/E/D/C/ (도약 + 점4분음표 + 쉼표 + 16분음표 런)
21: C2 G- G4 F (도약 + 긴 당김음: 솔이 5박 길이라 단일 음표로 못 쓰고 붙임줄로 표기)
22: E2 c2 (3GFE D2 (6도 도약 + 셋잇단음표)

[2:1:1 리듬 23~25 — 한 박(8분음표+16분음표+16분음표, 2:1:1 길이 비율) 안에서
8분음표의 위치를 앞/중간/뒤로 바꾼 3가지 유형]
23: C D/E/ F2 D2 C2 (8분음표가 앞: 8분+16분+16분)
24: C/DE/ G2 F2 D2 (8분음표가 중간: 16분+8분+16분)
25: C/D/E G2 E2 C2 (8분음표가 뒤: 16분+16분+8분)

[마디를 넘어가는 붙임줄 26~27 — 반드시 짝으로만 사용. 26 바로 다음 마디에
27이 와야 하고, 27은 26 없이 단독으로 쓸 수 없음. 26의 마지막 음(솔)이
마디선을 넘어 27의 첫 음(솔)으로 그대로 이어짐]
26: C2 D2 E2 G2- (반드시 27 바로 앞에 위치, 마지막 솔이 다음 마디로 붙임줄)
27: G4 F2 E2 (반드시 26 바로 다음에 위치, 붙임줄로 이어받은 솔이 2박 지속)

[점4분음표+8분음표 28~29 — 붙임줄이 아니라 온전한 점음표로 표기한 리듬]
28: C2>D2 E2 F2 (점4분음표+8분음표, 상행)
29: G2>F2 E2 C2 (점4분음표+8분음표, 하행 후 도약)

[카테고리 소속 — 위 마디들이 실제로 어느 카테고리에 속하는지. 복합 패턴은 여러 칸에 동시에 포함됨]
도약: E,F,G,H,P,Q,R,S,T,1,2,3,4,18,20,21,22 (이 중 4도 이상 큰 도약: 1,2,3,4,20,21,22)
리듬 심화: X,Y,Z,12,13,15,16,17,18,19,20,22,23,24,25,26,27,28,29
당김음: 8,9,11,14,21,26,27
쉼표: 5,6,7,10,15,17,19,20

규칙:
- ${levelRule}
- 두 프레이즈가 서로 다른 멜로디 특성을 갖도록 조합 (예: 한 프레이즈는 반음+당김음 중심, 다른 프레이즈는 큰 도약+리듬 심화 중심 — 카테고리 최소 개수는 두 프레이즈 합산 기준이므로 이렇게 나눠 담아도 됨)
- 같은 ID 최대 2번 반복 가능
- 같은 마디를 3개 이상 연속으로 이어붙여 단조로운 음계처럼 들리지 않게 할 것
- 당김음 패턴은 8,9,11,14 중 매번 다른 걸 골라 같은 리듬 모양이 반복되지 않게 할 것
- 26을 쓸 때는 반드시 bars 배열에서 26 바로 다음 자리에 27을 넣을 것 (26만 쓰거나 27만 쓰는 것은 금지)
- 23, 24, 25(2:1:1 리듬)와 26+27(마디를 넘는 붙임줄)은 리듬 심화 카테고리에 속하는 선택지이니 적당히 섞어 쓸 것 (매번 강제로 넣을 필요는 없음)
- label은 악보에 나타나는 멜로디 특성으로 지어야 함 (예: "큰 도약", "아르페지오", "턴 피겨", "반음 경과음", "붓점·셋잇단음표", "당김음", "마디를 넘는 붙임줄")
- label에 장르/주법 이름 사용 금지
- 카테고리별 최소 개수를 채우고 나면 마디가 정확히 8개로 꽉 차므로, 4분음표만 있는 이웃음/아르페지오 마디로 여백을 채우지 말고 위 최소 조건을 그대로 지킬 것

JSON 객체로만 응답:
{
  "title": "챌린지 제목",
  "description": "간단한 설명 (1-2문장)",
  "level": "${level}",
  "patterns": [
    {"label": "마디를 넘는 붙임줄·복합 리듬", "bars": ["26", "27", "18", "U", "17", "15", "2", "1"]},
    {"label": "당김음·도약", "bars": ["21", "17", "V", "1", "H", "P", "16", "6"]}
  ]
}`
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY가 없어요.' }, { status: 500 })
  }
  const level = Math.random() < 0.7 ? 'intermediate' : 'advanced'

  // Fetch recent melody challenge titles to avoid duplicates
  let recentTitles: string[] = []
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/challenges?date=gte.${sevenDaysAgo}&type=eq.melody&select=title`,
      { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' } }
    )
    const rows: Array<{ title: string }> = await res.json()
    recentTitles = rows.map(r => r.title)
  } catch { /* non-critical */ }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    let challenge = null
    for (let attempt = 1; attempt <= 10; attempt++) {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: 'You are a JSON generator. Output only a valid JSON object. No explanations, no reasoning text, no markdown. Start your response directly with { and end with }.',
        messages: [{ role: 'user', content: buildPrompt(level, recentTitles) }],
      })
      const text = message.content[0].type === 'text' ? message.content[0].text : ''
      const jsonStr = extractJsonObject(text)
      if (!jsonStr) { console.error(`[generate-melody] attempt ${attempt}: no JSON`); continue }
      let parsed
      try { parsed = JSON.parse(jsonStr) } catch { continue }

      const rawPatterns: Array<{ label: string; bars: string[] }> = (parsed.patterns ?? [])
        .map((p: { label: string; bars: string[] }) => ({ label: p.label, bars: (p.bars ?? []).map(String) }))
      let ruleBroken: string | null = null
      for (const p of rawPatterns) {
        const err = validatePhraseShape(p.bars)
        if (err) { ruleBroken = err; break }
      }
      if (!ruleBroken) {
        const combined = rawPatterns.flatMap(p => p.bars)
        ruleBroken = validateCombined(combined, level)
      }
      if (ruleBroken) { console.error(`[generate-melody] attempt ${attempt}: rule violation — ${ruleBroken}`); continue }

      const assembled = assemblePatternsABC(rawPatterns)
      if (!assembled) { console.error(`[generate-melody] attempt ${attempt}: assembly failed`); continue }

      const newTitle = String(parsed.title || '계이름 시창 챌린지')
      if (recentTitles.includes(newTitle)) {
        console.error(`[generate-melody] attempt ${attempt}: duplicate title "${newTitle}" — retrying`)
        continue
      }

      challenge = {
        title: newTitle,
        description: String(parsed.description || ''),
        level,
        patterns: assembled,
      }
      console.log(`[generate-melody] success attempt=${attempt} level=${level}`)
      break
    }

    if (!challenge) {
      return NextResponse.json({ error: '멜로디 생성 실패. 다시 시도해주세요.' }, { status: 500 })
    }

    return NextResponse.json({ challenge })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '생성 실패' }, { status: 500 })
  }
}
