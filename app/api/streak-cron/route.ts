import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { sendFcm } from '@/lib/fcm'

// 연속 기록이 오늘 끊길 사람에게만 저녁에 한 번 알린다.
//
// 어제 올렸는데 오늘 아직 안 올린 사람 — 그 사람만이다. 안 올린 지 이틀
// 넘은 사람은 대상이 아니다. 떠난 사람을 계속 찌르면 알림을 끄거나 앱을
// 지운다. 규칙이 "어제 올렸을 것"이라 잔소리가 저절로 멈춘다.

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

  if (atRisk.size === 0) {
    return NextResponse.json({ ok: true, targets: 0 })
  }

  const ids = [...atRisk.keys()]
  const [{ data: webSubs }, { data: devices }] = await Promise.all([
    supabase.from('push_subscriptions').select('user_id, endpoint, subscription').in('user_id', ids),
    supabase.from('device_tokens').select('user_id, token').in('user_id', ids),
  ])

  // 문구는 연속 일수에 따라 달라진다. 어제 처음 올린 사람에게 "기록이
  // 끊긴다"고 하면 겁만 주고 끝난다 — 그 사람에겐 이틀째를 권한다.
  function message(streak: number) {
    if (streak <= 1) {
      return {
        title: '어제 올리셨네요',
        body: '오늘 하나 더 올리면 연속 2일째예요. 3분이면 됩니다.',
      }
    }
    return {
      title: `연속 ${streak}일이 오늘 끊깁니다`,
      body: '지금 하나 올리면 이어져요. 3분이면 됩니다.',
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
      const msg = message(atRisk.get(s.user_id) ?? 1)
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
    const msg = message(atRisk.get(d.user_id) ?? 1)
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

  console.log('[streak] 대상', atRisk.size, '명 / web', web, '/ app', app)
  return NextResponse.json({ ok: true, targets: atRisk.size, web, app })
}
