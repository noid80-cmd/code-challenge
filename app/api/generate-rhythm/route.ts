import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120

// All bars pre-verified: each = exactly 8 eighth-note units (4/4, L:1/8)
const BAR_PATTERNS: Record<string, string> = {
  // 기본 8분음표 패턴
  A: 'BB z2 BB z2',
  B: 'z2 BB z2 BB',
  C: 'B B/ B/ z B (3BBB z2',
  D: 'B/ B/ B z B (3BzB z2',
  E: 'B/ B B/ z B (3BBB z2',
  F: 'B>B z2 B>B z2',
  G: 'B>B (3BBB z B z2',
  H: 'B<B z B (3BBB z2',
  I: '(3BzB z B B B/ B/ z2',
  J: '(3B2B2B2 BB z2',
  K: '(3B2B2B2 z2 BB',
  L: '(3B2B2B2 z B B z',
  M: 'z4 B B/ B/ z B',
  N: 'z4 (3BBB z2',
  O: 'B/B/B/B/ z B (3BBB z2',
  // 16분쉼표(z/) 포함 패턴
  P: 'B z/ B/ z B (3BBB z2',
  Q: 'B/ B/ z z B (3BzB z2',
  R: 'z/ B/ B z B (3BBB z2',
  S: 'z B/ B/ z B (3BBB z2',
  T: 'B>B B/ B/ z z B z2',
  U: 'B>B z/ B/ B (3BzB z2',
  V: '(3B2B2B2 B B/B/B/B/ z',
  W: 'z4 B B/B/B/B/ z',
  X: 'z/ B/ B B/B/B/B/ z B z2',
  Y: 'z/ B/ B B z/ B/ (3BBB z2',
  Z: 'z/ B/ B B z/ B/ (3BzB z2',
  // 쿼터+8분음표 혼합 패턴 (무거운 비트)
  '4': 'B2 BB z2 BB',
  '5': 'BB B2 BB z2',
  // 점4분음표(B3) 패턴
  '6': 'B3 B B3 B',
  '7': 'z3 B B3 B',
  '8': 'B3 B BB B2',
  '9': 'z3 B BB B2',
  // 16분음표 연속(B/B/B/B/) 패턴
  '10': 'B/B/B/B/ B/B/B/B/ B2 B2',
  '11': 'B2 B/B/B/B/ B/B/B/B/ z2',
  '12': 'B/B/B/B/ z2 B/B/B/B/ B2',
  // 이중 3연음 패턴
  '13': '(3BBB (3BBB B2 z2',
  '14': '(3BBB (3BzB B2 z2',
  '15': 'z2 (3BBB (3BBB B2',
  '16': 'B2 (3BzB (3BBB z2',
  // 부점8분음표 연속 패턴
  '17': 'B>B B>B B>B z2',
  '18': 'z2 B>B B>B B>B',
  '19': 'B<B B<B B<B z2',
  // 16분쉼표 응용 패턴
  '20': 'z/ B/ B2 z/ B/ B2 z2',
  '21': 'z2 z/ B/ B2 z/ B/ B2',
  // 혼합 3연음 패턴
  '22': 'B2 z2 (3BBB (3BzB',
  '23': 'z4 (3BBB (3BzB',
  '24': '(3B2B2B2 (3BBB z2',
  // 3연음 쉼표 위치 변형 — (3zBB=쉼표 선두, (3BBz=쉼표 후미
  '25': '(3zBB (3BBz B2 z2',
  '26': 'z2 (3zBB (3BBz B2',
  '27': '(3zBB (3BzB (3BBz z2',
  '28': 'B2 (3zBB (3BzB z2',
  '29': '(3BBz z2 (3zBB B2',
  // 2박 3연음(쿼터 트리플렛) 쉼표 변형
  '30': '(3B2z2B2 BB z2',
  '31': '(3z2B2B2 BB z2',
  '32': '(3B2B2z2 BB z2',
  '33': 'z2 (3B2z2B2 BB',
  '34': 'z2 (3z2B2B2 BB',
  '35': '(3z2B2z2 BB BB',
  // 붓점 쉼표 패턴 — z>B=붓점쉼표+16분음, B<B=16분음+붓점
  '36': 'z>B B<B z>B B<B',
  '37': 'z>B z>B z>B z>B',
  '38': 'B<B z>B B<B z>B',
  '39': 'B<B z>B (3BBB z2',
  '40': 'z>B z>B (3BzB z2',
  // 16분음표 그룹 내부 쉼표 위치 변형
  '41': 'z/B/B/B/ z/B/B/B/ B2 z2',
  '42': 'B/B/z/B/ B/B/z/B/ B2 z2',
  '43': 'B/B/B/z/ B2 B/B/B/z/ z2',
  '44': 'z/B/z/B/ z2 (3BBB B2',
  // 6잇단음표(6연음) 패턴 — (6은 표준 ABC 기본 비율로 "2박자 길이에 6개" (1비트)
  '45': '(6BBBBBB BB z2 (3BBB',
  '46': 'BB (6BBBBBB z2 B2',
  '47': '(6BBBBBB B/B/B/B/ z2 (3BzB',
  '48': '(6BBBBBB (6BBBBBB BB z2',
}

