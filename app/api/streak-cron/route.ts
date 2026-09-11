import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { sendFcm } from '@/lib/fcm'

// 연속 기록이 오늘 끊길 사람에게만 저녁에 한 번 알린다.
//
// 어제 올렸는데 오늘 아직 안 올린 사람 — 그 사람만이다. 안 올린 지 이틀
// 넘은 사람은 대상이 아니다. 떠난 사람을 계속 찌르면 알림을 끄거나 앱을
// 지운다. 규칙이 "어제 올렸을 것"이라 잔소리가 저절로 멈춘다.

// 첫 연주를 권하는 말. 같은 말을 이레 내리 받으면 그냥 소음이 된다.
// 날마다 다른 각도로 한 번씩 건네고, 이 목록이 끝나면 더 보내지 않는다.
// 어느 문구든 드는 시간을 먼저 말한다 — 얼마나 걸릴지 모르면 시작하지 않는다.
const FIRST_NUDGES = [
  { title: '오늘 첫 연주를 올려보세요', body: '매일 3분이면 됩니다. 기록은 거기서 시작돼요.' },
  { title: '잘하지 않아도 괜찮아요', body: '연습한 그대로면 됩니다. 3분이면 끝나요.' },
  { title: '오늘 챌린지가 올라왔어요', body: '한 번 읽고 3분만 담아보세요.' },
  { title: '얼굴은 안 나와도 됩니다', body: '손이나 악기만 보이면 돼요. 3분이면 됩니다.' },
  { title: '첫 영상이 제일 무겁습니다', body: '한 번 올리고 나면 그다음은 쉬워져요. 매일 3분이면 됩니다.' },
  { title: '오늘 올리면 기록이 시작돼요', body: '하루 3분, 그게 전부예요.' },
  { title: '편할 때 시작하면 돼요', body: '오늘도 챌린지는 기다리고 있어요. 매일 3분이면 됩니다.' },
]
const NUDGE_DAYS = FIRST_NUDGES.length

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function kstDate(d: Date) {
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return k.toISOString().slice(0, 10)
}

