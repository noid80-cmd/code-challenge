import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// ── ABC bar duration validator ──────────────────────────────────────────────
// L:1/8 기준: B=1, B2=2, B/=0.5, (3BBB=2, (3B2B2B2=4 (2박 3연음)
function parseBarSum(bar: string): number {
  let total = 0
  let i = 0
  const s = bar.trim()
  while (i < s.length) {
    if (s[i] === ' ') { i++; continue }
    if (s[i] === '(') {
      i++
      let nStr = ''
      while (i < s.length && /\d/.test(s[i])) { nStr += s[i]; i++ }
      const n = parseInt(nStr || '3')
      const mDefault = n === 2 ? 3 : n === 3 ? 2 : n === 4 ? 3 : n === 5 ? 4 : 2
      // Peek at first note to determine base note duration:
      // (3BBB=1 → 2*1=2, (3B2B2B2=2 → 2*2=4 (2박 3연음)
      let peekI = i
      while (peekI < s.length && s[peekI] === ' ') peekI++
      let baseDur = 1
      if (peekI < s.length && (s[peekI] === 'B' || s[peekI] === 'z')) {
        peekI++
        let basNumStr = ''
        while (peekI < s.length && /\d/.test(s[peekI])) { basNumStr += s[peekI]; peekI++ }
        if (basNumStr) baseDur = parseInt(basNumStr)
        else if (peekI < s.length && s[peekI] === '/') baseDur = 0.5
      }
      total += mDefault * baseDur
      let left = n
      while (i < s.length && left > 0) {
        if (s[i] === ' ') { i++; continue }
        if (s[i] === 'B' || s[i] === 'z') {
          left--; i++
          while (i < s.length && /\d/.test(s[i])) i++
          while (i < s.length && s[i] === '/') i++
        } else break
      }
      continue
    }
    if (s[i] === 'B' || s[i] === 'z') {
      i++
      let numStr = ''
      while (i < s.length && /\d/.test(s[i])) { numStr += s[i]; i++ }
      const num = numStr ? parseInt(numStr) : 1
      let slashes = 0
      while (i < s.length && s[i] === '/') { slashes++; i++ }
      total += slashes > 0 ? num / Math.pow(2, slashes) : num
      continue
    }
    i++
  }
  return total
}

function validateABC(patterns: Array<{ abc: string }>): boolean {
  for (const p of patterns) {
    const text = (p.abc as string).replace(/\\n/g, '\n')
    // Reject 16th rests, duplets, and notes/rests longer than 2 units (B4, B8, z4…)
    if (/z\//.test(text)) {
      console.error(`[rhythm] 16th rest (z/) found — not standard`)
      return false
    }
    if (/\(2/.test(text)) {
      console.error(`[rhythm] duplet (2 found — not standard`)
      return false
    }
    if (/[Bz][3-9]/.test(text)) {
      console.error(`[rhythm] note/rest ≥3 units (B4/B8/z4 etc) — not in block vocabulary`)
      return false
    }
    const barLines = text.split('\n').filter((l: string) => l.trim().startsWith('|'))
    if (barLines.length === 0) return false
    for (const barLine of barLines) {
      const bars = barLine.trim().replace(/\|]$/, '|').split('|').filter((b: string) => b.trim() !== '')
      for (const bar of bars) {
        const sum = parseBarSum(bar)
        if (Math.abs(sum - 8) > 0.01) {
          console.error(`[rhythm] bar sum=${sum} (expected 8): "${bar}"`)
          return false
        }
      }
    }
  }
  return true
}

