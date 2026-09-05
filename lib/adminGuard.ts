import { createClient } from '@/lib/supabase/server'

// 문제 생성 라우트(generate-challenge / -melody / -rhythm)는 Anthropic API를
// 부른다. 어드민 화면에서만 호출하는데도 서버 쪽 검사가 없어서 누구나
// 호출할 수 있었다 — 저장소가 공개라 엔드포인트 주소도 함께 공개돼 있고,
// maxDuration 이 120초라 반복 호출하면 API 비용이 그대로 나간다.
//
// 화면에서는 이미 이메일로 막고 있지만 그건 브라우저 안의 판단이라 요청을
// 직접 보내면 통과한다. 서버가 다시 확인해야 한다.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'noid80@hanmail.net').trim().toLowerCase()

/** 어드민이면 null, 아니면 그대로 반환할 응답을 돌려준다. */
export async function requireAdmin(): Promise<Response | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || (user.email ?? '').toLowerCase() !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: '권한이 없어요.' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      })
    }
    return null
  } catch {
    return new Response(JSON.stringify({ error: '권한 확인에 실패했어요.' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }
}
