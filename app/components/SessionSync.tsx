'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// Pin the current session to HTTP Set-Cookie headers without rotating the RT.
// Called after every TOKEN_REFRESHED so HTTP cookies always reflect the latest session.
// iOS clears JS-set cookies on PWA kill but keeps HTTP Set-Cookie cookies — this is
// what keeps users logged in across app restarts.
function pinSession(at: string, rt: string) {
  fetch('/api/pin-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ at, rt }),
  }).catch(() => {})
}

export function SessionSync() {
  useEffect(() => {
    const supabase = createClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.refresh_token) {
        localStorage.setItem('sb_rt', session.refresh_token)
        // After every token refresh (browser-side auto-refresh or explicit sign-in),
        // pin the new session to HTTP cookies so iOS keeps it across app kills.
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          pinSession(session.access_token, session.refresh_token)
        }
      } else if (event === 'SIGNED_OUT') {
        // SIGNED_OUT can fire spuriously: iOS keeps the old HTTP cookie (with an already-
        // rotated refresh token) after killing the PWA. The browser client reads it, tries
        // to refresh, fails, and emits SIGNED_OUT — even though the user never logged out.
        // Instead of deleting sb_rt here (which breaks recovery), try to restore the session
        // using the last known good refresh token from localStorage.
        const rt = localStorage.getItem('sb_rt')
        if (rt) {
          supabase.auth.refreshSession({ refresh_token: rt }).then(({ data }) => {
            if (data.session) {
              localStorage.setItem('sb_rt', data.session.refresh_token)
              pinSession(data.session.access_token, data.session.refresh_token)
            } else {
              // Token is genuinely invalid (e.g. user explicitly logged out elsewhere).
              localStorage.removeItem('sb_rt')
            }
          }).catch(() => {})
        }
      }
    })

    // On mount, sync sb_rt with whatever session is in cookies right now.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.refresh_token) localStorage.setItem('sb_rt', session.refresh_token)
    })

    // On visibility change: if cookies are gone but sb_rt exists, proactively refresh
    // before the next navigation hits the server (avoids a /login redirect).
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return
      const rt = localStorage.getItem('sb_rt')
      if (!rt) return
      const { data: { session } } = await supabase.auth.getSession()
      if (session) return
      const { data } = await supabase.auth.refreshSession({ refresh_token: rt })
      if (data.session) {
        localStorage.setItem('sb_rt', data.session.refresh_token)
        pinSession(data.session.access_token, data.session.refresh_token)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])
  return null
}
