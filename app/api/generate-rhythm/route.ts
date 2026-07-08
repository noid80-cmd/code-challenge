import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// ── ABC bar duration validator ──────────────────────────────────────────────
// L:1/8 기준: B=1, B2=2, B4=4, B/=0.5, (3BBB=2(triplet), z variants same
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
      // (3=2units, (2=3units, (5=4units in standard ABC tuplets
      const tupDur = n === 2 ? 3 : n === 3 ? 2 : n === 4 ? 3 : n === 5 ? 4 : 2
      total += tupDur
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
    // Reject 16th rests (z/) — non-standard in drum notation
    if (/z\//.test(text)) {
      console.error(`[rhythm] 16th rest (z/) found — not standard`)
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
      ? `초급: BB·z2·B2 블록만 사용. (3BBB·B/B/B/B/ 금지.
초급 사용 가능 블록: BB  z2  B2  z B  B z
초급 예시 마디:
  BB z2 BB z2        (당김없음)
  z2 BB z2 BB        (뒷박 강조)
  B2 z2 BB z2        (기본 그루브)
  z B B z BB z2      ← 오류! 블록 5개(z B)(B z)(BB)(z2) = 4개지만... z B B z = 4단위→블록2개로 쓰면 (z B)(B z)
  BB z2 z B B2       (마지막 발전)
  B2 BB z B BB       (종합)`
      : level === 'advanced'
      ? `고급: 모든 블록 사용. 마디마다 패턴 달리하고 셋잇단 5마디 이상.
고급 예시 마디:
  (3BBB z B (3BBB z B
  z B (3BBB B z B z
  B/B/B/B/ z B (3BBB z B
  (3BBB B z B z B/B/B/B/
  z B z B (3BBB z B
  B z (3BBB z B B z
  (3BBB z B B/B/B/B/ z B
  B z B z (3BBB B z`
      : `중급: (3BBB 3마디 이상, B/B/B/B/ 2마디 이상, z B(당김음) 3마디 이상.
중급 예시 마디:
  z B z B z2 (3BBB
  (3BBB z2 BB z2
  z2 B/B/B/B/ (3BBB z2
  z B (3BBB z B z2
  (3BBB z B (3BBB z B
  BB (3BBB z2 z B
  z2 B/B/B/B/ BB z2
  z B BB z2 (3BBB`

  return `드럼/리듬 초견 챌린지를 생성하세요. 서로 다른 리듬 테마의 패턴 2개를 포함합니다.

난이도: ${levelGuide}

마디 구성 방법 — 아래 2단위 블록을 정확히 4개 골라 이어 붙이면 항상 8단위가 됩니다:
  BB        = 8분음표 2개 (2단위)
  z2        = 4분쉼표 (2단위)
  B2        = 4분음표 (2단위)
  z B       = 8분쉼표+8분음표 (2단위, 당김음)
  B z       = 8분음표+8분쉼표 (2단위)
  (3BBB     = 셋잇단음표 3개 (2단위)
  B/B/B/B/  = 16분음표 4개 (2단위)

예시: (3BBB + z B + z2 + BB = "(3BBB z B z2 BB" → 2+2+2+2 = 8 ✓
규칙: 블록 4개만 사용. B/ 단독·z/ 사용 금지.

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
