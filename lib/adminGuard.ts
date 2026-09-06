import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// 문제 생성 라우트(generate-challenge / -melody / -rhythm)는 Anthropic API를
// 부른다. 어드민 화면에서만 호출하는데도 서버 쪽 검사가 없어서 누구나
// 호출할 수 있었다 — 저장소가 공개라 엔드포인트 주소도 함께 공개돼 있고,
// maxDuration 이 120초라 반복 호출하면 API 비용이 그대로 나간다.
//
// 화면에서는 이미 이메일로 막고 있지만 그건 브라우저 안의 판단이라 요청을
// 직접 보내면 통과한다. 서버가 다시 확인해야 한다.
//
// 쿠키와 Authorization 헤더 둘 다 본다. 이 앱은 iOS PWA에서 JS 쿠키가
// 날아가는 문제 때문에 세션을 토큰으로도 들고 다닌다 — 쿠키만 보면
// 정작 어드민이 막히는 상황이 생길 수 있다.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'noid80@hanmail.net').trim().toLowerCase()

function deny(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 401, headers: { 'Content-Type': 'application/json' },
  })
}

async function emailFromBearer(req: Request | undefined): Promise<string | null> {
  const token = req?.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: { user } } = await admin.auth.getUser(token)
    return user?.email ?? null
  } catch {
    return null
  }
}

async function emailFromCookies(): Promise<string | null> {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.email ?? null
  } catch {
    return null
  }
}

/** 어드민이면 null, 아니면 그대로 반환할 응답을 돌려준다. */
export async function requireAdmin(req?: Request): Promise<Response | null> {
  const email = (await emailFromCookies()) ?? (await emailFromBearer(req))
  if (!email || email.toLowerCase() !== ADMIN_EMAIL) return deny('권한이 없어요.')
  return null
}
