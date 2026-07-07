'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

async function afterLogin(supabase: ReturnType<typeof createClient>) {
  // Force server to re-set cookies with maxAge
  try { await fetch('/api/refresh-session', { method: 'POST' }) } catch {}
  // Store refresh_token in localStorage for iOS PWA recovery (cookies may be cleared on force-kill)
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.refresh_token) {
      localStorage.setItem('sb_rt', session.refresh_token)
    }
  } catch {}
}

export default function AuthCallback() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')

    const run = async () => {
      // Supabase may redirect back with ?error= if OAuth exchange failed on its side
      const oauthError = new URLSearchParams(window.location.search).get('error')
      if (oauthError) {
        const desc = new URLSearchParams(window.location.search).get('error_description') ?? oauthError
        window.location.href = '/login?err=' + encodeURIComponent(desc.replace(/\+/g, ' '))
        return
      }

      const supabase = createClient()

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          // iOS PWA: PKCE code_verifier is in the PWA cookie jar, but this callback
          // may be running in Safari (different context). Redirect to home with the code
          // so iOS opens the PWA, where the code_verifier is available.
          if (error.message.includes('code verifier') || error.message.includes('PKCE')) {
            window.location.replace('/?_oauthcode=' + encodeURIComponent(code))
            return
          }
          window.location.href = '/login?err=' + encodeURIComponent(error.message)
          return
        }
        await afterLogin(supabase)
        window.location.href = '/'; return
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        if (error) { window.location.href = '/login?err=' + encodeURIComponent(error.message); return }
        await afterLogin(supabase)
        window.location.href = '/'; return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await afterLogin(supabase)
        window.location.href = '/'; return
      }

      const dbg = `search=${encodeURIComponent(window.location.search)}&hash=${encodeURIComponent(window.location.hash)}`
      window.location.href = '/login?err=' + encodeURIComponent('no_session|' + dbg)
    }
    run()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'rgba(240,236,224,0.3)', fontSize: 14 }}>로그인 처리 중...</p>
    </div>
  )
}
