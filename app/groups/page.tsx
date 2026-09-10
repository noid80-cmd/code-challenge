'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { savePendingInvite, readPendingInvite, clearPendingInvite } from '@/lib/pendingInvite'
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
  const [copiedId, setCopiedId] = useState('')
  const [userId, setUserId] = useState('')

  useEffect(() => { load() }, [])

  // 초대 링크(/groups?code=XXXXXX)로 들어온 경우 자동으로 참가시킨다.
  // useSearchParams 대신 window에서 읽는다 — Suspense 경계를 강제당하지 않는다.
  useEffect(() => {
    const urlCode = new URLSearchParams(window.location.search).get('code')
    if (urlCode) savePendingInvite(urlCode)          // 로그인/가입을 거쳐도 살아남게
    const code = urlCode?.toUpperCase() ?? readPendingInvite()
    if (!code) return
    autoJoin(code)
  }, [])

  async function autoJoin(code: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = `/login?from=${encodeURIComponent('/groups?code=' + code)}`; return }
    const { data: gid, error: err } = await supabase.rpc('join_group_by_code', { code })
    clearPendingInvite()   // 성공이든 실패든 한 번 시도했으면 지운다
    if (err || !gid) {
      setError(err?.message?.includes('invalid code') ? '초대 코드를 찾을 수 없어요' : '참가 실패')
      return
    }
    flash('그룹에 참가했어요!')
    window.history.replaceState({}, '', '/groups')   // 뒤로 가기로 다시 참가 시도되지 않게
    window.location.href = `/groups/${gid}`
  }

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // 초대 링크로 들어온 비로그인 사용자는 코드를 유지한 채 로그인시킨다.
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) savePendingInvite(code)
      const back = code ? `/groups?code=${code.toUpperCase()}` : '/groups'
      window.location.href = `/login?from=${encodeURIComponent(back)}`
      return
    }
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
    // Math.random()의 36진 표기는 길이가 들쭉날쭉해 6자가 안 될 때가 있다.
    // 문자를 하나씩 뽑아 길이를 고정하고, 헷갈리는 O/0/I/1은 뺀다.
    const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const inviteCode = Array.from(
      crypto.getRandomValues(new Uint32Array(6)),
      n => ALPHABET[n % ALPHABET.length]
    ).join('')
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
    if (!user) { window.location.href = '/login?from=/groups'; return }
    // 초대 코드 검증은 서버 함수(join_group_by_code)가 한다. 클라이언트에서
    // groups를 조회해 코드를 맞춰보던 방식은, 그러려면 groups를 전원 공개해야 해서
    // 초대 코드가 그대로 노출됐다. 이제 비멤버는 groups를 읽지 못한다.
    const { data: gid, error: err } = await supabase.rpc('join_group_by_code', { code: joinCode.trim().toUpperCase() })
    if (err) {
      setError(err.message.includes('invalid code') ? '초대 코드를 찾을 수 없어요' : '참가 실패')
      return
    }
    if (!gid) { setError('초대 코드를 찾을 수 없어요'); return }
    setJoinCode(''); setError(''); flash('그룹에 참가했어요!'); load()
  }

  function inviteText(name: string, code: string) {
    return `초견챌린지 "${name}" 그룹 초대
${window.location.origin}/groups?code=${code}

초대 코드: ${code}`
  }

  function copyCode(e: React.MouseEvent, code: string, id: string, name: string) {
    e.preventDefault(); e.stopPropagation()   // 카드 전체가 Link라 이동을 막는다
    navigator.clipboard?.writeText(inviteText(name, code))
    setCopiedId(id); setTimeout(() => setCopiedId(''), 1800)
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
        padding: '0 20px', height: 54, paddingTop: 'calc(env(safe-area-inset-top) + 24px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/chord" style={{ color: '#a8a296', fontSize: 13, fontWeight: 700 }}>← 피드</Link>
        <span style={{ fontWeight: 800, fontSize: 16, color: '#f0ece0', letterSpacing: '-0.02em' }}>내 그룹</span>
        <div style={{ width: 48 }} />
      </header>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '28px 16px 100px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#8f8a7e', marginBottom: 8, letterSpacing: '-0.01em' }}>
          다른 사람에게 받은 초대 코드로 참가
        </div>
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
          color: '#a8a296', fontSize: 14, fontWeight: 700, cursor: 'pointer',
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
          <div style={{ textAlign: 'center', padding: 60, color: '#a5a096', fontSize: 14 }}>불러오는 중</div>
        ) : groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '52px 0' }}>
            <div style={{
              width: 60, height: 60, borderRadius: 18,
              background: 'rgba(240,236,224,0.05)', border: '1px solid rgba(240,236,224,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px',
            }}>
              <svg width="26" height="22" viewBox="0 0 26 22" fill="none">
                <circle cx="9" cy="7" r="4" stroke="#6e6a60" strokeWidth="1.5"/>
                <circle cx="19" cy="8" r="3" stroke="#6e6a60" strokeWidth="1.5"/>
                <path d="M1 20c0-3.866 3.582-7 8-7s8 3.134 8 7" stroke="#6e6a60" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M18 16c2.761 0 5 1.567 5 3.5" stroke="#6e6a60" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p style={{ color: '#8f8a7e', fontSize: 14, fontWeight: 700, marginBottom: 5 }}>참가한 그룹이 없어요</p>
            <p style={{ color: '#a5a096', fontSize: 13 }}>그룹을 만들거나 초대 코드로 참가해보세요</p>
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
                    {g.description && <div style={{ fontSize: 13, color: '#8f8a7e' }}>{g.description}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    {g.owner_id === userId && (
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#f0ece0', background: 'rgba(240,236,224,0.1)', border: '1px solid rgba(240,236,224,0.25)', padding: '2px 8px', borderRadius: 6 }}>
                        방장
                      </span>
                    )}
                    <button onClick={e => copyCode(e, g.invite_code, g.id, g.name)} style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      background: 'rgba(240,236,224,0.07)', border: '1px solid rgba(240,236,224,0.18)',
                      borderRadius: 9, padding: '5px 9px', cursor: 'pointer',
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: '#a8a296', letterSpacing: '0.06em' }}>초대링크</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#f0ece0', letterSpacing: '0.12em' }}>
                        {copiedId === g.id ? '링크 복사됨' : g.invite_code}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a8a296" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="12" height="12" rx="2" />
                        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                      </svg>
                    </button>
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
