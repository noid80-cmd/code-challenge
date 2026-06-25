import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY가 설정되지 않았어요.' }, { status: 500 })
  }

  try {
    const rand = Math.random()
    const type = rand < 0.90 ? 'chord' : rand < 0.95 ? 'mode' : 'degree'

    const typeGuide =
      type === 'chord'
        ? `【유형: 일반 코드 진행】
- 8마디 구성, 한 마디에 1~2개 코드
- 1~2개의 진행(progression)
- key 필드 없음`
        : type === 'mode'
        ? `【유형: 모드 초견】
- 4마디씩 2개 진행 (총 2개 progression)
- 코드명에 모드를 괄호로 표기: "Cm7(Dorian)", "Fmaj7(Lydian)"
- 사용 가능한 모드: Dorian, Lydian, Mixolydian, Phrygian, Aeolian
- key 필드 없음`
        : `【유형: 도수 초견】
- 8마디 구성, 1~2개의 진행
- 로마 숫자로 코드 표기: Imaj7, IIm7, IIIm7, IVmaj7, V7, VIm7, VIIm7b5
- progression마다 key 필드 반드시 포함`

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `당신은 한국 음악 교육 전문가입니다. 피아노/기타 학생들을 위한 코드초견 챌린지를 생성해주세요.

${typeGuide}

공통 조건:
- chords는 마디 배열: 각 마디는 1~2개 코드를 담는 배열
- style은 다음 중 하나: swing, bossa, samba, jazz_ballad, pop_ballad, funk, shuffle, rnb
- 자연스럽고 실용적인 코드 진행, 중급 수준 난이도

JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "title": "챌린지 제목",
  "description": "간단한 설명 (1-2문장, 유형 언급 포함)",
  "progressions": [
    {
      "label": "진행 1",
      "key": "C",
      "chords": [["Imaj7"], ["IIm7"], ["V7"], ["Imaj7"], ["IIm7"], ["V7"], ["IVmaj7"], ["Imaj7"]],
      "style": "swing"
    }
  ]
}

※ key 필드는 도수 초견일 때만 포함.`,
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
