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
  // 쉼표 포함 (단순 휴지)
  '5': 'C2 z2 E2 D2',
  '6': 'z2 G2 E2 C2',
  '7': 'G2 F2 z2 C2',
  '10': 'C2 G2 z2 E2',
  // 당김음 — 붙임줄/오프비트 쉼표로 박자 경계를 넘겨 진짜 싱코페이션을 만듦
  // (점음표로 대체 가능한 박자정렬 붙임줄은 의미가 없어서 제외)
  '8': 'C2 D E-E2 D2',
  '9': 'D C-C2 E2 D2',
  '11': 'z C D2 E2 D2',
  // 16분음표 추가 패턴
  '12': 'G2 F2 G/F/E/D/ C2',
  '13': 'C/D/E/F/ G2 c2 G2',
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
    ? '각 프레이즈에 도약 패턴(E,F,G,H,P,Q,R,S,T,1,2,3,4) 중 최소 5개(이 중 4도 이상 큰 도약 1~4 중 최소 2개 포함), 반음 패턴(U,V,W) 중 최소 1개, 리듬 심화 패턴(X,Y,Z,12,13) 중 최소 1개, 당김음 패턴(8,9,11) 중 최소 1개 포함. 이웃음 진행 패턴(A,B,C,D)은 프레이즈당 최대 1개로 제한'
    : '각 프레이즈에 도약 패턴(E,F,G,H,P,Q,R,S,T,1,2,3,4) 중 최소 4개(이 중 4도 이상 큰 도약 1~4 중 최소 1개 포함), 반음 패턴(U,V,W) 중 최소 1개, 리듬 심화 패턴(X,Y,Z,12,13) 중 최소 1개, 당김음 패턴(8,9,11) 중 최소 1개 포함. 쉼표 패턴(5,6,7,10)은 선택적으로 사용. 이웃음 진행 패턴(A,B,C,D)은 프레이즈당 최대 2개로 제한'

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

[쉼표 포함 5~7, 10 — 단순 휴지, 선택적]
5: C2 z2 E2 D2 (도-쉼표-미-레)
6: z2 G2 E2 C2 (쉼표-솔-미-도)
7: G2 F2 z2 C2 (솔-파-쉼표-도)
10: C2 G2 z2 E2 (도-솔-쉼표-미)

[당김음 8, 9, 11 — 붙임줄/쉼표로 박자 경계를 넘겨 진짜 싱코페이션을 만듦]
8: C2 D E-E2 D2 (미가 박자 경계를 붙임줄로 넘어감)
9: D C-C2 E2 D2 (도가 박자 경계를 붙임줄로 넘어감)
11: z C D2 E2 D2 (쉼표 후 오프비트로 진입)

규칙:
- ${levelRule}
- 두 프레이즈가 서로 다른 멜로디 특성을 갖도록 조합 (예: 한 프레이즈는 순차+반음 중심, 다른 프레이즈는 큰 도약+리듬 심화 중심)
- 같은 ID 최대 2번 반복 가능
- 같은 마디를 3개 이상 연속으로 이어붙여 단조로운 음계처럼 들리지 않게 할 것
- label은 악보에 나타나는 멜로디 특성으로 지어야 함 (예: "큰 도약", "아르페지오", "턴 피겨", "반음 경과음", "붓점·셋잇단음표", "당김음")
- label에 장르/주법 이름 사용 금지

JSON 객체로만 응답:
{
  "title": "챌린지 제목",
  "description": "간단한 설명 (1-2문장)",
  "level": "${level}",
  "patterns": [
    {"label": "큰 도약·반음 경과음", "bars": ["1", "E", "F", "U", "G", "8", "A", "X"]},
    {"label": "아르페지오·리듬 심화", "bars": ["2", "H", "P", "V", "Q", "Y", "9", "J"]}
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
    for (let attempt = 1; attempt <= 5; attempt++) {
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

      const assembled = assemblePatternsABC(parsed.patterns ?? [])
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