function daysAgo(base: Date, n: number) {
  return kstDate(new Date(base.getTime() - n * 24 * 60 * 60 * 1000))
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const today = kstDate(now)
  const yesterday = daysAgo(now, 1)

  // 연속 기록을 세려면 지난 며칠치만 있으면 된다. 40일이면 충분하다.
  const since = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString()
  const { data: subs } = await supabase
    .from('submissions').select('user_id, created_at').gte('created_at', since)

  const daysOf = new Map<string, Set<string>>()
  for (const s of (subs ?? []) as { user_id: string; created_at: string }[]) {
    if (!daysOf.has(s.user_id)) daysOf.set(s.user_id, new Set())
    daysOf.get(s.user_id)!.add(kstDate(new Date(s.created_at)))
  }

  // 어제 올렸고 오늘은 아직 안 올린 사람 = 오늘 밤에 기록이 끊기는 사람
  const atRisk = new Map<string, number>()   // user_id -> 연속 일수
  for (const [uid, days] of daysOf) {
    if (days.has(today) || !days.has(yesterday)) continue
    let streak = 0
    for (let i = 1; i < 40; i++) {
      if (!days.has(daysAgo(now, i))) break
      streak++
    }
    atRisk.set(uid, streak)
  }

  // 한 번도 안 올린 사람에게는 시작을 권한다. 알림까지 켜 둔 사람이니
  // 마음이 없는 게 아니라 첫 걸음이 무거운 것이다. 실제로 알림을 켠 76명
  // 중 65명이 아직 첫 연주 전이었다(2026-09-11).
  //
  // 가입 후 이레까지만, 날마다 다른 말로 권한다. 그래도 안 올리면 거기서
  // 그만둔다 — 같은 말을 계속 받으면 알림을 끄고, 그러면 나중에 정말
  // 필요한 말도 못 전한다. 위의 "어제 올렸을 것"과 같은 이치다.
  const signupCutoff = new Date(now.getTime() - NUDGE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data: newcomers } = await supabase
    .from('profiles').select('id, created_at').gte('created_at', signupCutoff)
  // uid -> 가입 후 며칠째(0부터). 이 맵에 있으면 "아직 첫 연주 전"이다.
  const firstDay = new Map<string, number>()
  for (const p of (newcomers ?? []) as { id: string; created_at: string }[]) {
    if (daysOf.has(p.id)) continue
    const d = Math.floor((now.getTime() - new Date(p.created_at).getTime()) / 86400000)
    if (d < 0 || d >= NUDGE_DAYS) continue
    firstDay.set(p.id, d)
    atRisk.set(p.id, 0)
  }
  const firstTimers = firstDay.size

  if (atRisk.size === 0) {
    return NextResponse.json({ ok: true, targets: 0 })
  }

  const ids = [...atRisk.keys()]
  const [{ data: webSubs }, { data: devices }] = await Promise.all([
    supabase.from('push_subscriptions').select('user_id, endpoint, subscription').in('user_id', ids),
    supabase.from('device_tokens').select('user_id, token').in('user_id', ids),
  ])

  // 겁을 주지 않는다. "끊깁니다"는 응원이 아니라 협박이고, 협박은 한두 번은
  // 먹히지만 그 다음엔 알림을 끄게 만든다. 지금까지 해온 것을 말해주고
  // 오늘 하나면 하루가 더 붙는다고 알려준다.
  //
  // 드는 시간도 같이 적는다. 사람은 얼마나 걸릴지 모르면 시작하지 않는다.
  function messageFor(uid: string) {
    const day = firstDay.get(uid)
    if (day !== undefined) return FIRST_NUDGES[day]
    return message(atRisk.get(uid) ?? 1)
  }

  function message(streak: number) {
    if (streak <= 1) {
      return {
        title: '어제 올리셨네요',
        body: '오늘 하나 더 올리면 연속 2일째예요. 3분이면 됩니다.',
      }
    }
    return {
      title: `연속 ${streak}일 가고 있어요`,
      body: `오늘 하나만 올리면 ${streak + 1}일째예요. 3분이면 됩니다.`,
    }
  }

  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  let web = 0
  const deadEndpoints: string[] = []
  await Promise.allSettled(((webSubs ?? []) as { user_id: string; endpoint: string; subscription: unknown }[])
    .map(async s => {
      const msg = messageFor(s.user_id)
      try {
        await webpush.sendNotification(
          s.subscription as webpush.PushSubscription,
          JSON.stringify({ ...msg, url: '/upload' })
        )
        web++
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode
        if (code === 410 || code === 404) deadEndpoints.push(s.endpoint)
      }
    }))
  if (deadEndpoints.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', deadEndpoints)
  }

  // FCM은 같은 문구끼리 묶어 보낸다. 한 명씩 보내면 왕복 횟수만큼 시간이 든다.
  const byMessage = new Map<string, { title: string; body: string; tokens: string[] }>()
  for (const d of (devices ?? []) as { user_id: string; token: string }[]) {
    const msg = messageFor(d.user_id)
    const key = msg.title
    if (!byMessage.has(key)) byMessage.set(key, { ...msg, tokens: [] })
    byMessage.get(key)!.tokens.push(d.token)
  }

  let app = 0
  const deadTokens: string[] = []
  for (const m of byMessage.values()) {
    const r = await sendFcm(m.tokens, { title: m.title, body: m.body, url: '/upload' })
    app += r.sent
    deadTokens.push(...r.deadTokens)
  }
  if (deadTokens.length) {
    await supabase.from('device_tokens').delete().in('token', deadTokens)
  }

  console.log('[streak] 대상', atRisk.size, '명(첫 연주 권유', firstTimers, '명) / web', web, '/ app', app)
  return NextResponse.json({ ok: true, targets: atRisk.size, firstTimers, web, app })
}