// Bars that contain (3BzB — triplet with rest (syncopated feel)
const SYNCO_TRIPLET_BARS = new Set(['D', 'I', 'Q', 'U', 'Z', '14', '16', '22', '23', '27', '28', '40'])

// --- 박자 단위 재조립 ---
// AI가 고른 8개 마디를 그대로 쓰면 특정 위치(예: 2번째 마디)에 같은 마디가
// 여러 번 연속 생성에 걸쳐 반복되는 문제가 있었음. 각 마디를 박(2단위=1beat)
// 셀로 쪼갠 뒤 전체를 무작위로 섞어 재조립해서, 같은 8개 ID를 뽑아도 매번
// 다른 마디 구성이 나오게 한다. 붓점4분3연음/z4처럼 박 경계를 가로지르는
// 표기는 2beat(4단위)짜리 하나의 셀로 취급해 쪼개지 않는다.
type BeatCell = { tokens: string; slots: 1 | 2 }

function noteDur(sym: string): number {
  if (sym.endsWith('/')) return 0.5
  const m = sym.match(/\d+$/)
  if (m) return parseInt(m[0], 10)
  return 1
}

function tokenDuration(tok: string): number {
  if (tok.startsWith('(3')) {
    const inner = tok.slice(2)
    const notes = inner.match(/[Bz](?:\/|\d+)?/g) ?? []
    const sum = notes.reduce((s, n) => s + noteDur(n), 0)
    return sum * (2 / 3)
  }
  if (tok.startsWith('(6')) {
    const inner = tok.slice(2)
    const notes = inner.match(/[Bz](?:\/|\d+)?/g) ?? []
    const sum = notes.reduce((s, n) => s + noteDur(n), 0)
    return sum * (2 / 6)
  }
  if (tok.includes('>') || tok.includes('<')) return 2
  const notes = tok.match(/[Bz](?:\/|\d+)?/g) ?? []
  return notes.reduce((s, n) => s + noteDur(n), 0)
}

