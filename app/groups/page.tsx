'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Group = { id: string; name: string; description: string | null; invite_code: string; owner_id: string }

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [userId, setUserId] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }
    setUserId(user.id)
    const { data } = await supabase.from('group_members').select('groups(id, name, description, invite_code, owner_id)').eq('user_id', user.id)
    setGroups((data ?? []).map(m => m.groups as unknown as Group).filter(Boolean))
    setLoading(false)
  }

  async function createGroup() {
    if (!newName.trim()) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    const { data: group, error: err } = await supabase
      .from('groups').insert({ name: newName.trim(), description: newDesc.trim() || null, owner_id: user.id, invite_code: inviteCode })
      .select().single()
    if (err || !group) { setError('생성 실패: ' + (err?.message ?? '')); return }
    await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id })
    setNewName(''); setNewDesc(''); setShowCreate(false); setError('')
    flash('그룹이 만들어졌어요!'); load()
  }

  async function joinGroup() {
    if (!joinCode.trim()) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }
    const { data: group } = await supabase.from('groups').select('id').eq('invite_code', joinCode.trim().toUpperCase()).single()
    if (!group) { setError('초대 코드를 찾을 수 없어요'); return }
    const { error: err } = await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id })
    if (err) { setError(err.message.includes('unique') ? '이미 참가한 그룹이에요' : '참가 실패'); return }
    setJoinCode(''); setError(''); flash('그룹에 참가했어요!'); load()
  }

  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(''), 2500) }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(13,13,12,0.8)', border: '1px solid rgba(240,236,224,0.15)',
    borderRadius: 11, padding: '12px 14px',
    fontSize: 14, color: '#f0ece0', outline: 'none', boxSizing: 'border-box', width: '100%',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #080808 0%, #0a0a0a 60%, #090909 100%)' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,8,8,0.88)', backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(240,236,224,0.12)',
        padding: '0 20px', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ color: '#605850', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          피드
        </Link>
        <span style={{ fontWeight: 800, fontSize: 16, color: '#f0ece0', letterSpacing: '-0.02em' }}>내 그룹</span>
        <div style={{ width: 48 }} />
      </header>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '28px 16px max(120px, calc(100px + env(safe-area-inset-bottom)))' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="초대 코드 입력"
            style={{ ...inputStyle, width: 'auto', flex: 1 }}
            onKeyDown={e => e.key === 'Enter' && joinGroup()} />
          <button onClick={joinGroup} style={{
            padding: '12px 16px', borderRadius: 11,
            background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
            color: '#0a0a08', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            boxShadow: '0 4px 14px rgba(240,236,224,0.35)',
          }}>참가하기</button>
        </div>

        <button onClick={() => { setShowCreate(!showCreate); setError('') }} style={{
          width: '100%', padding: '12px', borderRadius: 12, marginBottom: showCreate ? 0 : 24,
          background: 'transparent', border: '1px dashed rgba(240,236,224,0.2)',
          color: '#605850', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>
          {showCreate ? '취소' : '+ 그룹 만들기'}
        </button>

        {showCreate && (
          <div style={{
            background: 'linear-gradient(145deg, #111110, #0d0d0c)',
            border: '1px solid rgba(240,236,224,0.18)', borderRadius: 18, padding: 18, marginBottom: 20, marginTop: 10,
            boxShadow: '0 8px 32px rgba(240,236,224,0.06)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="그룹 이름"
                style={inputStyle} autoFocus onKeyDown={e => e.key === 'Enter' && createGroup()} />
              <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="한 줄 소개 (선택)" style={inputStyle} />
              <button onClick={createGroup} style={{
                padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                color: '#0a0a08', fontSize: 14, fontWeight: 700,
                boxShadow: '0 4px 16px rgba(240,236,224,0.35)',
              }}>만들기</button>
            </div>
          </div>
        )}

        {error && <p style={{ color: '#f0ece0', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{error}</p>}
        {msg && <p style={{ color: '#f8f4ec', fontSize: 13, textAlign: 'center', marginBottom: 12, fontWeight: 700 }}>{msg}</p>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#1a1a18', fontSize: 14 }}>불러오는 중</div>
        ) : groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '52px 0' }}>
            <div style={{
              width: 60, height: 60, borderRadius: 18,
              background: 'rgba(240,236,224,0.05)', border: '1px solid rgba(240,236,224,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px',
            }}>
              <svg width="26" height="22" viewBox="0 0 26 22" fill="none">
                <circle cx="9" cy="7" r="4" stroke="#303028" strokeWidth="1.5"/>
                <circle cx="19" cy="8" r="3" stroke="#303028" strokeWidth="1.5"/>
                <path d="M1 20c0-3.866 3.582-7 8-7s8 3.134 8 7" stroke="#303028" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M18 16c2.761 0 5 1.567 5 3.5" stroke="#303028" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p style={{ color: '#303028', fontSize: 14, fontWeight: 700, marginBottom: 5 }}>참가한 그룹이 없어요</p>
            <p style={{ color: '#1a1a18', fontSize: 13 }}>그룹을 만들거나 초대 코드로 참가해보세요</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groups.map(g => (
              <Link key={g.id} href={`/groups/${g.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: 'linear-gradient(145deg, #111110, #0d0d0c)',
                  border: '1px solid rgba(240,236,224,0.1)',
                  borderRadius: 18, padding: '18px 20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#e0dcd0', marginBottom: 4 }}>{g.name}</div>
                    {g.description && <div style={{ fontSize: 13, color: '#303028' }}>{g.description}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    {g.owner_id === userId && (
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#f0ece0', background: 'rgba(240,236,224,0.1)', border: '1px solid rgba(240,236,224,0.25)', padding: '2px 8px', borderRadius: 6 }}>
                        방장
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: '#303028', fontWeight: 700, letterSpacing: '0.1em' }}>{g.invite_code}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
