'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// 눈에 띄지 않되 찾으면 있는 자리에 둔다. 평소엔 글자 버튼 하나로 접혀 있고,
// 누르면 그 자리에서 펼쳐진다 — 새 화면으로 보내면 쓰다 만 내용이 날아간다.
export default function BugReport() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function send() {
    const message = text.trim()
    if (!message) return
    setSending(true); setError('')
    try {
      const supabase = createClient()
      const { data: s } = await supabase.auth.getSession()
      const token = s.session?.access_token
      if (!token) { setError('로그인이 필요해요'); setSending(false); return }
      const res = await fetch('/api/report-bug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message, page: window.location.pathname }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? '전송에 실패했어요')
        setSending(false); return
      }
      setDone(true); setText('')
      setTimeout(() => { setDone(false); setOpen(false) }, 2600)
    } catch {
      setError('전송에 실패했어요')
    }
    setSending(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        background: 'none', border: 'none', color: '#9a9083', fontSize: 11, fontWeight: 600,
        cursor: 'pointer', padding: 8, textDecoration: 'underline',
      }}>버그 신고</button>
    )
  }

  return (
    <div style={{
      textAlign: 'left', marginTop: 8,
      background: 'linear-gradient(145deg, #111110, #0d0d0c)',
      border: '1px solid rgba(240,236,224,0.1)',
      borderRadius: 16, padding: '16px 16px 14px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#e0dcd0', marginBottom: 4 }}>버그 신고</div>
      <div style={{ fontSize: 11.5, color: '#9a9083', marginBottom: 10, lineHeight: 1.6 }}>
        어떤 화면에서 무엇이 안 됐는지 적어주시면 큰 도움이 돼요.
      </div>
      <textarea
        value={text} onChange={e => setText(e.target.value)} rows={4} maxLength={2000}
        placeholder="예) 리듬 챌린지에서 악보가 안 보여요"
        style={{
          width: '100%', boxSizing: 'border-box', resize: 'vertical',
          background: 'rgba(13,13,12,0.8)', border: '1px solid rgba(240,236,224,0.15)',
          borderRadius: 11, padding: '11px 12px', fontSize: 13.5, color: '#f0ece0',
          outline: 'none', lineHeight: 1.6, fontFamily: 'inherit',
        }} />
      {error && <div style={{ fontSize: 12, color: '#e07060', marginTop: 8 }}>{error}</div>}
      {done && <div style={{ fontSize: 12, color: '#8fd08f', marginTop: 8 }}>보냈어요. 감사합니다!</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={() => { setOpen(false); setError('') }} style={{
          flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
          background: 'transparent', border: '1px solid rgba(240,236,224,0.18)',
          color: '#a8a296', fontSize: 13, fontWeight: 700,
        }}>닫기</button>
        <button onClick={send} disabled={sending || !text.trim()} style={{
          flex: 1, padding: '10px', borderRadius: 10, border: 'none',
          cursor: sending || !text.trim() ? 'default' : 'pointer',
          background: sending || !text.trim()
            ? 'rgba(240,236,224,0.15)' : 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
          color: sending || !text.trim() ? '#8b857a' : '#0a0a08',
          fontSize: 13, fontWeight: 800,
        }}>{sending ? '보내는 중...' : '보내기'}</button>
      </div>
    </div>
  )
}
