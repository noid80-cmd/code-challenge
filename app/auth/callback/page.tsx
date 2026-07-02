'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallback() {
  useEffect(() => {
    const run = async () => {
      const supabase = createClient()

      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) { window.location.href = '/login'; return }
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/login'; return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .single()

      const isNewUser = !profile
      if (isNewUser) {
        const userName = session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? session.user.email ?? ''
        fetch('/api/notify-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: userName, email: session.user.email }),
        }).catch(() => {})
      }

      window.location.href = '/'
    }
    run()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'rgba(240,236,224,0.3)', fontSize: 14 }}>로그인 처리 중...</p>
    </div>
  )
}
