import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY가 없어요.' }, { status: 500 })
  }
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `드럼/리듬 초견 챌린지를 위한 ABC notation 리듬 패턴 2개를 생성하세요.

조건:
- 각 패턴은 정확히 8마디 (4/4박자)
- 도돌이표 없이 겹세로줄(|])로 끝낼 것
- K:perc, L:1/8, V:1 clef=none stafflines=1 stem=up 사용
- 음표는 B(박)와 z(쉼표)만 사용
- L:1/8 기준: B=8분음표, B2=4분음표, B4=2분음표, B3=점4분음표, B/=16분음표
- 각 마디의 총합이 정확히 8 (L:1/8 기준)이어야 함
- 8분음표(B)는 반드시 2개씩 붙여서 표기 (공백 없이 BB). 예: 4박 = BB BB BB BB (각 박 2개 묶음)
- A 패턴: 그루브있는 기본 리듬
- B 패턴: 당김음·쉼표를 활용한 복잡한 리듬

JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "title": "리듬 챌린지 제목",
  "description": "간단한 설명 (1-2문장)",
  "patterns": [
    {
      "label": "A 패턴",
      "abc": "X:1\\nM:4/4\\nL:1/8\\nQ:1/4=100\\nK:perc\\nV:1 clef=none stafflines=1 stem=up\\n|B2 B2 B2 B2|B2 B2 BB BB|BB BB B2 B2|B2 B2 B2 B2|B2 B2 BB BB|BB BB B2 B2|BB B2 BB B2|B4 B4|]"
    },
    {
      "label": "B 패턴",
      "abc": "X:2\\nM:4/4\\nL:1/8\\nQ:1/4=100\\nK:perc\\nV:1 clef=none stafflines=1 stem=up\\n|BB z2 BB z2|B2 z BB z2|BB BB z2 B2|Bz BB z2 BB|BB z2 BB z2|B2 z BB z2|BB BB z2 B2|B4 z4|]"
    }
  ]
}`,
      }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: '파싱 실패' }, { status: 500 })
    const data = JSON.parse(jsonMatch[0])
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '생성 실패' }, { status: 500 })
  }
}
