import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY가 설정되지 않았어요.' }, { status: 500 })
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `당신은 한국 음악 교육 전문가입니다. 피아노/기타 학생들을 위한 코드초견 챌린지를 생성해주세요.

JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "title": "챌린지 제목 (예: 재즈 스윙 코드 챌린지)",
  "description": "간단한 설명 (1-2문장)",
  "progressions": [
    {
      "label": "진행 1",
      "chords": ["Cmaj7", "Am7", "Dm7", "G7"],
      "style": "Jazz Swing",
      "tempo": 80
    }
  ]
}

조건:
- 1~2개의 코드 진행
- 각 진행은 반드시 정확히 4개의 코드 (4마디, 한 줄에 딱 맞게)
- 다양한 장르 (팝, 재즈, 클래식, 보사노바, R&B 등)
- 자연스럽고 실용적인 코드 진행
- 중급 수준 난이도`,
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: '응답 파싱 실패' }, { status: 500 })
    }

    const data = JSON.parse(jsonMatch[0])
    return NextResponse.json(data)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '생성 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
