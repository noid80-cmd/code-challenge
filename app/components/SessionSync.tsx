'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function SessionSync() {
  useEffect(() => {
    const supabase = createClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.refresh_token) {
        localStorage.setItem('sb_rt', session.refresh_token)
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('sb_rt')
      }
    })

    // On mount, persist the refresh token and force a server-side Set-Cookie refresh.
    // sessionStorage clears when the PWA is killed — so on every new app open we call
    // /api/refresh-session which converts JavaScript-set cookies into HTTP Set-Cookie
    // header cookies that iOS persists across app kills.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.refresh_token) return
      localStorage.setItem('sb_rt', session.refresh_token)
      if (!sessionStorage.getItem('_sr')) {
        sessionStorage.setItem('_sr', '1')
        try {
          const res = await fetch('/api/refresh-session', { method: 'POST' })
          if (res.ok) {
            const { rt } = await res.json()
            if (rt) localStorage.setItem('sb_rt', rt)
          }
        } catch {}
      }
    })

    // iOS PWA clears cookies when the app backgrounds. On return, the middleware
    // would redirect to /login before React can render. Instead, proactively
    // refresh the session the moment the app becomes visible — this writes fresh
    // cookies client-side so the next server request finds a valid session.
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return
      const rt = localStorage.getItem('sb_rt')
      if (!rt) return
      const { data: { session } } = await supabase.auth.getSession()
      if (session) return // Still valid
      const { data } = await supabase.auth.refreshSession({ refresh_token: rt })
      if (data.session) {
        localStorage.setItem('sb_rt', data.session.refresh_token)
      }
      // Do NOT remove sb_rt on failure — it may be a transient network error.
      // The login page recovery will handle truly expired tokens gracefully.
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])
  return null
}
