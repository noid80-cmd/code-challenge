import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendFcm } from '@/lib/fcm'

// 한 사람에게 알림을 보낸다. 웹과 앱 두 경로를 모두 쓰고, 죽은 구독은 지운다.
//
// 버그 신고 답장(app/api/bug-reply)이 하던 일과 같다. 반응 알림이 생기면서
// 같은 코드가 두 곳이 되는데, 한쪽만 고치면 다른 쪽이 조용히 어긋난다.
// 새로 만드는 쪽부터 여기를 쓴다.
export type PushPayload = { title: string; body: string; url: string }

export async function pushToUser(
  admin: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<{ web: number; app: number }> {
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
        await webpush.sendNotification(s.subscription as webpush.PushSubscription, JSON.stringify(payload))
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode
        if (code === 410 || code === 404) dead.push(s.endpoint)
        throw err
      }
    }))
    web = results.filter(r => r.status === 'fulfilled').length
    if (dead.length) await admin.from('push_subscriptions').delete().in('endpoint', dead)
  } catch (err) {
    console.warn('[push] 웹 푸시 실패', err)
  }

  let app = 0
  try {
    const { data: devices } = await admin.from('device_tokens').select('token').eq('user_id', userId)
    const tokens = (devices ?? []).map((d: { token: string }) => d.token)
    if (tokens.length) {
      const fcm = await sendFcm(tokens, payload)
      app = fcm.sent
      if (fcm.deadTokens.length) await admin.from('device_tokens').delete().in('token', fcm.deadTokens)
    }
  } catch (err) {
    console.warn('[push] FCM 실패', err)
  }

  return { web, app }
}
