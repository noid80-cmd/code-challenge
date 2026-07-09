import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Called from client after login/app-open to force Set-Cookie header cookies.
// JavaScript-set (document.cookie) cookies get cleared by iOS when a PWA is killed;
// HTTP Set-Cookie header cookies survive — so we rotate the session server-side and
// return the new refresh token so the client can keep sb_rt in sync.
export async function POST() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.refreshSession()
  if (error || !data.session) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  return NextResponse.json({ ok: true, rt: data.session.refresh_token })
}