function splitIntoBeatCells(bar: string): BeatCell[] {
  const tokens = bar.trim().split(/\s+/)
  const cells: BeatCell[] = []
  let cur: string[] = []
  let curDur = 0
  for (const tok of tokens) {
    cur.push(tok)
    curDur += tokenDuration(tok)
    if (curDur % 2 === 0) {
      cells.push({ tokens: cur.join(' '), slots: (curDur / 2) as 1 | 2 })
      cur = []
      curDur = 0
    }
  }
  if (cur.length) cells.push({ tokens: cur.join(' '), slots: Math.max(1, Math.round(curDur / 2)) as 1 | 2 })
  return cells
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 8개 마디 텍스트를 박 단위로 분해 후 무작위 재조립. 실패(드문 bin-packing
// 막힘) 시 null을 반환해 호출부가 원래 순서로 폴백하게 한다.
function shuffleBeatsAcrossBars(barTexts: string[]): string[] | null {
  const allCells = barTexts.flatMap(splitIntoBeatCells)
  const numBars = barTexts.length
  for (let attempt = 0; attempt < 30; attempt++) {
    const pool = shuffleArray(allCells)
    const bars: string[][] = Array.from({ length: numBars }, () => [])
    const remaining: number[] = Array(numBars).fill(4)
    let ok = true
    for (const cell of pool) {
      const idx = remaining.findIndex(r => r >= cell.slots)
      if (idx === -1) { ok = false; break }
      bars[idx].push(cell.tokens)
      remaining[idx] -= cell.slots
    }
    if (ok && remaining.every(r => r === 0)) {
      return bars.map(tokens => tokens.join(' '))
    }
  }
  return null
}

// 마디 경계를 넘는 붙임줄(tie). 마디 끝 토큰이 쉼표가 아니고(음표로 끝남)
// 다음 마디 시작 토큰도 음표로 시작할 때만 '-'를 붙인다 — 쉼표를 타이로
// 잇는 건 불가능하므로 안전하게 스킵.
function addRandomTies(bars: string[]): string[] {
  const result = [...bars]
  for (let i = 0; i < result.length - 1; i++) {
    if (Math.random() >= 0.3) continue
    const lastToken = result[i].trim().split(/\s+/).pop() ?? ''
    const firstToken = result[i + 1].trim().split(/\s+/)[0] ?? ''
    if (/B$/.test(lastToken) && /^B/.test(firstToken)) {
      result[i] = result[i] + '-'
    }
  }
  return result
}

function assemblePatternsABC(
  aiPatterns: Array<{ label: string; bars: string[] }>
): Array<{ label: string; abc: string }> | null {
  const result: Array<{ label: string; abc: string }> = []
  for (const p of aiPatterns) {
    if (!Array.isArray(p.bars) || p.bars.length !== 8) {
      console.error(`[rhythm] bars.length=${p.bars?.length ?? 'missing'}`)
      return null
    }
    const barTexts: string[] = []
    for (const id of p.bars) {
      const barText = BAR_PATTERNS[String(id).toUpperCase()]
      if (!barText) {
        console.error(`[rhythm] unknown pattern ID: "${id}"`)
        return null
      }
      barTexts.push(barText)
    }
    // If the label suggests syncopation/off-beat theme, ensure at least 2 bars
    // use (3BzB (note-rest-note triplet) — prevents all-straight-triplet inconsistency
    const isSyncoLabel = /싱코|당김음|엇박|오프비트/i.test(String(p.label))
    if (isSyncoLabel) {
      const syncoCount = p.bars.filter(id => SYNCO_TRIPLET_BARS.has(String(id).toUpperCase())).length
      if (syncoCount < 2) {
        console.error(`[rhythm] synco pattern has only ${syncoCount} (3BzB bars — retrying`)
        return null
      }
    }
    const finalBars = addRandomTies(shuffleBeatsAcrossBars(barTexts) ?? barTexts)
    const abc =
      'X:1\nM:4/4\nL:1/8\nQ:1/4=100\nK:perc\nV:1 clef=none stafflines=1 stem=up\n|' +
      finalBars.join('|') + '|]'
    result.push({ label: String(p.label || `패턴 ${result.length + 1}`), abc })
  }
  return result.length >= 2 ? result : null
}

function buildPrompt(level: string, recentTitles: string[] = []) {
  const levelLabel = level === 'advanced' ? '고급' : '중급'
  const levelRule = level === 'advanced'
    ? '각 패턴에 복잡 패턴(P~Z, 10~12, 20~21, 36~44) 중 최소 4개 포함 (나머지는 A~O, 4~9, 13~19, 22~35). 45~48(6잇단음표)은 최대 1개까지만 선택적으로 포함 가능'
    : '각 패턴에 복잡 패턴(P~Z, 10~12, 20~21, 36~44) 중 2~3개 포함 (나머지는 A~O, 4~9, 13~19, 22~35). 45~48은 사용하지 않음'

  const recentBlock = recentTitles.length > 0
    ? `\n최근 사용한 제목 (절대 반복 금지):\n${recentTitles.map(t => `- ${t}`).join('\n')}\n`
    : ''

  return `드럼/리듬 초견 챌린지를 생성하세요. 서로 다른 리듬 테마의 패턴 2개를 포함합니다.${recentBlock}

난이도: ${levelLabel}

아래 마디 패턴 라이브러리에서 각 패턴에 대해 정확히 8개 마디 ID를 선택하세요.
각 패턴은 정확히 4박자입니다.

[기본 8분음표 패턴 A~O]
A: BB z2 BB z2
B: z2 BB z2 BB
C: B B/ B/ z B (3BBB z2
D: B/ B/ B z B (3BzB z2
E: B/ B B/ z B (3BBB z2
F: B>B z2 B>B z2
G: B>B (3BBB z B z2
H: B<B z B (3BBB z2
I: (3BzB z B B B/ B/ z2
J: (3B2B2B2 BB z2
K: (3B2B2B2 z2 BB
L: (3B2B2B2 z B B z
M: z4 B B/ B/ z B
N: z4 (3BBB z2
O: B/B/B/B/ z B (3BBB z2

[복잡: 16분쉼표(z/) 포함 패턴 P~Z]
P: B z/ B/ z B (3BBB z2
Q: B/ B/ z z B (3BzB z2
R: z/ B/ B z B (3BBB z2
S: z B/ B/ z B (3BBB z2
T: B>B B/ B/ z z B z2
U: B>B z/ B/ B (3BzB z2
V: (3B2B2B2 B B/B/B/B/ z
W: z4 B B/B/B/B/ z
X: z/ B/ B B/B/B/B/ z B z2
Y: z/ B/ B B z/ B/ (3BBB z2
Z: z/ B/ B B z/ B/ (3BzB z2

[쿼터+8분음표 혼합 패턴 4~5 — 무거운 비트감]
4: B2 BB z2 BB
5: BB B2 BB z2

[점4분음표(B3) 패턴 6~9]
6: B3 B B3 B
7: z3 B B3 B
8: B3 B BB B2
9: z3 B BB B2

[복잡: 16분음표 연속(B/B/B/B/) 패턴 10~12]
10: B/B/B/B/ B/B/B/B/ B2 B2
11: B2 B/B/B/B/ B/B/B/B/ z2
12: B/B/B/B/ z2 B/B/B/B/ B2

[이중 3연음 패턴 13~16]
13: (3BBB (3BBB B2 z2
14: (3BBB (3BzB B2 z2
15: z2 (3BBB (3BBB B2
16: B2 (3BzB (3BBB z2

[부점8분음표 연속 패턴 17~19]
17: B>B B>B B>B z2
18: z2 B>B B>B B>B
19: B<B B<B B<B z2

[복잡: 16분쉼표 응용 패턴 20~21]
20: z/ B/ B2 z/ B/ B2 z2
21: z2 z/ B/ B2 z/ B/ B2

[혼합 3연음 패턴 22~24]
22: B2 z2 (3BBB (3BzB
23: z4 (3BBB (3BzB
24: (3B2B2B2 (3BBB z2

[3연음 쉼표 위치 변형 25~29 — (3zBB=쉼표선두, (3BBz=쉼표후미]
25: (3zBB (3BBz B2 z2
26: z2 (3zBB (3BBz B2
27: (3zBB (3BzB (3BBz z2
28: B2 (3zBB (3BzB z2
29: (3BBz z2 (3zBB B2

[2박 3연음 쉼표 변형 30~35 — 쿼터 트리플렛 안에 쉼표]
30: (3B2z2B2 BB z2
31: (3z2B2B2 BB z2
32: (3B2B2z2 BB z2
33: z2 (3B2z2B2 BB
34: z2 (3z2B2B2 BB
35: (3z2B2z2 BB BB

[복잡: 붓점 쉼표 패턴 36~40 — z>B=붓점쉼표+16분음, B<B=16분음+붓점]
36: z>B B<B z>B B<B
37: z>B z>B z>B z>B
38: B<B z>B B<B z>B
39: B<B z>B (3BBB z2
40: z>B z>B (3BzB z2

[복잡: 16분음표 그룹 내 쉼표 위치 변형 41~44]
41: z/B/B/B/ z/B/B/B/ B2 z2
42: B/B/z/B/ B/B/z/B/ B2 z2
43: B/B/B/z/ B2 B/B/B/z/ z2
44: z/B/z/B/ z2 (3BBB B2

[매우 복잡: 6잇단음표(6연음) 패턴 45~48 — 고급 전용, 한 챌린지당 최대 1개]
45: (6BBBBBB BB z2 (3BBB
46: BB (6BBBBBB z2 B2
47: (6BBBBBB B/B/B/B/ z2 (3BzB
48: (6BBBBBB (6BBBBBB BB z2

규칙:
- ${levelRule}
- 두 패턴이 서로 다른 리듬 특성을 갖도록 조합 (예: 한 패턴은 붓점 쉼표, 다른 패턴은 16분음표 내부 쉼표)
- 같은 ID 최대 2번 반복 가능
- label은 악보에 나타나는 리듬 특성으로 지어야 함 (예: "당김음 중심", "16분음표 집중", "3연음 쉼표", "붓점 쉼표", "엇박 강조", "2박 트리플렛")
- label에 스윙·셔플·그루브·펑크 등 장르/주법 이름 사용 금지
- 싱코페이션·당김음·엇박 테마 패턴은 (3BzB 포함 bar(D·I·Q·U·Z·14·16·22·23·27·28·40) 최소 2개 이상 포함

JSON 객체로만 응답:
{
  "title": "챌린지 제목",
  "description": "간단한 설명 (1-2문장)",
  "level": "${level}",
  "patterns": [
    {"label": "붓점 쉼표", "bars": ["36", "38", "39", "F", "37", "40", "G", "17"]},
    {"label": "3연음 쉼표 변형", "bars": ["25", "27", "28", "J", "29", "26", "30", "33"]}
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

  // Fetch recent rhythm challenge titles to avoid duplicates
  let recentTitles: string[] = []
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/challenges?date=gte.${sevenDaysAgo}&select=title,chords`,
      { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' } }
    )
    const rows: Array<{ title: string; chords: { patterns?: unknown[] } }> = await res.json()
    recentTitles = rows
      .filter(r => Array.isArray(r.chords?.patterns))
      .map(r => r.title)
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
      if (!jsonStr) { console.error(`[generate-rhythm] attempt ${attempt}: no JSON`); continue }
      let parsed
      try { parsed = JSON.parse(jsonStr) } catch { continue }

      const assembled = assemblePatternsABC(parsed.patterns ?? [])
      if (!assembled) { console.error(`[generate-rhythm] attempt ${attempt}: assembly failed`); continue }

      const newTitle = String(parsed.title || '드럼 초견 챌린지')
      if (recentTitles.includes(newTitle)) {
        console.error(`[generate-rhythm] attempt ${attempt}: duplicate title "${newTitle}" — retrying`)
        continue
      }

      challenge = {
        title: newTitle,
        description: String(parsed.description || ''),
        level,
        patterns: assembled,
      }
      console.log(`[generate-rhythm] success attempt=${attempt} level=${level}`)
      break
    }

    if (!challenge) {
      return NextResponse.json({ error: '리듬 생성 실패. 다시 시도해주세요.' }, { status: 500 })
    }

    return NextResponse.json({ challenge })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '생성 실패' }, { status: 500 })
  }
}
