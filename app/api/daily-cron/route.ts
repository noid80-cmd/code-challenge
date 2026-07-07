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

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const today = new Date().toISOString().slice(0, 10)

  // ── 코드챌린지 ──────────────────────────────────────────
  const { data: existingChord } = await supabase
    .from('challenges').select('id, title').eq('date', today).eq('type', 'chord').maybeSingle()

  let chordTitle: string | null = existingChord?.title ?? null

  if (!existingChord) {
    const rand = Math.random()
    const type = rand < 0.90 ? 'chord' : rand < 0.95 ? 'mode' : 'degree'

    const keys = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    const randomKey = keys[Math.floor(Math.random() * keys.length)]

    const levels = ['beginner', 'intermediate', 'advanced'] as const
    const levelWeights = [0.25, 0.5, 0.25]
    const levelRand = Math.random()
    const level = levelWeights[0] > levelRand ? levels[0] : levelWeights[0] + levelWeights[1] > levelRand ? levels[1] : levels[2]
    const levelGuide = level === 'beginner'
      ? '초급 수준: 기본 코드(maj7, m7, 7)만 사용, 흔한 키, 단순한 진행'
      : level === 'advanced'
      ? '고급 수준: 대리화음, 전조, 복잡한 텐션(b9, #11, 13 등) 적극 활용'
      : '중급 수준: 세컨더리 도미넌트, 투파이브 진행 포함, 적당한 복잡도'

    const typeGuide =
      type === 'chord'
        ? `【유형: 일반 코드 진행】\n- 8마디 구성, 한 마디에 1~2개 코드\n- 1~2개의 진행(progression)\n- key 필드 없음`
        : type === 'mode'
        ? `【유형: 모드 초견】\n- 진행 2개, 각 4마디 구성\n- 각 진행은 코드 1개를 4마디 반복\n- 코드명에 모드를 괄호로 표기: "Dm7(Dorian)"\n- 사용 가능한 모드: Dorian, Lydian, Mixolydian, Phrygian, Aeolian\n- key 필드 없음`
        : `【유형: 도수 초견】\n- 8마디 구성, 1~2개의 진행\n- 로마 숫자로 코드 표기: Imaj7, IIm7, IIIm7, IVmaj7, V7, VIm7, VIIm7b5\n- progression마다 key 필드 반드시 포함`

    const chordMsg = await anthropic.messages.create({
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
- 난이도: **${levelGuide}**

JSON 형식으로만 응답하세요 (다른 텍스트 없이):
※ title은 장르나 리듬 스타일 기반으로 지을 것 (예: "보사노바 & 재즈 코드 챌린지", "펑크 리듬 초견"). 분위기/감성 표현(미드나잇, 드리밍 등) 사용 금지.
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

    const chordText = chordMsg.content[0].type === 'text' ? chordMsg.content[0].text : ''
    const chordMatch = chordText.match(/\{[\s\S]*\}/)
    if (chordMatch) {
      const chordData = JSON.parse(chordMatch[0])
      await supabase.from('challenges').insert({
        date: today,
        type: 'chord',
        title: chordData.title,
        description: chordData.description,
        level,
        chords: { progressions: chordData.progressions },
      })
      chordTitle = chordData.title
    }
  }

  // ── 리듬챌린지 ──────────────────────────────────────────
  const { data: existingRhythm } = await supabase
    .from('challenges').select('id, title').eq('date', today).eq('type', 'rhythm').maybeSingle()

  let rhythmTitle: string | null = existingRhythm?.title ?? null

  if (!existingRhythm) {
    const rhythmLevels = ['beginner', 'intermediate', 'advanced'] as const
    const rhythmLevelWeights = [0.3, 0.5, 0.2]
    const rRand = Math.random()
    const rhythmLevel = rRand < rhythmLevelWeights[0] ? rhythmLevels[0]
      : rRand < rhythmLevelWeights[0] + rhythmLevelWeights[1] ? rhythmLevels[1]
      : rhythmLevels[2]

    const rhythmLevelGuide =
      rhythmLevel === 'beginner'
        ? `초급: 4분음표·8분음표·쉼표만 사용. 단순하고 예측 가능한 리듬.\n예시 마디: |B2 B2 B2 B2| |BB BB z2 B2| |B2 BB z2 B2|`
        : rhythmLevel === 'advanced'
        ? `고급: 16분음표·셋잇단음표·당김음을 복잡하게 혼합. 불규칙 악센트 포함.\n예시 마디: |B/B/B/B/ (3BBB B/B/B/B/ z2| |(3BBB B/B/z/ B/B/B/B/ B2|`
        : `중급: 8분음표 기반에 16분음표(B/)와 셋잇단음표((3BBB)를 혼합. 당김음 포함.\n예시 마디: |BB z2 B/B/B/B/ B2| |(3BBB BB z2 B2| |B/B/B/B/ (3BBB BB z2|`

    const rhythmMsg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `드럼/리듬 초견 챌린지를 위한 ABC notation 리듬 패턴 2개를 생성하세요.

난이도: ${rhythmLevelGuide}

공통 조건:
- 4/4박자, 정확히 8마디, 겹세로줄(|])로 끝낼 것
- K:perc, L:1/8, V:1 clef=none stafflines=1 stem=up
- 음표는 B(타격), z(쉼표)만 사용
- 각 마디 총합 = 정확히 8 (L:1/8 기준)

음표 길이 (반드시 지킬 것):
- B/ = 16분음표 = 0.5
- B  = 8분음표  = 1
- B2 = 4분음표  = 2
- B4 = 2분음표  = 4
- (3BBB = 셋잇단음표 = 총합 2 (3개를 2박에 배분)

빔 표기 규칙:
- 8분음표 2개 묶음: BB (공백 없이)
- 16분음표 4개 묶음: B/B/B/B/ (공백 없이)
- 셋잇단음표: (3BBB (공백 없이)
- 서로 다른 묶음 사이는 공백으로 구분

A 패턴: 규칙적인 그루브 중심
B 패턴: 당김음·쉼표를 활용한 복잡한 리듬

JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "title": "리듬 챌린지 제목",
  "description": "간단한 설명 (1-2문장)",
  "patterns": [
    { "label": "A 패턴", "abc": "X:1\\nM:4/4\\nL:1/8\\nQ:1/4=100\\nK:perc\\nV:1 clef=none stafflines=1 stem=up\\n|...|]" },
    { "label": "B 패턴", "abc": "X:2\\nM:4/4\\nL:1/8\\nQ:1/4=100\\nK:perc\\nV:1 clef=none stafflines=1 stem=up\\n|...|]" }
  ]
}`,
      }],
    })

    const rhythmText = rhythmMsg.content[0].type === 'text' ? rhythmMsg.content[0].text : ''
    const rhythmMatch = rhythmText.match(/\{[\s\S]*\}/)
    if (rhythmMatch) {
      const rhythmData = JSON.parse(rhythmMatch[0])
      await supabase.from('challenges').insert({
        date: today,
        type: 'rhythm',
        level: rhythmLevel,
        title: rhythmData.title,
        description: rhythmData.description,
        chords: { patterns: rhythmData.patterns },
      })
      rhythmTitle = rhythmData.title
    }
  }

  // ── 푸시 알림 ──────────────────────────────────────────
  const { data: subs } = await supabase
    .from('push_subscriptions').select('subscription, endpoint')

  if (!subs || subs.length === 0) {
    return NextResponse.json({ chordTitle, rhythmTitle, sent: 0 })
  }

  const notifTitle = 'PlayDaily — 오늘의 챌린지'
  const notifBody = [
    chordTitle ? `🎵 ${chordTitle}` : null,
    rhythmTitle ? `🥁 ${rhythmTitle}` : null,
  ].filter(Boolean).join('\n') || '새로운 챌린지가 올라왔어요!'

  const deadEndpoints: string[] = []
  const results = await Promise.allSettled(
    subs.map(async ({ subscription, endpoint }) => {
      try {
        await webpush.sendNotification(subscription, JSON.stringify({ title: notifTitle, body: notifBody, url: '/' }))
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
  return NextResponse.json({ chordTitle, rhythmTitle, sent, total: subs.length })
}
