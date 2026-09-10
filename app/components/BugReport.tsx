'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Mine = {
  id: string
  message: string
  admin_reply: string | null
  resolved_at: string | null
  created_at: string
}

// 눈에 띄지 않되 찾으면 있는 자리에 둔다. 평소엔 글자 버튼 하나로 접혀 있고,
// 누르면 그 자리에서 펼쳐진다 — 새 화면으로 보내면 쓰다 만 내용이 날아간다.
export default function BugReport() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [mine, setMine] = useState<Mine[]>([])

  // 내가 보낸 신고는 RLS상 본인에게 보인다(user_id = auth.uid()).
  const loadMine = useCallback(async () => {
    const supabase = createClient()
    const uid = (await supabase.auth.getSession()).data.session?.user?.id
    if (!uid) return
    const { data } = await supabase.from('bug_reports')
      .select('id, message, admin_reply, resolved_at, created_at')
      .eq('user_id', uid).order('created_at', { ascending: false }).limit(5)
    setMine((data as Mine[]) ?? [])
  }, [])

  // 답장 알림은 ?bug=1 로 데려온다. 열자마자 답장이 보여야 알림이 헛되지 않는다.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('bug') === '1') setOpen(true)
  }, [])

  useEffect(() => { if (open) loadMine() }, [open, loadMine])

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
      loadMine()
      setTimeout(() => setDone(false), 2600)
    } catch {
      setError('전송에 실패했어요')
    }
    setSending(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        background: 'none', border: 'none', color: '#b0a89c', fontSize: 11, fontWeight: 600,
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
      <div style={{ fontSize: 11.5, color: '#b0a89c', marginBottom: 10, lineHeight: 1.6 }}>
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
          color: '#c0bab0', fontSize: 13, fontWeight: 700,
        }}>닫기</button>
        <button onClick={send} disabled={sending || !text.trim()} style={{
          flex: 1, padding: '10px', borderRadius: 10, border: 'none',
          cursor: sending || !text.trim() ? 'default' : 'pointer',
          background: sending || !text.trim()
            ? 'rgba(240,236,224,0.15)' : 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
          color: sending || !text.trim() ? '#a8a296' : '#0a0a08',
          fontSize: 13, fontWeight: 800,
        }}>{sending ? '보내는 중...' : '보내기'}</button>
      </div>

      {mine.length > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px solid rgba(240,236,224,0.1)', paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#c0bab0', marginBottom: 8 }}>내가 보낸 신고</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mine.map(m => (
              <div key={m.id} style={{ background: 'rgba(13,13,12,0.6)', borderRadius: 11, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10.5, fontWeight: 800, padding: '2px 7px', borderRadius: 6,
                    background: m.resolved_at ? 'rgba(143,208,143,0.15)' : 'rgba(240,236,224,0.1)',
                    color: m.resolved_at ? '#8fd08f' : '#c0bab0',
                  }}>{m.resolved_at ? '처리됨' : '확인 중'}</span>
                  <span style={{ fontSize: 10.5, color: '#b0a89c', marginLeft: 'auto' }}>
                    {new Date(m.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: '#e0dcd0', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {m.message}
                </div>
                {m.admin_reply && (
                  <div style={{ marginTop: 8, borderLeft: '2px solid #c8c4b0', paddingLeft: 9 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, color: '#c8c4b0', marginBottom: 2 }}>답장</div>
                    <div style={{ fontSize: 12.5, color: '#e0dcd0', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {m.admin_reply}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
