'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function SessionSync() {
  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.refresh_token) {
        localStorage.setItem('sb_rt', session.refresh_token)
      } else if (!session) {
        localStorage.removeItem('sb_rt')
      }
    })
    return () => subscription.unsubscribe()
  }, [])
  return null
}
