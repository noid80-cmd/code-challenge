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

    const { data } = await supabase
      .from('group_members')
      .select('groups(id, name, description, invite_code, owner_id)')
      .eq('user_id', user.id)

    const gs = (data ?? []).map(m => m.groups as unknown as Group).filter(Boolean)
    setGroups(gs)
    setLoading(false)
  }

  async function createGroup() {
    if (!newName.trim()) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    const { data: group, error: err } = await supabase
      .from('groups')
      .insert({ name: newName.trim(), description: newDesc.trim() || null, owner_id: user.id, invite_code: inviteCode })
      .select()
      .single()

    if (err || !group) { setError('생성 실패: ' + (err?.message ?? '')); return }

    await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id })
    setNewName(''); setNewDesc(''); setShowCreate(false); setError('')
    flash('크루가 만들어졌어요!')
    load()
  }

  async function joinGroup() {
    if (!joinCode.trim()) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }

    const { data: group } = await supabase
      .from('groups')
      .select('id')
      .eq('invite_code', joinCode.trim().toUpperCase())
      .single()

    if (!group) { setError('초대 코드를 찾을 수 없어요'); return }

    const { error: err } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: user.id })

    if (err) {
      setError(err.message.includes('unique') ? '이미 참가한 크루예요' : '참가 실패')
      return
    }
    setJoinCode(''); setError('')
    flash('크루에 참가했어요!')
    load()
  }

  function flash(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(''), 2500)
  }

  const inputStyle: React.CSSProperties = {
    background: '#0e0e1e',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 11, padding: '12px 14px',
    fontSize: 14, color: '#e4e4f8', outline: 'none',
    boxSizing: 'border-box', width: '100%',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#08080f' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,8,15,0.95)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '0 20px', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ color: '#6666aa', fontSize: 13, fontWeight: 700 }}>← 피드</Link>
        <span style={{ fontWeight: 800, fontSize: 16, color: '#e0e0f8', letterSpacing: '-0.02em' }}>내 크루</span>
        <div style={{ width: 48 }} />
      </header>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '28px 16px 100px' }}>

        {/* Join by code */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="초대 코드 입력"
            style={{ ...inputStyle, width: 'auto', flex: 1 }}
            onKeyDown={e => e.key === 'Enter' && joinGroup()}
          />
          <button onClick={joinGroup} style={{
            padding: '12px 16px', borderRadius: 11,
            background: '#4f46e5', color: '#fff',
            fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            참가하기
          </button>
        </div>

        {/* Create button */}
        <button
          onClick={() => { setShowCreate(!showCreate); setError('') }}
          style={{
            width: '100%', padding: '12px',
            borderRadius: 12, marginBottom: showCreate ? 0 : 24,
            background: 'transparent',
            border: '1px dashed rgba(99,102,241,0.3)',
            color: '#6666bb', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {showCreate ? '취소' : '+ 크루 만들기'}
        </button>

        {/* Create form */}
        {showCreate && (
          <div style={{
            background: '#0d0d1e',
            border: '1px solid rgba(99,102,241,0.18)',
            borderRadius: 16, padding: 18, marginBottom: 20, marginTop: 10,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="크루 이름"
                style={inputStyle}
                onKeyDown={e => e.key === 'Enter' && createGroup()}
                autoFocus
              />
              <input
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="한 줄 소개 (선택)"
                style={inputStyle}
              />
              <button onClick={createGroup} style={{
                padding: '12px', borderRadius: 10,
                background: '#4f46e5', color: '#fff',
                fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
              }}>
                만들기
              </button>
            </div>
          </div>
        )}

        {error && <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{error}</p>}
        {msg && <p style={{ color: '#34d399', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{msg}</p>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#333358', fontSize: 14 }}>불러오는 중</div>
        ) : groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '52px 0' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: 'rgba(99,102,241,0.05)',
              border: '1px solid rgba(99,102,241,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 18px',
            }}>
              <svg width="24" height="20" viewBox="0 0 24 20" fill="none">
                <circle cx="8" cy="6" r="3.5" stroke="#4444aa" strokeWidth="1.5"/>
                <circle cx="17" cy="7" r="2.5" stroke="#4444aa" strokeWidth="1.5"/>
                <path d="M1 18c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="#4444aa" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M16 15c2.21 0 4 1.343 4 3" stroke="#4444aa" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p style={{ color: '#44445a', fontSize: 14, fontWeight: 700, marginBottom: 5 }}>참가한 크루가 없어요</p>
            <p style={{ color: '#2a2a42', fontSize: 13 }}>크루를 만들거나 초대 코드로 참가해보세요</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groups.map(g => (
              <Link key={g.id} href={`/groups/${g.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: '#0d0d1e',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 16, padding: '16px 18px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#e4e4f8', marginBottom: 3, letterSpacing: '-0.02em' }}>
                      {g.name}
                    </div>
                    {g.description && (
                      <div style={{ fontSize: 13, color: '#555588' }}>{g.description}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                    {g.owner_id === userId && (
                      <span style={{
                        fontSize: 10, fontWeight: 800, color: '#6366f1',
                        background: 'rgba(99,102,241,0.1)',
                        padding: '2px 8px', borderRadius: 6,
                      }}>
                        방장
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: '#3a3a7a', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                      {g.invite_code}
                    </span>
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
