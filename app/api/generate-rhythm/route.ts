import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

function buildPrompt(level: string) {
  const levelGuide =
    level === 'beginner'
      ? `초급: 4분음표·8분음표·쉼표만 사용. 단순하고 예측 가능한 리듬.
예시 마디: |B2 B2 B2 B2| |BB BB z2 B2| |B2 BB z2 B2|`
      : level === 'advanced'
      ? `고급: 실제 음악 시험 수준의 복잡한 리듬.
- 16분음표 연속(B/B/B/B/)과 쉼표(z/)를 불규칙하게 혼합
- 셋잇단음표((3BBB)를 예상치 못한 위치에 배치
- 16분음표+쉼표 혼합: B/ z/ B/ z/ 패턴
- 마디마다 리듬 패턴이 달라야 함
예시 마디: |B/B/ z/ B/ (3BBB B/ z/ B/B/| |z/ B/ B/B/ z2 (3BBB B/|`
      : `중급: 8분음표 기반에 16분음표(B/)와 셋잇단음표((3BBB)를 혼합. 당김음 포함.
예시 마디: |BB z2 B/B/B/B/ B2| |(3BBB BB z2 B2| |B/B/B/B/ (3BBB BB z2|`

  return `드럼/리듬 초견 챌린지를 생성하세요. 서로 다른 리듬 테마의 패턴 2개를 포함합니다.

난이도: ${levelGuide}

공통 조건:
- 4/4박자, 정확히 8마디, 겹세로줄(|])로 끝낼 것
- K:perc, L:1/8, V:1 clef=none stafflines=1 stem=up
- 음표는 B(타격), z(쉼표)만 사용
- 각 마디 총합 = 정확히 8 (L:1/8 기준)
- 앞 4마디: 기본 그루브 확립, 뒤 4마디: 변형·발전

음표 길이:
- B/ = 16분음표 = 0.5, B = 8분음표 = 1, B2 = 4분음표 = 2, B4 = 2분음표 = 4
- (3BBB = 셋잇단음표 = 총합 2, z 계열 쉼표도 동일

JSON 객체로만 응답 (다른 텍스트 없이):
{
  "title": "챌린지 제목",
  "description": "간단한 설명 (1-2문장)",
  "level": "${level}",
  "patterns": [
    {
      "label": "패턴 1",
      "abc": "X:1\\nM:4/4\\nL:1/8\\nQ:1/4=100\\nK:perc\\nV:1 clef=none stafflines=1 stem=up\\n|BB z2 B/B/B/B/ B2|BB BB z2 B2|(3BBB BB z2 B2|B/B/B/B/ (3BBB BB z2|(3BBB z2 B/B/B/B/ z2|BB z2 (3BBB BB z2|B/B/ z2 (3BBB B/B/B/B/ z2|B4 z4|]"
    },
    {
      "label": "패턴 2",
      "abc": "X:1\\nM:4/4\\nL:1/8\\nQ:1/4=100\\nK:perc\\nV:1 clef=none stafflines=1 stem=up\\n|B2 BB z2 B2|BB BB z2 B2|(3BBB BB z2 B2|B/B/B/B/ (3BBB BB z2|(3BBB z2 B/B/B/B/ z2|BB z2 (3BBB BB z2|B/B/ z2 (3BBB B/B/B/B/ z2|B4 z4|]"
    }
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
  const r = Math.random()
  const level = r < 0.3 ? 'beginner' : r < 0.8 ? 'intermediate' : 'advanced'
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: 'You are a JSON generator. Output only a valid JSON object. No explanations, no reasoning text, no markdown. Start your response directly with { and end with }.',
      messages: [{ role: 'user', content: buildPrompt(level) }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonStr = extractJsonObject(text)
    if (!jsonStr) {
      console.error('[generate-rhythm] no JSON object in response:', text.slice(0, 500))
      return NextResponse.json({ error: `파싱 실패: ${text.slice(0, 200)}` }, { status: 500 })
    }
    const challenge = JSON.parse(jsonStr)
    return NextResponse.json({ challenge })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '생성 실패' }, { status: 500 })
  }
}
