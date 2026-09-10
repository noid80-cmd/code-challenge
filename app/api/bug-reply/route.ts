import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { sendFcm } from '@/lib/fcm'
import { requireAdmin } from '@/lib/adminGuard'

// 버그 신고 답장.
//
// 처리했다고 어드민 화면에만 표시하면 신고한 사람은 아무것도 못 받는다.
// 답장을 남기고 신고자에게만 알림을 보낸다.
//
// 알림은 답장을 쓸 때만 나간다 — "읽었음" 표시로 누른 건까지 알림이 가면
// 고치지도 않은 것을 고쳤다고 말하게 된다.

export const dynamic = 'force-dynamic'

const NOTIF = {
  title: '신고에 답장이 왔어요',
  body: '보내주신 버그 신고를 확인했어요. 눌러서 답장을 읽어보세요.',
  url: '/my-videos?bug=1',
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied

  let body: { id?: string; reply?: string } = {}
  try { body = await req.json() } catch { /* 아래에서 걸린다 */ }

  const id = (body.id ?? '').trim()
  const reply = (body.reply ?? '').trim()
  if (!id || !reply) return NextResponse.json({ error: '내용이 비었어요.' }, { status: 400 })
  if (reply.length > 1000) return NextResponse.json({ error: '답장이 너무 길어요.' }, { status: 400 })

  const admin = adminClient()
  const now = new Date().toISOString()
  const { data: rows, error } = await admin.from('bug_reports')
    .update({ admin_reply: reply, replied_at: now, resolved_at: now })
    .eq('id', id).select('user_id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!rows?.length) return NextResponse.json({ error: '신고를 찾지 못했어요.' }, { status: 404 })

  const userId = rows[0].user_id as string | null
  // 탈퇴한 사람의 신고에도 답장은 남겨둔다. 보낼 곳만 없다.
  if (!userId) return NextResponse.json({ ok: true, web: 0, app: 0 })

  // ── 웹 푸시 ──
  let web = 0
  try {
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL}`,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    )
    const { data: subs } = await admin.from('push_subscriptions')
      .select('endpoint, subscription').eq('user_id', userId)
    const dead: string[] = []
    const results = await Promise.allSettled((subs ?? []).map(async (s: { endpoint: string; subscription: unknown }) => {
      try {
        await webpush.sendNotification(s.subscription as webpush.PushSubscription, JSON.stringify(NOTIF))
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode
        if (code === 410 || code === 404) dead.push(s.endpoint)
        throw err
      }
    }))
    web = results.filter(r => r.status === 'fulfilled').length
    if (dead.length) await admin.from('push_subscriptions').delete().in('endpoint', dead)
  } catch (err) {
    // 알림이 실패해도 답장 자체는 이미 저장됐다. 여기서 500을 내면
    // 관리자가 같은 답장을 또 쓰게 된다.
    console.warn('[bug-reply] 웹 푸시 실패', err)
  }

  // ── 앱(FCM) ──
  let app = 0
  try {
    const { data: devices } = await admin.from('device_tokens').select('token').eq('user_id', userId)
    const tokens = (devices ?? []).map((d: { token: string }) => d.token)
    if (tokens.length) {
      const fcm = await sendFcm(tokens, NOTIF)
      app = fcm.sent
      if (fcm.deadTokens.length) await admin.from('device_tokens').delete().in('token', fcm.deadTokens)
    }
  } catch (err) {
    console.warn('[bug-reply] FCM 실패', err)
  }

  return NextResponse.json({ ok: true, web, app })
}
