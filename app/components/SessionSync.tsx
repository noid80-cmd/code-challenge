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

    // On mount, immediately persist the refresh token if a session exists.
    // This ensures sb_rt is stored even when onAuthStateChange fires late.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.refresh_token) localStorage.setItem('sb_rt', session.refresh_token)
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
