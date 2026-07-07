'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function OAuthHandler() {
  const router = useRouter()
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('_oauthcode')
    if (!code) return
    // Remove code from URL immediately
    const clean = new URL(window.location.href)
    clean.searchParams.delete('_oauthcode')
    window.history.replaceState({}, '', clean.toString())
    // Exchange in PWA context where code_verifier cookie exists
    const supabase = createClient()
    supabase.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
      if (error) { router.push('/login?err=' + encodeURIComponent(error.message)); return }
      try { await fetch('/api/refresh-session', { method: 'POST' }) } catch {}
      if (data.session?.refresh_token) localStorage.setItem('sb_rt', data.session.refresh_token)
      router.refresh()
    })
  }, [router])
  return null
}
