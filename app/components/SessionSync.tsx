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
        // Only clear on explicit sign-out. iOS can clear cookies on background
        // causing session=null without the user logging out — keep sb_rt so
        // the login recovery flow can restore the session automatically.
        localStorage.removeItem('sb_rt')
      }
    })
    return () => subscription.unsubscribe()
  }, [])
  return null
}
