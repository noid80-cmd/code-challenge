import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 알림 대상이 몇 명인지 보는 읽기 전용 진단.
//
// 지금까지 이걸 확인할 방법이 크론(`/api/daily-cron`)뿐이었는데, 크론은 돌리는
// 순간 테스터 전원에게 알림을 실제로 발송한다. "왜 안 오지"를 확인하려고
// 사람들에게 알림을 한 번 더 보내는 상황이었다. 여기서는 아무것도 보내지 않는다.
//
// device_tokens / push_subscriptions 는 RLS 때문에 anon key로는 못 읽는다.
// 그래서 서비스 롤로 읽고 CRON_SECRET 으로 잠근다.
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: devices, error: devErr }, { count: webCount, error: webErr }] = await Promise.all([
    supabase.from('device_tokens').select('platform, updated_at, user_id'),
    supabase.from('push_subscriptions').select('endpoint', { count: 'exact', head: true }),
  ])

  const rows = devices ?? []
  const byPlatform = rows.reduce<Record<string, number>>((acc, r) => {
    const p = (r.platform as string) ?? 'unknown'
    acc[p] = (acc[p] ?? 0) + 1
    return acc
  }, {})

  // 토큰은 있는데 전부 오래된 것이면 앱을 안 여는 것이다. 최근 갱신 시각이
  // 그걸 구분해 준다(앱을 열 때마다 upsert 되므로).
  const updatedAt = rows
    .map(r => r.updated_at as string | null)
    .filter((v): v is string => !!v)
    .sort()

  return NextResponse.json({
    app: {
      tokens: rows.length,
      users: new Set(rows.map(r => r.user_id as string)).size,
      byPlatform,
      lastUpdatedAt: updatedAt.at(-1) ?? null,
      oldestUpdatedAt: updatedAt[0] ?? null,
      error: devErr?.message ?? null,
    },
    web: { subscriptions: webCount ?? 0, error: webErr?.message ?? null },
    fcmConfigured: !!process.env.FCM_SERVICE_ACCOUNT,
  })
}
