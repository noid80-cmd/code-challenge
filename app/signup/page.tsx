'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

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

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name } },
    })
    setLoading(false)
    if (error) {
      if (error.message.toLowerCase().includes('already')) {
        setError('이미 가입된 이메일이에요.')
      } else {
        setError(error.message)
      }
      return
    }
    if (data.user) {
      fetch('/api/notify-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      }).catch(() => {})
    }
    setDone(true)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#111118', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14, padding: '14px 18px', fontSize: 15, color: '#eeeeff',
    outline: 'none', boxSizing: 'border-box',
  }

  if (done) return (
    <div style={{ minHeight: '100vh', background: '#09090f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
      <div>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: '#eeeeff', marginBottom: 8 }}>가입 완료!</h2>
        <p style={{ color: '#6666aa', fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>
          이메일 인증 링크를 보냈어요.<br />확인 후 로그인해주세요.
        </p>
        <Link href="/login" style={{ color: '#818cf8', fontWeight: 700, fontSize: 15 }}>로그인하기</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#09090f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>
            🎵
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#eeeeff', marginBottom: 6 }}>회원가입</h1>
          <p style={{ color: '#6666aa', fontSize: 14 }}>매일 코드초견 챌린지</p>
        </div>

        <button onClick={handleGoogle}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px', borderRadius: 14, background: '#111118', border: '1px solid rgba(255,255,255,0.1)', color: '#eeeeff', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.5 15.8 18.9 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C41 35.8 44 30.3 44 24c0-1.3-.1-2.7-.4-3.9z"/>
          </svg>
          Google로 가입하기
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ color: '#444466', fontSize: 12, fontWeight: 600 }}>또는</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        </div>

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="이름" required style={inputStyle} />
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="이메일" required style={inputStyle} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="비밀번호 (6자 이상)" minLength={6} required style={inputStyle} />
          {error && <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1, marginTop: 4 }}>
            {loading ? '가입 중...' : '가입하기'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#444466', fontSize: 14, marginTop: 24 }}>
          이미 계정이 있으신가요?{' '}
          <Link href="/login" style={{ color: '#818cf8', fontWeight: 700 }}>로그인</Link>
        </p>
      </div>
    </div>
  )
}
