import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const publicPaths = ['/login', '/signup', '/auth', '/api', '/intro', '/chord', '/rhythm', '/melody', '/challenges', '/ranking', '/privacy', '/account-deletion']
  const isPublic = pathname === '/' || publicPaths.some(p => pathname.startsWith(p))

  // iOS PWA OAuth handoff: allow auth params through without session check.
  if (request.nextUrl.searchParams.has('_oauthcode') ||
      request.nextUrl.searchParams.has('_at')) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, { ...options, maxAge: 60 * 60 * 24 * 400 })
          )
        },
      },
    }
  )

  // Run getSession() for ALL pages (public and protected).
  // For public pages this is critical on iOS PWA: if the access token is expired,
  // getSession() refreshes it using the refresh-token cookie and writes new tokens via
  // Set-Cookie response headers. HTTP Set-Cookie cookies survive iOS app kills;
  // JavaScript-set cookies (document.cookie) do not — so keeping the server in sync
  // ensures the session survives across PWA restarts.
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  if (isPublic) {
    // Return supabaseResponse so any Set-Cookie headers from a session refresh are sent.
    return supabaseResponse
  }

  if (sessionError || !session) {
    // getSession failed or returned no session — fall back to getUser() which also
    // handles transient failures more gracefully.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return supabaseResponse
  }

  return supabaseResponse
}

export const config = {
  // manifest.json 과 sw.js 가 빠져 있어서 로그아웃 상태에서 로그인으로
  // 튕겼다. 처음 방문한 사람은 매니페스트를 못 읽어 홈 화면에 추가할 때
  // 앱 이름·아이콘이 제대로 안 잡힌다 — 아이폰에서는 그 경로가 곧 알림
  // 경로라 그냥 넘길 문제가 아니다.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|manifest.webmanifest|sw.js|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
