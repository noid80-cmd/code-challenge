import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyTelegram } from '@/lib/telegram'

// 가입 알림.
//
// 이 라우트가 무인증으로 열려 있었다. 저장소가 공개라 주소도 함께 공개돼
// 있어서, 누구나 가짜 가입 알림을 운영자 텔레그램에 쏟아부을 수 있었다.
//
// 이름·이메일은 요청 값이 아니라 토큰이 가리키는 계정에서 읽는다. 요청
// 값을 믿으면 로그인한 사람이 아무 이름이나 적어 보낼 수 있다.

export const dynamic = 'force-dynamic'

// 모듈 최상단에서 만들면 빌드 시점에 평가돼서, 서비스 롤 키가 없는 환경
// (로컬 .env.local 등)에서 빌드가 통째로 깨진다. 핸들러 안에서 만든다.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: { user } } = await adminClient().auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const meta = (user.user_metadata ?? {}) as { name?: string }
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const time = kst.toISOString().replace('T', ' ').slice(0, 16)

  await notifyTelegram([
    '🎵 새 회원가입 - 코드 챌린지',
    `이름: ${meta.name ?? '(없음)'}`,
    `이메일: ${user.email ?? '(없음)'}`,
    `시간: ${time} KST`,
  ].join('\n'))

  return NextResponse.json({ ok: true })
}
