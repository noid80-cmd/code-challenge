import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

function buildPrompt(level: string) {
  const levelGuide =
    level === 'beginner'
      ? `초급: 4분음표·8분음표·쉼표만 사용. 단순하고 예측 가능한 리듬.
예시 마디: |B2 B2 B2 B2| |BB BB z2 B2| |B2 BB z2 B2|`
      : level === 'advanced'
      ? `고급: 16분음표·셋잇단음표·당김음을 복잡하게 혼합. 불규칙 악센트 포함.
예시 마디: |B/B/B/B/ (3BBB B/B/B/B/ z2| |(3BBB B/B/z/ B/B/B/B/ B2|`
      : `중급: 8분음표 기반에 16분음표(B/)와 셋잇단음표((3BBB)를 혼합. 당김음 포함.
예시 마디: |BB z2 B/B/B/B/ B2| |(3BBB BB z2 B2| |B/B/B/B/ (3BBB BB z2|`

  return `드럼/리듬 초견 챌린지를 위한 ABC notation 리듬 패턴 1개를 생성하세요.

난이도: ${levelGuide}

조건:
- 4/4박자, 정확히 8마디, 겹세로줄(|])로 끝낼 것
- K:perc, L:1/8, V:1 clef=none stafflines=1 stem=up
- 음표는 B(타격), z(쉼표)만 사용
- 각 마디 총합 = 정확히 8 (L:1/8 기준)
- 앞 4마디: 기본 그루브 확립
- 뒤 4마디: 당김음·16분음표·셋잇단음표로 변형·발전

음표 길이 (반드시 지킬 것):
- B/ = 16분음표 = 0.5
- B  = 8분음표  = 1
- B2 = 4분음표  = 2
- B4 = 2분음표  = 4
- (3BBB = 셋잇단음표 = 총합 2 (3개를 2박에 배분)
- z 계열 쉼표도 동일한 길이 규칙

빔 표기 규칙:
- 8분음표 2개 묶음: BB (공백 없이)
- 16분음표 4개 묶음: B/B/B/B/ (공백 없이)
- 셋잇단음표: (3BBB (공백 없이)
- 서로 다른 묶음 사이는 공백으로 구분

JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "title": "리듬 챌린지 제목",
  "description": "간단한 설명 (1-2문장)",
  "level": "${level}",
  "patterns": [
    {
      "label": "",
      "abc": "X:1\\nM:4/4\\nL:1/8\\nQ:1/4=100\\nK:perc\\nV:1 clef=none stafflines=1 stem=up\\n|BB z2 B/B/B/B/ B2|BB BB z2 B2|(3BBB BB z2 B2|B/B/B/B/ (3BBB BB z2|(3BBB z2 B/B/B/B/ z2|BB z2 (3BBB BB z2|B/B/z2 (3BBB B/B/B/B/ z2|B4 z4|]"
    }
  ]
}`
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY가 없어요.' }, { status: 500 })
  }
  const { level = 'intermediate' } = await req.json().catch(() => ({}))
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: buildPrompt(level) }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[generate-rhythm] no JSON in response:', text.slice(0, 500))
      return NextResponse.json({ error: `파싱 실패: ${text.slice(0, 200)}` }, { status: 500 })
    }
    const data = JSON.parse(jsonMatch[0])
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '생성 실패' }, { status: 500 })
  }
}
