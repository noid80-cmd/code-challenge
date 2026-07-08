import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120  // Vercel: allow up to 2 minutes

// ── ABC bar duration parser ──────────────────────────────────────────────────
// L:1/8: B=1, B2=2, B/=0.5, z=1, z2=2, z3=3(점4분), z4=4(2분), z/=0.5
// (3BBB=2, (3B2B2B2=4, B>z=1.5+0.5=2, z>B=1.5+0.5=2
function parseBarSum(bar: string): number {
  let total = 0
  let i = 0
  const s = bar.trim()
  let pendingMod = 1  // modifier from preceding > or <

  while (i < s.length) {
    if (s[i] === ' ') { i++; continue }

    if (s[i] === '(') {
      i++
      let nStr = ''
      while (i < s.length && /\d/.test(s[i])) { nStr += s[i]; i++ }
      const n = parseInt(nStr || '3')
      const mDefault = n === 2 ? 3 : n === 3 ? 2 : n === 4 ? 3 : n === 5 ? 4 : 2
      // Peek at first note for base duration: (3BBB→1→2, (3B2B2B2→2→4
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
      pendingMod = 1
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
      const baseDur = slashes > 0 ? num / Math.pow(2, slashes) : num
      const dur = baseDur * pendingMod
      pendingMod = 1
      // Broken rhythm: B>z = B×1.5, then z×0.5 (next note gets pendingMod=0.5)
      if (i < s.length && s[i] === '>') {
        total += dur * 1.5
        pendingMod = 0.5
        i++
      } else if (i < s.length && s[i] === '<') {
        total += dur * 0.5
        pendingMod = 1.5
        i++
      } else {
        total += dur
      }
      continue
    }

    i++
  }
  return total
}

function validateABC(patterns: Array<{ abc: string }>): boolean {
  for (const p of patterns) {
    const text = (p.abc as string).replace(/\\n/g, '\n')
    // Ban duplets and long notes (notes ≥4 units — rests of any length are OK)
    if (/\(2/.test(text)) {
      console.error(`[rhythm] duplet (2 found — not standard`)
      return false
    }
    if (/B[4-9]/.test(text)) {
      console.error(`[rhythm] note B4 or longer — too long for percussion`)
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
      ? `초급: BB·z2·B2·z B·B z 블록만 사용. 아래 블록 4개 이어 붙이면 항상 8단위.
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
      ? `고급: 마디=8단위. 다양한 음표·쉼표 조합 적극 활용.

2단위 블록 — 음표 조합:
  B B/ B/   = 8분+16분+16분 (셔플 느낌)
  B/ B/ B   = 16분+16분+8분
  B/ B B/   = 16분+8분+16분 (싱코페이션)
  B>B       = 점8분+16분 (붓점)
  B<B       = 16분+점8분 (역붓점)
  B/B/B/B/  = 16분×4
  BB        = 8분×2

2단위 블록 — 쉼표 섞기:
  z B/ B/   = 8분쉼표+16분+16분
  B B/ z/   = 8분+16분+16분쉼표
  B/ z/ B   = 16분+16분쉼표+8분
  B>z       = 점8분+16분쉼표 (붓점)
  z>B       = 점8분쉼표+16분 (붓점)
  z B       = 8분쉼표+8분 (당김음)
  z2        = 4분쉼표

4단위 블록:
  (3B2B2B2  = 2박3연음 / z4 = 2분쉼표 / (3B2z2B2 = 2박3연음+쉼표

고급 예시 마디 (합계=8):
  B B/ B/ z B (3zBB z2          (2+2+2+2=8)
  B>B z B B/ B/ B z B           (2+2+2+2=8)
  B/ B B/ z B (3BBB z2          (2+2+2+2=8)
  B<B B B/ z/ z B z2            (2+2+2+2=8)
  z4 B B/ B/ z B                (4+2+2=8)
  B/ z/ B z B B>B z2            (2+2+2+2=8)
  (3B2B2B2 B B/ B/ z B          (4+2+2=8)
  z>B B/ B/ B (3BzB z B         (2+2+2+2=8)`
      : `중급: 2단위 블록×4 또는 4단위 블록×1+2단위×2.

2단위 블록 — 음표:
  BB  B2  B/B/B/B/
  B B/ B/  B/ B/ B  B/ B B/    ← 8분+16분 조합 (새로운 블록!)
  B>B  B<B                       ← 붓점/역붓점 (새로운 블록!)
  (3BBB  (3zBB  (3BzB  (3BBz

2단위 블록 — 쉼표:
  z2  z B  B z  z>B  B>z  z B/ B/  B B/ z/

4단위 블록:
  (3B2B2B2  (3B2z2B2  z4

⚠️ (3BBB=2단위 vs (3B2B2B2=4단위 구분 필수

중급 예시 마디:
  B B/ B/ z B (3BBB z2
  B>B z B B/ B/ B/ z B
  B/ B B/ z B (3BzB z2
  z>B B B/ B/ z B z2
  (3B2B2B2 B B/ B/ z B
  B<B z B (3BBB B/B/B/B/
  z4 B B/ B/ z B
  B/ z/ B z B B>B z2`

  return `드럼/리듬 초견 챌린지를 생성하세요. 서로 다른 리듬 테마의 패턴 2개를 포함합니다.

난이도: ${levelGuide}

공통 규칙:
- 4/4박자, 정확히 8마디, 겹세로줄(|])로 끝낼 것
- K:perc, L:1/8, V:1 clef=none stafflines=1 stem=up
- 각 마디는 반드시 합계 8단위 (±0)
- 절대 금지: B4·B8(음표만, 쉼표 z4는 허용), (2, B/ 완전 단독 사용

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
  const level = Math.random() < 0.7 ? 'intermediate' : 'advanced'

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
