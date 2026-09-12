import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pushToUser } from '@/lib/pushToUser'

// 좋아요·댓글 알림.
//
// 열흘 동안 영상 60개에 좋아요 1개, 댓글 0개였다. 사람들이 냉정해서가 아니라
// 반응이 와도 올린 사람이 모르기 때문이다 — 모르면 다시 들어올 이유가 없고,
// 들어오지 않으면 남의 연주도 안 본다. 루프의 첫 칸이 비어 있었다.
//
// 알림은 서버에서 보낸다. 클라이언트가 대상을 정하게 두면 아무에게나 알림을
// 쏠 수 있다 — 저장소가 공개라 주소도 공개다.

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

  let body: { submissionId?: string; type?: string } = {}
  try { body = await req.json() } catch { /* 아래에서 걸린다 */ }

  const submissionId = (body.submissionId ?? '').trim()
  const type = body.type === 'comment' ? 'comment' : 'like'
  if (!submissionId) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  const { data: sub } = await admin.from('submissions')
    .select('user_id, challenge_id').eq('id', submissionId).maybeSingle()
  if (!sub) return NextResponse.json({ ok: true, skipped: 'no-submission' })

  const owner = sub.user_id as string
  // 자기 영상에 자기가 누른 것까지 알리면 알림이 장난처럼 보인다.
  if (owner === user.id) return NextResponse.json({ ok: true, skipped: 'self' })

  // 반응한 사람이 실제로 그 행동을 했는지 서버에서 확인한다.
  if (type === 'like') {
    const { data: like } = await admin.from('likes')
      .select('id').eq('submission_id', submissionId).eq('user_id', user.id).maybeSingle()
    if (!like) return NextResponse.json({ ok: true, skipped: 'no-like' })
  }

  const { data: prof } = await admin.from('profiles').select('name').eq('id', user.id).maybeSingle()
  const who = (prof?.name as string | null) ?? '누군가'

  const sent = await pushToUser(admin, owner, {
    title: type === 'comment' ? '연주에 댓글이 달렸어요' : '연주에 좋아요를 받았어요',
    body: type === 'comment'
      ? `${who} 님이 댓글을 남겼어요. 눌러서 확인해보세요.`
      : `${who} 님이 오늘 연주를 좋아했어요.`,
    url: `/challenges/${sub.challenge_id}`,
  })

  return NextResponse.json({ ok: true, ...sent })
}
