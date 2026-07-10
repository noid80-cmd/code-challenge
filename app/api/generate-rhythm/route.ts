import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120

// All bars pre-verified: each = exactly 8 eighth-note units (4/4, L:1/8)
const BAR_PATTERNS: Record<string, string> = {
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
    const abc =
      'X:1\nM:4/4\nL:1/8\nQ:1/4=100\nK:perc\nV:1 clef=none stafflines=1 stem=up\n|' +
      barTexts.join('|') + '|]'
    result.push({ label: String(p.label || `패턴 ${result.length + 1}`), abc })
  }
  return result.length >= 2 ? result : null
}

function buildPrompt(level: string) {
  const levelLabel = level === 'advanced' ? '고급' : '중급'
  const levelRule = level === 'advanced'
    ? '각 패턴에 P~Z 중 최소 4개 포함 (나머지는 A~O)'
    : '각 패턴에 P~Z 중 2~3개 포함 (나머지는 A~O)'

  return `드럼/리듬 초견 챌린지를 생성하세요. 서로 다른 리듬 테마의 패턴 2개를 포함합니다.

난이도: ${levelLabel}

아래 마디 패턴 라이브러리에서 각 패턴에 대해 정확히 8개 마디 ID를 선택하세요.
각 패턴은 정확히 4박자입니다.

[심플 패턴 A~O]
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

[16분쉼표(z/) 포함 패턴 P~Z]
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

규칙:
- ${levelRule}
- 두 패턴이 서로 다른 리듬 특성을 갖도록 조합
- 같은 ID 최대 2번 반복 가능
- label은 악보에 나타나는 리듬 특성으로 지어야 함 (예: "당김음 중심", "16분음표 집중", "3연음 위주", "점음표 패턴", "엇박 강조")
- label에 스윙·셔플·그루브·펑크 등 장르/주법 이름 사용 금지

JSON 객체로만 응답:
{
  "title": "챌린지 제목",
  "description": "간단한 설명 (1-2문장)",
  "level": "${level}",
  "patterns": [
    {"label": "당김음 중심", "bars": ["C", "A", "G", "D", "R", "E", "J", "P"]},
    {"label": "16분음표 집중", "bars": ["B", "H", "C", "Q", "A", "D", "M", "E"]}
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

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    let challenge = null
    for (let attempt = 1; attempt <= 5; attempt++) {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: 'You are a JSON generator. Output only a valid JSON object. No explanations, no reasoning text, no markdown. Start your response directly with { and end with }.',
        messages: [{ role: 'user', content: buildPrompt(level) }],
      })
      const text = message.content[0].type === 'text' ? message.content[0].text : ''
      const jsonStr = extractJsonObject(text)
      if (!jsonStr) { console.error(`[generate-rhythm] attempt ${attempt}: no JSON`); continue }
      let parsed
      try { parsed = JSON.parse(jsonStr) } catch { continue }

      const assembled = assemblePatternsABC(parsed.patterns ?? [])
      if (!assembled) { console.error(`[generate-rhythm] attempt ${attempt}: assembly failed`); continue }

      challenge = {
        title: String(parsed.title || '드럼 초견 챌린지'),
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
