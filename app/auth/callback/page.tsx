'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallback() {
  useEffect(() => {
    // Read URL before createClient() potentially clears the hash
    const code = new URLSearchParams(window.location.search).get('code')
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')

    const run = async () => {
      const supabase = createClient()

      // PKCE flow
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) { window.location.href = '/login?err=' + encodeURIComponent(error.message); return }
        window.location.href = '/'; return
      }

      // Implicit flow — set session from hash tokens
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        if (error) { window.location.href = '/login?err=' + encodeURIComponent(error.message); return }
        window.location.href = '/'; return
      }

      // Fallback: client may have auto-processed the hash
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { window.location.href = '/'; return }

      // Debug: show what was in the URL
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
