'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallback() {
  useEffect(() => {
    const run = async () => {
      const supabase = createClient()

      // PKCE flow: ?code=xxx
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) { window.location.href = '/login?err=' + encodeURIComponent(error.message); return }
        window.location.href = '/'
        return
      }

      // Implicit flow: #access_token=xxx (Supabase legacy)
      const hash = new URLSearchParams(window.location.hash.slice(1))
      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        if (error) { window.location.href = '/login?err=' + encodeURIComponent(error.message); return }
        window.location.href = '/'
        return
      }

      window.location.href = '/login?err=no_token'
    }
    run()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'rgba(240,236,224,0.3)', fontSize: 14 }}>로그인 처리 중...</p>
    </div>
  )
}
