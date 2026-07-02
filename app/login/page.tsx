'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.5 15.8 18.9 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.3 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C41 35.8 44 30.3 44 24c0-1.3-.1-2.7-.4-3.9z"/>
  </svg>
)

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

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
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) setError('Google 로그인 오류: ' + error.message)
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setResetLoading(true)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })
    setResetLoading(false)
    setResetSent(true)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(13,13,12,0.8)',
    border: '1px solid rgba(240,236,224,0.18)',
    borderRadius: 12, padding: '14px 18px',
    fontSize: 15, color: '#f0ece0',
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #080808 0%, #0a0a0a 60%, #090909 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(240,236,224,0.07) 0%, transparent 70%)',
        }} />
      </div>

      <div style={{ width: '100%', maxWidth: 380, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 18,
            background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 22px',
            boxShadow: '0 12px 40px rgba(240,236,224,0.45), 0 4px 12px rgba(200,196,176,0.3)',
          }}>
            <svg width="24" height="20" viewBox="0 0 24 20" fill="none">
              <line x1="1" y1="3.5"  x2="23" y2="3.5"  stroke="rgba(4,7,0,0.9)" strokeWidth="2" strokeLinecap="round" />
              <line x1="1" y1="9.5"  x2="23" y2="9.5"  stroke="rgba(4,7,0,0.9)" strokeWidth="2" strokeLinecap="round" />
              <line x1="1" y1="15.5" x2="16" y2="15.5" stroke="rgba(4,7,0,0.9)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 8, color: '#f0ece0' }}>
            {resetMode ? '비밀번호 찾기' : '코드 챌린지'}
          </h1>
          <p style={{ color: '#807060', fontSize: 14, fontWeight: 500 }}>
            {resetMode ? '가입한 이메일로 재설정 링크를 보내드려요' : '매일 새로운 코드 진행을 연주하고 공유하세요'}
          </p>
        </div>

        {resetMode ? (
          resetSent ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#f0ece0', fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
                ✉️ 이메일을 확인해주세요<br />
                <span style={{ color: '#807060', fontSize: 13 }}>재설정 링크를 보냈어요.</span>
              </p>
              <button onClick={() => { setResetMode(false); setResetSent(false); setResetEmail('') }}
                style={{ color: '#807060', background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
                ← 로그인으로 돌아가기
              </button>
            </div>
          ) : (
            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                placeholder="가입한 이메일" required style={inputStyle} />
              <button type="submit" disabled={resetLoading} style={{
                width: '100%', padding: '14px', borderRadius: 13, border: 'none', marginTop: 4,
                background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                color: '#0a0a08', fontSize: 15, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 6px 24px rgba(240,236,224,0.35)',
              }}>
                {resetLoading ? '전송 중...' : '재설정 링크 보내기'}
              </button>
              <button type="button" onClick={() => { setResetMode(false); setResetEmail('') }}
                style={{ color: '#807060', background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
                ← 로그인으로 돌아가기
              </button>
            </form>
          )
        ) : (
          <>
            <button onClick={handleGoogle} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '13px', borderRadius: 13,
              background: 'rgba(8,12,0,0.7)', border: '1px solid rgba(240,236,224,0.18)',
              color: '#a0988c', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 16,
            }}>
              <GoogleIcon />
              Google로 계속하기
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(240,236,224,0.1)' }} />
              <span style={{ color: '#807060', fontSize: 12, fontWeight: 600 }}>또는</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(240,236,224,0.1)' }} />
            </div>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="이메일" required style={inputStyle} />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="비밀번호" required style={inputStyle} />
              {error && <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>{error}</p>}
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '14px', borderRadius: 13, border: 'none', marginTop: 4,
                background: loading ? 'rgba(240,236,224,0.12)' : 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                color: loading ? '#303028' : '#0a0a08',
                fontSize: 15, fontWeight: 800, cursor: loading ? 'default' : 'pointer',
                boxShadow: loading ? 'none' : '0 6px 24px rgba(240,236,224,0.4)',
              }}>
                {loading ? '로그인 중...' : '로그인'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button onClick={() => setResetMode(true)}
                style={{ color: '#807060', background: 'none', border: 'none', fontSize: 13, cursor: 'pointer' }}>
                비밀번호를 잊으셨나요?
              </button>
            </div>

            <p style={{ textAlign: 'center', color: '#807060', fontSize: 14, marginTop: 14 }}>
              계정이 없으신가요?{' '}
              <Link href="/signup" style={{ fontWeight: 800, color: '#f0ece0' }}>회원가입</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
