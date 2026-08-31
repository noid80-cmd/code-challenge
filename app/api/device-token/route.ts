import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 앱(FCM) 기기 토큰. 웹 푸시(push_subscriptions)와 별개로 관리한다.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token, platform } = await req.json()
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'token required' }, { status: 400 })
  }

  // 같은 기기를 다른 계정으로 로그인하면 토큰 주인이 바뀌어야 하므로
  // 토큰을 기준으로 덮어쓴다.
  const { error } = await supabase.from('device_tokens').upsert({
    user_id: user.id,
    token,
    platform: platform === 'ios' ? 'ios' : 'android',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'token' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  await supabase.from('device_tokens').delete().eq('token', token).eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
