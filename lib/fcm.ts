import { GoogleAuth } from 'google-auth-library'

// FCM HTTP v1. Admin SDK를 쓰면 편하지만 서버리스 번들이 커져서,
// 서비스 계정으로 액세스 토큰만 받아 REST로 직접 보낸다.

type ServiceAccount = { project_id: string; client_email: string; private_key: string }

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ServiceAccount
    // 환경변수에 넣을 때 개행이 \n 문자열로 들어가는 경우가 흔하다
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
    return parsed
  } catch {
    console.error('[fcm] FCM_SERVICE_ACCOUNT 파싱 실패')
    return null
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null

async function accessToken(sa: ServiceAccount): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value
  const auth = new GoogleAuth({
    credentials: { client_email: sa.client_email, private_key: sa.private_key },
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  })
  const client = await auth.getClient()
  const res = await client.getAccessToken()
  if (!res.token) return null
  cachedToken = { value: res.token, expiresAt: Date.now() + 50 * 60_000 }
  return res.token
}

export type FcmResult = { sent: number; failed: number; deadTokens: string[] }

/**
 * 토큰 목록에 알림을 보낸다.
 * 더 이상 유효하지 않은 토큰(404 UNREGISTERED / 400 INVALID_ARGUMENT)은
 * deadTokens 로 돌려주므로 호출한 쪽에서 지우면 된다.
 */
export async function sendFcm(
  tokens: string[],
  notification: { title: string; body: string; url?: string }
): Promise<FcmResult> {
  const sa = serviceAccount()
  if (!sa || tokens.length === 0) return { sent: 0, failed: 0, deadTokens: [] }

  const token = await accessToken(sa)
  if (!token) {
    console.error('[fcm] 액세스 토큰 발급 실패')
    return { sent: 0, failed: tokens.length, deadTokens: [] }
  }

  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`
  const deadTokens: string[] = []
  let sent = 0
  let failed = 0

  const results = await Promise.allSettled(
    tokens.map(async t => {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: t,
            notification: { title: notification.title, body: notification.body },
            data: notification.url ? { url: notification.url } : undefined,
            android: { priority: 'HIGH', notification: { sound: 'default' } },
            apns: { payload: { aps: { sound: 'default' } } },
          },
        }),
      })
      if (res.ok) return
      const text = await res.text()
      // 앱 삭제·재설치로 죽은 토큰은 남겨두면 매일 실패만 쌓인다
      if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(text)) {
        deadTokens.push(t)
      }
      throw new Error(`${res.status} ${text.slice(0, 160)}`)
    })
  )

  for (const r of results) {
    if (r.status === 'fulfilled') sent++
    else {
      failed++
      console.error('[fcm] 전송 실패:', r.reason instanceof Error ? r.reason.message : r.reason)
    }
  }

  return { sent, failed, deadTokens }
}
