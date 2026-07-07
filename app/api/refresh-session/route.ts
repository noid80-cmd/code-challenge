import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Called from client after login to force server-side cookie refresh with maxAge
export async function POST() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.refreshSession()
  if (error || !data.session) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
