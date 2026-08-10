import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  // profiles/submissions/likes 모두 auth.users on delete cascade로 연결되어 있어
  // 유저 삭제 시 관련 데이터가 함께 정리된다
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('[delete-account]', error)
    return NextResponse.json({ error: '계정 삭제에 실패했습니다' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
