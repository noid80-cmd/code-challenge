'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError('이메일 또는 비밀번호가 올바르지 않아요.'); return }
    router.push('/')
  }

  async function handleGoogle() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0e0e1e', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12, padding: '14px 18px', fontSize: 15, color: '#e4e4f8',
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#08080f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px',
          }}>
            <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
              <line x1="1" y1="3"  x2="19" y2="3"  stroke="rgba(255,255,255,0.8)" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="1" y1="8"  x2="19" y2="8"  stroke="rgba(255,255,255,0.8)" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="1" y1="13" x2="13" y2="13" stroke="rgba(255,255,255,0.8)" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#e4e4f8', marginBottom: 6, letterSpacing: '-0.02em' }}>코드 챌린지</h1>
          <p style={{ color: '#555588', fontSize: 14 }}>로그인하고 챌린지에 참여하세요</p>
        </div>

        <button onClick={handleGoogle}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '13px', borderRadius: 12, background: '#0e0e1e', border: '1px solid rgba(255,255,255,0.09)', color: '#ccccee', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.5 15.8 18.9 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C41 35.8 44 30.3 44 24c0-1.3-.1-2.7-.4-3.9z"/>
          </svg>
          Google로 로그인
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          <span style={{ color: '#333358', fontSize: 12, fontWeight: 600 }}>또는</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="이메일" required style={inputStyle} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="비밀번호" required style={inputStyle} />
          {error && <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: loading ? '#1a1a30' : '#4f46e5', color: loading ? '#444466' : '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer', marginTop: 4 }}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#333358', fontSize: 14, marginTop: 24 }}>
          계정이 없으신가요?{' '}
          <Link href="/signup" style={{ color: '#7777cc', fontWeight: 700 }}>회원가입</Link>
        </p>
      </div>
    </div>
  )
}