// ── Prompt builder ───────────────────────────────────────────────────────────
function buildPrompt(level: string) {
  const levelGuide =
    level === 'beginner'
      ? `초급: BB·z2·B2·z B·B z 블록만 사용. (3BBB·B/B/B/B/·(3B2B2B2 금지.
초급 예시 마디:
  BB z2 BB z2
  z2 BB z2 BB
  B2 z2 BB z2
  z B BB B2 z2
  BB z B B2 z2
  B2 BB z B z2
  z2 z B BB BB
  BB z2 z B B2`
      : level === 'advanced'
      ? `고급: 모든 블록 사용. B/B/B/B/ 6마디 이상, (3BBB 5마디 이상, (3B2B2B2 2마디 이상.
고급 예시 마디:
  B/B/B/B/ z B (3BBB z B
  (3BBB B/B/B/B/ z B z B
  z B B/B/B/B/ (3BBB BB
  B/B/B/B/ (3BBB z B B/B/B/B/
  (3B2B2B2 B/B/B/B/ z B
  B/B/B/B/ z B B/B/B/B/ z2
  (3B2B2B2 (3BBB z B
  z B (3BBB B/B/B/B/ z B`
      : `중급: B/B/B/B/ 4마디 이상, (3BBB 3마디 이상, z B(당김) 3마디 이상, (3B2B2B2 1마디 이상.
중급 예시 마디:
  z B z B z2 (3BBB
  B/B/B/B/ z B (3BBB z2
  z2 B/B/B/B/ (3BBB z2
  (3B2B2B2 B/B/B/B/ z B
  (3BBB z B B/B/B/B/ z B
  B/B/B/B/ BB z B (3BBB
  z B (3BBB z2 B/B/B/B/
  B/B/B/B/ z B z2 (3BBB`

  return `드럼/리듬 초견 챌린지를 생성하세요. 서로 다른 리듬 테마의 패턴 2개를 포함합니다.

난이도: ${levelGuide}

마디 구성 방법 — 8단위를 채우는 두 가지 방법:

【블록 목록】
2단위 블록: BB  z2  B2  z B  B z  (3BBB  B/B/B/B/
4단위 블록: (3B2B2B2  ← 2박 3연음! 2단위 블록 두 개 자리를 차지함

⚠️ (3BBB = 1박(2단위),  (3B2B2B2 = 2박(4단위) — 다릅니다!

마디 = 8단위. 두 가지 방법만 허용:
  방법A: 2단위 블록 × 4 = 8  →  예: (3BBB + z B + z2 + BB = 8 ✓
  방법B: (3B2B2B2 × 1 + 2단위 블록 × 2 = 8  →  예: (3B2B2B2 + BB + z2 = 8 ✓

❌ 잘못된 예: (3B2B2B2 + z B + (3BBB + z2 = 4+2+2+2 = 10 ✗ (5박!)
   → (3B2B2B2 사용 시 블록은 총 3개(자신 1 + 2단위 2)만 사용

절대 금지: B/ 단독, z/, (2, B4, B8, z4, z8 등 3단위 이상 단일음표 사용 금지

공통:
- 4/4박자, 정확히 8마디, 겹세로줄(|])로 끝낼 것
- K:perc, L:1/8, V:1 clef=none stafflines=1 stem=up

JSON 객체로만 응답:
{
  "title": "챌린지 제목",
  "description": "간단한 설명 (1-2문장)",
  "level": "${level}",
  "patterns": [
    {
      "label": "패턴 1",
      "abc": "X:1\\nM:4/4\\nL:1/8\\nQ:1/4=100\\nK:perc\\nV:1 clef=none stafflines=1 stem=up\\n|...|]"
    },
    {
      "label": "패턴 2",
      "abc": "X:1\\nM:4/4\\nL:1/8\\nQ:1/4=100\\nK:perc\\nV:1 clef=none stafflines=1 stem=up\\n|...|]"
    }
  ]
}`
}

// ── JSON extractor ───────────────────────────────────────────────────────────
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

// ── Route handler ────────────────────────────────────────────────────────────
export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY가 없어요.' }, { status: 500 })
  }
  const r = Math.random()
  const level = r < 0.3 ? 'beginner' : r < 0.8 ? 'intermediate' : 'advanced'

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    let challenge = null
    let lastParsed = null
    for (let attempt = 1; attempt <= 5; attempt++) {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: 'You are a JSON generator. Output only a valid JSON object. No explanations, no reasoning text, no markdown. Start your response directly with { and end with }.',
        messages: [{ role: 'user', content: buildPrompt(level) }],
      })
      const text = message.content[0].type === 'text' ? message.content[0].text : ''
      const jsonStr = extractJsonObject(text)
      if (!jsonStr) {
        console.error(`[generate-rhythm] attempt ${attempt}: no JSON in response`)
        continue
      }
      let parsed
      try { parsed = JSON.parse(jsonStr) } catch { continue }
      lastParsed = parsed
      if (!validateABC(parsed.patterns ?? [])) {
        console.error(`[generate-rhythm] attempt ${attempt}: bar validation failed`)
        continue
      }
      challenge = parsed
      break
    }

    // Fallback: return last parsed result even if validation failed
    if (!challenge) {
      console.error('[generate-rhythm] all attempts failed validation, returning last result')
      challenge = lastParsed
    }

    if (!challenge) {
      return NextResponse.json({ error: '리듬 생성 실패. 다시 시도해주세요.' }, { status: 500 })
    }

    return NextResponse.json({ challenge })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '생성 실패' }, { status: 500 })
  }
}
