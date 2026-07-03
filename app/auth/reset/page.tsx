'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) { window.location.href = '/login'; return }
        setReady(true)
      })
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) { window.location.href = '/login'; return }
        setReady(true)
      })
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 해요.'); return }
    if (password !== confirm) { setError('비밀번호가 일치하지 않아요.'); return }
    setError(''); setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError('오류가 발생했어요: ' + error.message); return }
    setDone(true)
    setTimeout(() => { window.location.href = '/' }, 2000)
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
            boxShadow: '0 12px 40px rgba(240,236,224,0.45)',
          }}>
            <svg width="24" height="20" viewBox="0 0 24 20" fill="none">
              <line x1="1" y1="3.5"  x2="23" y2="3.5"  stroke="rgba(4,7,0,0.9)" strokeWidth="2" strokeLinecap="round" />
              <line x1="1" y1="9.5"  x2="23" y2="9.5"  stroke="rgba(4,7,0,0.9)" strokeWidth="2" strokeLinecap="round" />
              <line x1="1" y1="15.5" x2="16" y2="15.5" stroke="rgba(4,7,0,0.9)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f0ece0', marginBottom: 8 }}>새 비밀번호 설정</h1>
          <p style={{ color: '#807060', fontSize: 14 }}>새로 사용할 비밀번호를 입력해주세요</p>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', color: '#f0ece0' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>✓</div>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>비밀번호가 변경됐어요!</p>
            <p style={{ color: '#807060', fontSize: 14 }}>잠시 후 이동합니다...</p>
          </div>
        ) : !ready ? (
          <p style={{ textAlign: 'center', color: '#807060', fontSize: 14 }}>확인 중...</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="새 비밀번호 (6자 이상)" required minLength={6} style={inputStyle} />
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="비밀번호 확인" required style={inputStyle} />
            {error && <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>{error}</p>}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px', borderRadius: 13, border: 'none', marginTop: 4,
              background: loading ? 'rgba(240,236,224,0.12)' : 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
              color: loading ? '#303028' : '#0a0a08',
              fontSize: 15, fontWeight: 800, cursor: loading ? 'default' : 'pointer',
              boxShadow: loading ? 'none' : '0 6px 24px rgba(240,236,224,0.4)',
            }}>
              {loading ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
