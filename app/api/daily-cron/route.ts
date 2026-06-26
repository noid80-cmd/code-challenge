import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date().toISOString().slice(0, 10)

  // 오늘 챌린지가 이미 있으면 생성 건너뜀
  const { data: existing } = await supabase
    .from('challenges').select('id, title').eq('date', today).single()

  let challengeTitle = existing?.title ?? null

  if (!existing) {
    // Claude로 챌린지 생성
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY 없음' }, { status: 500 })
    }

    const rand = Math.random()
    const type = rand < 0.90 ? 'chord' : rand < 0.95 ? 'mode' : 'degree'

    const keys = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    const randomKey = keys[Math.floor(Math.random() * keys.length)]

    const typeGuide =
      type === 'chord'
        ? `【유형: 일반 코드 진행】
- 8마디 구성, 한 마디에 1~2개 코드
- 1~2개의 진행(progression)
- key 필드 없음`
        : type === 'mode'
        ? `【유형: 모드 초견】
- 진행 2개, 각 4마디 구성
- 각 진행은 코드 1개를 4마디 반복 (다른 코드 절대 섞지 말 것)
- 코드명에 모드를 괄호로 표기: "Dm7(Dorian)", "F7(Mixolydian)"
- 사용 가능한 모드: Dorian, Lydian, Mixolydian, Phrygian, Aeolian
- 예시: [["Dm7(Dorian)"], ["Dm7(Dorian)"], ["Dm7(Dorian)"], ["Dm7(Dorian)"]]
- key 필드 없음`
        : `【유형: 도수 초견】
- 8마디 구성, 1~2개의 진행
- 로마 숫자로 코드 표기: Imaj7, IIm7, IIIm7, IVmaj7, V7, VIm7, VIIm7b5
- progression마다 key 필드 반드시 포함`

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `당신은 한국 음악 교육 전문가입니다. 피아노/기타 학생들을 위한 코드초견 챌린지를 생성해주세요.

${typeGuide}

공통 조건:
- 오늘의 키: **${randomKey}** (반드시 이 키로 진행을 만들어야 함)
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
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: '챌린지 파싱 실패' }, { status: 500 })
    }

    const data = JSON.parse(jsonMatch[0])
    const { error: insertError } = await supabase.from('challenges').insert({
      date: today,
      title: data.title,
      description: data.description,
      level: 'intermediate',
      chords: { progressions: data.progressions },
    })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    challengeTitle = data.title
  }

  // 푸시 알림 전송
  const { data: subs } = await supabase
    .from('push_subscriptions').select('subscription, endpoint')

  if (!subs || subs.length === 0) {
    return NextResponse.json({ generated: !existing, sent: 0, title: challengeTitle })
  }

  const title = '코드 챌린지 🎵'
  const body = challengeTitle
    ? `오늘의 챌린지: ${challengeTitle}`
    : '오늘의 새로운 코드 진행이 올라왔어요!'

  const deadEndpoints: string[] = []

  const results = await Promise.allSettled(
    subs.map(async ({ subscription, endpoint }) => {
      try {
        await webpush.sendNotification(subscription, JSON.stringify({ title, body, url: '/' }))
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'statusCode' in err &&
          ((err as { statusCode: number }).statusCode === 410 || (err as { statusCode: number }).statusCode === 404)) {
          deadEndpoints.push(endpoint)
        }
        throw err
      }
    })
  )

  if (deadEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', deadEndpoints)
  }

  const sent = results.filter(r => r.status === 'fulfilled').length
  return NextResponse.json({ generated: !existing, title: challengeTitle, sent, total: subs.length })
}
