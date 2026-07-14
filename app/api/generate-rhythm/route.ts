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
  P: 'B B/ z/ z B (3BBB z2',
  Q: 'B/ z/ B z B (3BzB z2',
  R: 'z/ B/ B z B (3BBB z2',
  S: 'z B/ z/ z B (3BBB z2',
  T: 'B>B B/ z/ B z B z2',
  U: 'B>B z/ B/ B (3BzB z2',
  V: '(3B2B2B2 B B/ z/ B/ z/ B',
  W: 'z4 B B/ z/ B/ z/ B',
  X: 'B B/ z/ B/ z/ B z B z2',
  Y: 'z/ B/ B B B/ z/ (3BBB z2',
  Z: 'B/ z/ B B B/ z/ (3BzB z2',
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
  '20': 'B/ z/ B2 B/ z/ B2 z2',
  '21': 'z2 B/ z/ B2 B/ z/ B2',
  // 혼합 3연음 패턴
  '22': 'B2 z2 (3BBB (3BzB',
  '23': 'z4 (3BBB (3BzB',
  '24': '(3B2B2B2 (3BBB z2',
}

// Bars that contain (3BzB — triplet with rest (syncopated feel)
const SYNCO_TRIPLET_BARS = new Set(['D', 'I', 'Q', 'U', 'Z', '14', '16', '22', '23'])

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
    const abc =
      'X:1\nM:4/4\nL:1/8\nQ:1/4=100\nK:perc\nV:1 clef=none stafflines=1 stem=up\n|' +
      barTexts.join('|') + '|]'
    result.push({ label: String(p.label || `패턴 ${result.length + 1}`), abc })
  }
  return result.length >= 2 ? result : null
}

function buildPrompt(level: string, recentTitles: string[] = []) {
  const levelLabel = level === 'advanced' ? '고급' : '중급'
  const levelRule = level === 'advanced'
    ? '각 패턴에 복잡 패턴(P~Z, 10~12, 20~21) 중 최소 4개 포함 (나머지는 A~O, 4~9, 13~19, 22~24)'
    : '각 패턴에 복잡 패턴(P~Z, 10~12, 20~21) 중 2~3개 포함 (나머지는 A~O, 4~9, 13~19, 22~24)'

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
P: B B/ z/ z B (3BBB z2
Q: B/ z/ B z B (3BzB z2
R: z/ B/ B z B (3BBB z2
S: z B/ z/ z B (3BBB z2
T: B>B B/ z/ B z B z2
U: B>B z/ B/ B (3BzB z2
V: (3B2B2B2 B B/ z/ B/ z/ B
W: z4 B B/ z/ B/ z/ B
X: B B/ z/ B/ z/ B z B z2
Y: z/ B/ B B B/ z/ (3BBB z2
Z: B/ z/ B B B/ z/ (3BzB z2

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
20: B/ z/ B2 B/ z/ B2 z2
21: z2 B/ z/ B2 B/ z/ B2

[혼합 3연음 패턴 22~24]
22: B2 z2 (3BBB (3BzB
23: z4 (3BBB (3BzB
24: (3B2B2B2 (3BBB z2

규칙:
- ${levelRule}
- 두 패턴이 서로 다른 리듬 특성을 갖도록 조합 (예: 한 패턴은 쿼터 중심, 다른 패턴은 3연음 중심)
- 같은 ID 최대 2번 반복 가능
- label은 악보에 나타나는 리듬 특성으로 지어야 함 (예: "당김음 중심", "16분음표 집중", "3연음 위주", "점음표 패턴", "엇박 강조", "쿼터 비트", "부점 연속")
- label에 스윙·셔플·그루브·펑크 등 장르/주법 이름 사용 금지
- 싱코페이션·당김음·엇박 테마 패턴은 (3BzB 포함 bar(D·I·Q·U·Z·14·16·22·23) 최소 2개 이상 포함

JSON 객체로만 응답:
{
  "title": "챌린지 제목",
  "description": "간단한 설명 (1-2문장)",
  "level": "${level}",
  "patterns": [
    {"label": "쿼터 비트", "bars": ["1", "2", "4", "5", "A", "B", "3", "13"]},
    {"label": "3연음 집중", "bars": ["J", "K", "13", "15", "24", "N", "L", "16"]}
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
