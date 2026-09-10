import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyTelegram } from '@/lib/telegram'

// 버그 신고.
//
// 텔레그램만 쓰면 봇 토큰이 비어 있을 때(재발급 전) 신고가 그대로 증발한다.
// DB에 먼저 저장하고 텔레그램은 알림용으로만 보낸다 — 알림이 실패해도 신고는 남는다.
//
// 저장은 service role로 한다. 클라이언트가 테이블에 직접 넣을 수 있게 두면
// 아무나 수천 건을 밀어넣을 수 있다(저장소가 공개라 주소도 공개다).

export const dynamic = 'force-dynamic'

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

  const admin = adminClient()
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { message?: string; page?: string } = {}
  try { body = await req.json() } catch { /* 아래에서 걸린다 */ }

  const message = (body.message ?? '').trim()
  if (!message) return NextResponse.json({ error: '내용을 입력해주세요' }, { status: 400 })
  if (message.length > 2000) return NextResponse.json({ error: '내용이 너무 깁니다' }, { status: 400 })

  const { error } = await admin.from('bug_reports').insert({
    user_id: user.id,
    message,
    page: (body.page ?? '').slice(0, 300) || null,
    user_agent: (req.headers.get('user-agent') ?? '').slice(0, 300) || null,
  })
  if (error) return NextResponse.json({ error: '저장에 실패했습니다' }, { status: 500 })

  const meta = (user.user_metadata ?? {}) as { name?: string }
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 16)
  // 알림 실패가 신고 접수를 막으면 안 된다 — 저장은 이미 끝났다.
  await notifyTelegram([
    '🐛 버그 신고 - 초견챌린지',
    `보낸 사람: ${meta.name ?? user.email ?? '(없음)'}`,
    `화면: ${body.page ?? '(없음)'}`,
    `시간: ${kst} KST`,
    '',
    message.slice(0, 900),
  ].join('\n')).catch(() => {})

  return NextResponse.json({ ok: true })
}
