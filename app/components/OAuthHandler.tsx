'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function OAuthHandler() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('_oauthcode')
    const at = params.get('_at')
    const rt = params.get('_rt')

    if (!code && !at) return

    // Strip auth params from URL immediately
    const clean = new URL(window.location.href)
    clean.searchParams.delete('_oauthcode')
    clean.searchParams.delete('_at')
    clean.searchParams.delete('_rt')
    window.history.replaceState({}, '', clean.toString())

    const supabase = createClient()

    if (at && rt) {
      // Implicit flow: tokens handed off from Safari via ?_at=&_rt=
      supabase.auth.setSession({ access_token: at, refresh_token: rt }).then(({ data, error }) => {
        if (error) { window.location.href = '/login?err=' + encodeURIComponent(error.message); return }
        if (data.session?.refresh_token) localStorage.setItem('sb_rt', data.session.refresh_token)
        window.location.href = '/'
      })
      return
    }

    if (code) {
      // PKCE fallback: exchange code in PWA context where code_verifier may exist
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) { window.location.href = '/login?err=' + encodeURIComponent(error.message); return }
        if (data.session?.refresh_token) localStorage.setItem('sb_rt', data.session.refresh_token)
        window.location.href = '/'
      })
    }
  }, [])
  return null
}
