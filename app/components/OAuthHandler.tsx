'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isNativeApp } from '@/lib/capacitor'

export function OAuthHandler() {
  // Capacitor 네이티브 앱: 인앱 브라우저(@capacitor/browser)로 구글 로그인을
  // 열었다가 choekyun://auth-callback?code=... 로 돌아오면, 이 커스텀 URL
  // 스킴이 열린 걸 App 플러그인이 감지해서 알려준다. 인앱 브라우저를 닫고
  // code를 뽑아서 앱의 WKWebView/WebView 안에서 직접 exchangeCodeForSession
  // 하고 홈으로 이동한다.
  useEffect(() => {
    if (!isNativeApp()) return
    let cleanup: (() => void) | undefined
    ;(async () => {
      const [{ App }, { Browser }] = await Promise.all([
        import('@capacitor/app'),
        import('@capacitor/browser'),
      ])
      const sub = await App.addListener('appUrlOpen', async ({ url }) => {
        if (!url.startsWith('choekyun://auth-callback')) return
        await Browser.close().catch(() => {})
        const code = new URL(url).searchParams.get('code')
        if (!code) return
        const supabase = createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) { window.location.href = '/login?err=' + encodeURIComponent(error.message); return }
        window.location.href = '/'
      })
      cleanup = () => { sub.remove() }
    })()
    return () => cleanup?.()
  }, [])

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
