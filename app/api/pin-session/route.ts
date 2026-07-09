import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Called after every client-side TOKEN_REFRESHED event to persist the new session
// as HTTP Set-Cookie headers. Unlike /api/refresh-session (which rotates the RT),
// setSession stores the tokens as-is — no rotation, no API call, just a fast JWT
// decode + cookie write. This keeps HTTP cookies in sync with the latest session so
// iOS does not restore a stale refresh token after killing the PWA.
export async function POST(request: NextRequest) {
  try {
    const { at, rt } = await request.json()
    if (!at || !rt) return NextResponse.json({ ok: false }, { status: 400 })
    const supabase = await createClient()
    const { error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt })
    if (error) return NextResponse.json({ ok: false }, { status: 401 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
