import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120

// All bars pre-verified: each = exactly 8 eighth-note units (4/4, L:1/8)
// C major only, one octave range (C4~C5) — pitch-reading focus, rhythm kept simple
const BAR_PATTERNS: Record<string, string> = {
  // 순차 진행 (4분음표)
  A: 'C2 D2 E2 F2',
  B: 'F2 E2 D2 C2',
  C: 'G2 A2 B2 c2',
  D: 'c2 B2 A2 G2',
  // 순차 진행 (8분음표, 한 옥타브 스케일)
  E: 'CDEFGABc',
  F: 'cBAGFEDC',
  // 3도 도약 아르페지오
  G: 'C2 E2 G2 c2',
  H: 'c2 G2 E2 C2',
  // 긴 음 (2분음표) 도약
  I: 'C4 E4',
  J: 'E4 C4',
  K: 'G4 C4',
  L: 'C4 D4',
  // 상행 후 되돌아오기
  M: 'CDEF E2 D2',
  N: 'G2 A2 G2 F2',
  O: 'E2 D2 E2 F2',
  // 도약+스텝 혼합
  P: 'C2 E2 D2 F2',
  Q: 'G2 E2 F2 D2',
  // 제자리 왕복
  R: 'CDED C2 D2',
  S: 'GFEF G2 F2',
  // 반복 도약
  T: 'C2 G2 c2 G2',
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
    ? '각 프레이즈에 도약 패턴(G,H,I,J,K,L,P,Q,T) 중 최소 4개 포함 (나머지는 순차 진행 위주 패턴)'
    : '각 프레이즈에 도약 패턴(G,H,I,J,K,L,P,Q,T) 중 1~2개 포함 (나머지는 순차 진행 위주 패턴)'

  const recentBlock = recentTitles.length > 0
    ? `\n최근 사용한 제목 (절대 반복 금지):\n${recentTitles.map(t => `- ${t}`).join('\n')}\n`
    : ''

  return `계이름 시창(멜로디 초견) 챌린지를 생성하세요. 서로 다른 멜로디 특징을 가진 프레이즈 2개를 포함합니다.${recentBlock}

난이도: ${levelLabel}
조성: C장조 고정 (계이름 도-레-미-파-솔-라-시-도 읽기 연습)

아래 마디 패턴 라이브러리에서 각 프레이즈에 대해 정확히 8개 마디 ID를 선택하세요.
각 마디는 정확히 4박자입니다.

[순차 진행 A~D — 4분음표]
A: C2 D2 E2 F2 (도레미파 상행)
B: F2 E2 D2 C2 (파미레도 하행)
C: G2 A2 B2 c2 (솔라시도 상행)
D: c2 B2 A2 G2 (도시라솔 하행)

[순차 진행 E~F — 한 옥타브 스케일, 8분음표]
E: CDEFGABc (도레미파솔라시도 상행)
F: cBAGFEDC (도시라솔파미레도 하행)

[3도 도약 아르페지오 G~H]
G: C2 E2 G2 c2 (도미솔도 상행)
H: c2 G2 E2 C2 (도솔미도 하행)

[긴 음 도약 I~L — 2분음표]
I: C4 E4 (도-미)
J: E4 C4 (미-도)
K: G4 C4 (솔-도)
L: C4 D4 (도-레)

[상행 후 되돌아오기 M~O]
M: CDEF E2 D2
N: G2 A2 G2 F2 (이웃음 왕복)
O: E2 D2 E2 F2 (이웃음+상행)

[도약+스텝 혼합 P~Q]
P: C2 E2 D2 F2
Q: G2 E2 F2 D2

[제자리 왕복 R~S]
R: CDED C2 D2
S: GFEF G2 F2

[반복 도약 T]
T: C2 G2 c2 G2 (도솔도솔)

규칙:
- ${levelRule}
- 두 프레이즈가 서로 다른 멜로디 특성을 갖도록 조합 (예: 한 프레이즈는 순차 진행 중심, 다른 프레이즈는 도약 중심)
- 같은 ID 최대 2번 반복 가능
- label은 악보에 나타나는 멜로디 특성으로 지어야 함 (예: "순차 상행", "3도 도약", "아르페지오", "이웃음 왕복")
- label에 장르/주법 이름 사용 금지

JSON 객체로만 응답:
{
  "title": "챌린지 제목",
  "description": "간단한 설명 (1-2문장)",
  "level": "${level}",
  "patterns": [
    {"label": "순차 상행", "bars": ["A", "C", "E", "M", "B", "D", "F", "O"]},
    {"label": "3도 도약", "bars": ["G", "H", "I", "P", "T", "J", "Q", "K"]}
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
