'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { savePendingInvite, readPendingInvite, clearPendingInvite } from '@/lib/pendingInvite'
import Link from 'next/link'

type Group = {
  id: string; name: string; description: string | null
  owner_id: string; is_public: boolean
}

export default function GroupsPage() {
  const [mine, setMine] = useState<Group[]>([])
  const [others, setOthers] = useState<Group[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPublic, setNewPublic] = useState(true)
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [copiedId, setCopiedId] = useState('')
  const [userId, setUserId] = useState('')
  // 비공개방은 비번을 그 카드 자리에서 받는다. 새 화면으로 보내면
  // 어느 방에 들어가려던 건지 잊는다.
  const [pwFor, setPwFor] = useState('')
  const [pwInput, setPwInput] = useState('')
  const [busy, setBusy] = useState('')

  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(''), 2500) }

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login?from=/groups'; return }
    setUserId(user.id)

    const [{ data: memberRows }, { data: allGroups }, { data: countRows }] = await Promise.all([
      supabase.from('group_members').select('group_id').eq('user_id', user.id),
      // invite_code 와 비번 해시는 컬럼 권한에서 빠져 있어 열 이름을 적으면 안 된다.
      supabase.from('groups').select('id, name, description, owner_id, is_public').order('created_at', { ascending: false }),
      supabase.rpc('group_member_counts'),
    ])

    const myIds = new Set((memberRows ?? []).map((r: { group_id: string }) => r.group_id))
    const list = (allGroups ?? []) as Group[]
    setMine(list.filter(g => myIds.has(g.id)))
    setOthers(list.filter(g => !myIds.has(g.id)))
    setCounts(Object.fromEntries(
      ((countRows ?? []) as { group_id: string; cnt: number }[]).map(r => [r.group_id, Number(r.cnt)])
    ))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // 링크로 들어온 경우. 공개방이면 바로 넣어주고, 비공개방이면 비번을 묻는다.
  // 예전 초대 코드 링크(?code=)도 그대로 살려둔다.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const gid = params.get('g')
    if (code) { savePendingInvite(code); autoJoinByCode(code.toUpperCase()); return }
    const pending = readPendingInvite()
    if (pending) { autoJoinByCode(pending); return }
    if (gid) openByLink(gid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function autoJoinByCode(code: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = `/login?from=${encodeURIComponent('/groups?code=' + code)}`; return }
    const { data: gid, error: err } = await supabase.rpc('join_group_by_code', { code })
    clearPendingInvite()
    window.history.replaceState({}, '', '/groups')
    if (err || !gid) { setError('초대 코드를 찾을 수 없어요'); return }
    flash('그룹에 참가했어요!')
    load()
  }

  async function openByLink(gid: string) {
    const supabase = createClient()
    const { data: g } = await supabase.from('groups').select('id, is_public').eq('id', gid).maybeSingle()
    window.history.replaceState({}, '', '/groups')
    if (!g) { setError('그룹을 찾을 수 없어요'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: already } = await supabase.from('group_members')
      .select('id').eq('group_id', gid).eq('user_id', user.id).maybeSingle()
    if (already) { window.location.href = `/groups/${gid}`; return }
    if (g.is_public) joinPublic(gid)
    else setPwFor(gid)
  }

  async function createGroup() {
    if (!newName.trim()) return
    if (!newPublic && newPassword.trim().length < 2) { setError('비공개방은 비밀번호를 정해주세요'); return }
    setBusy('create')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setBusy(''); return }

    // invite_code 는 아직 필수 칸이라 채워 넣는다. 화면에서는 쓰지 않는다 —
    // 이제 문은 링크와 비밀번호 둘뿐이다.
    const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const inviteCode = Array.from(
      crypto.getRandomValues(new Uint32Array(6)),
      n => ALPHABET[n % ALPHABET.length]
    ).join('')

    const { data: group, error: err } = await supabase.from('groups')
      .insert({
        name: newName.trim(), description: newDesc.trim() || null,
        owner_id: user.id, invite_code: inviteCode, is_public: newPublic,
      })
      .select('id').single()
    if (err || !group) { setError('생성 실패: ' + (err?.message ?? '')); setBusy(''); return }

    await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id })
    if (!newPublic) {
      const { error: pwErr } = await supabase.rpc('set_group_password', {
        p_group_id: group.id, p_password: newPassword.trim(),
      })
      if (pwErr) setError('비밀번호 설정 실패: ' + pwErr.message)
    }
    setNewName(''); setNewDesc(''); setNewPassword(''); setNewPublic(true)
    setShowCreate(false); setBusy('')
    flash('그룹이 만들어졌어요!')
    load()
  }

  async function joinPublic(gid: string) {
    setBusy(gid)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setBusy(''); return }
    // RLS가 막으면 조용히 0행이다. 반영된 행을 확인한다.
    const { data, error: err } = await supabase.from('group_members')
      .insert({ group_id: gid, user_id: user.id }).select('id')
    setBusy('')
    if (err || !data?.length) { setError('참가하지 못했어요'); return }
    flash('그룹에 참가했어요!')
    load()
  }

  async function joinPrivate(gid: string) {
    if (!pwInput.trim()) return
    setBusy(gid)
    const supabase = createClient()
    const { error: err } = await supabase.rpc('join_group_with_password', {
      p_group_id: gid, p_password: pwInput.trim(),
    })
    setBusy('')
    if (err) {
      setError(err.message.includes('wrong password') ? '비밀번호가 맞지 않아요' : '참가하지 못했어요')
      return
    }
    setPwFor(''); setPwInput(''); setError('')
    flash('그룹에 참가했어요!')
    load()
  }

  // 만들 때만 고르게 해놔서, 이미 있는 방은 바꿀 방법이 없었다.
  // 비공개로 돌릴 때는 비밀번호를 같이 받는다 — 비번 없는 비공개방은
  // 아무도 새로 못 들어오는 방이 된다.
  async function togglePublic(g: Group) {
    const supabase = createClient()
    if (g.is_public) {
      const pw = window.prompt(`"${g.name}" 방을 비공개로 돌립니다.
들어올 때 쓸 비밀번호를 정해주세요.`)
      if (pw === null) return
      if (pw.trim().length < 2) { setError('비밀번호를 정해주세요'); return }
      const { error: pwErr } = await supabase.rpc('set_group_password', {
        p_group_id: g.id, p_password: pw.trim(),
      })
      if (pwErr) { setError('비밀번호 설정 실패'); return }
    }
    const { data, error: err } = await supabase.from('groups')
      .update({ is_public: !g.is_public }).eq('id', g.id).select('id, is_public')
    if (err || !data?.length) { setError('바꾸지 못했어요'); return }
    flash(g.is_public ? '비공개방으로 바꿨어요' : '공개방으로 바꿨어요')
    load()
  }

  async function changePassword(g: Group) {
    const next = window.prompt(`"${g.name}" 방의 새 비밀번호를 정해주세요.\n(예전 비밀번호는 저장돼 있지 않아 확인할 수 없습니다)`)
    if (next === null) return
    const supabase = createClient()
    const { error: err } = await supabase.rpc('set_group_password', {
      p_group_id: g.id, p_password: next.trim(),
    })
    if (err) { setError('비밀번호 변경 실패'); return }
    flash('비밀번호를 바꿨어요')
  }

  function copyLink(e: React.MouseEvent, g: Group) {
    e.preventDefault(); e.stopPropagation()
    const text = `초견챌린지 "${g.name}" 그룹\n${window.location.origin}/groups?g=${g.id}` +
      (g.is_public ? '' : '\n\n(비공개방이라 비밀번호가 필요해요)')
    navigator.clipboard?.writeText(text)
    setCopiedId(g.id); setTimeout(() => setCopiedId(''), 1800)
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(13,13,12,0.8)', border: '1px solid rgba(240,236,224,0.15)',
    borderRadius: 11, padding: '12px 14px',
    fontSize: 14, color: '#f0ece0', outline: 'none', boxSizing: 'border-box', width: '100%',
  }

  const cardStyle: React.CSSProperties = {
    background: 'linear-gradient(145deg, #111110, #0d0d0c)',
    border: '1px solid rgba(240,236,224,0.1)',
    borderRadius: 18, padding: '16px 18px',
  }

  function Lock() {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #080808 0%, #0a0a0a 60%, #090909 100%)' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,8,8,0.88)', backdropFilter: 'blur(24px)',
        padding: '0 20px', height: 54, paddingTop: 'calc(env(safe-area-inset-top) + 24px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/chord" style={{ color: '#c0bab0', fontSize: 13, fontWeight: 700 }}>← 피드</Link>
        <span style={{ fontWeight: 800, fontSize: 16, color: '#f0ece0', letterSpacing: '-0.02em' }}>그룹</span>
        <div style={{ width: 48 }} />
      </header>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 100px' }}>
        <button onClick={() => { setShowCreate(!showCreate); setError('') }} style={{
          width: '100%', padding: '12px', borderRadius: 12, marginBottom: showCreate ? 10 : 22,
          background: 'transparent', border: '1px dashed rgba(240,236,224,0.2)',
          color: '#c0bab0', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>{showCreate ? '취소' : '+ 그룹 만들기'}</button>

        {showCreate && (
          <div style={{ ...cardStyle, border: '1px solid rgba(240,236,224,0.18)', padding: 18, marginBottom: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="그룹 이름"
                style={inputStyle} autoFocus />
              <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="한 줄 소개 (선택)" style={inputStyle} />

              <div style={{ display: 'flex', gap: 8 }}>
                {[{ v: true, label: '공개방', desc: '누구나 참가' }, { v: false, label: '비공개방', desc: '비밀번호 필요' }].map(o => (
                  <button key={String(o.v)} onClick={() => setNewPublic(o.v)} style={{
                    flex: 1, padding: '10px', borderRadius: 11, cursor: 'pointer', textAlign: 'left',
                    background: newPublic === o.v ? 'rgba(240,236,224,0.1)' : 'transparent',
                    border: newPublic === o.v ? '1px solid rgba(240,236,224,0.35)' : '1px solid rgba(240,236,224,0.14)',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: newPublic === o.v ? '#f0ece0' : '#c0bab0' }}>{o.label}</div>
                    <div style={{ fontSize: 11, color: '#a8a296', marginTop: 2 }}>{o.desc}</div>
                  </button>
                ))}
              </div>

              {!newPublic && (
                <>
                  <input value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    placeholder="방 비밀번호" style={inputStyle} />
                  <div style={{ fontSize: 11.5, color: '#a8a296', lineHeight: 1.6, marginTop: -4 }}>
                    비밀번호는 저장해두지 않고 잠그는 데만 씁니다 — 나중에 다시 볼 수 없고
                    바꾸는 것만 됩니다. 수업에서 불러줄 수 있는 말로 정하세요.
                  </div>
                </>
              )}

              <button onClick={createGroup} disabled={busy === 'create'} style={{
                padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                color: '#0a0a08', fontSize: 14, fontWeight: 700,
              }}>{busy === 'create' ? '만드는 중...' : '만들기'}</button>
            </div>
          </div>
        )}

        {error && <p style={{ color: '#e8a99c', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{error}</p>}
        {msg && <p style={{ color: '#f8f4ec', fontSize: 13, textAlign: 'center', marginBottom: 12, fontWeight: 700 }}>{msg}</p>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#c0bab0', fontSize: 14 }}>불러오는 중</div>
        ) : (
          <>
            {mine.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#a8a296', marginBottom: 10 }}>내 그룹</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 26 }}>
                  {mine.map(g => (
                    <Link key={g.id} href={`/groups/${g.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 16, fontWeight: 800, color: '#e0dcd0' }}>{g.name}</span>
                            {!g.is_public && <span style={{ color: '#a8a296', display: 'flex' }}><Lock /></span>}
                            {g.owner_id === userId && (
                              <span style={{
                                fontSize: 10, fontWeight: 800, color: '#f0ece0',
                                background: 'rgba(240,236,224,0.1)', border: '1px solid rgba(240,236,224,0.25)',
                                padding: '1px 7px', borderRadius: 6,
                              }}>방장</span>
                            )}
                          </div>
                          <div style={{ fontSize: 12.5, color: '#a8a296', marginTop: 3 }}>
                            {[g.description, `${counts[g.id] ?? 0}명`].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                          <button onClick={e => copyLink(e, g)} style={{
                            background: 'rgba(240,236,224,0.07)', border: '1px solid rgba(240,236,224,0.18)',
                            borderRadius: 9, padding: '6px 10px', cursor: 'pointer',
                            fontSize: 11.5, fontWeight: 800, color: '#f0ece0',
                          }}>{copiedId === g.id ? '복사됨' : '링크 복사'}</button>
                          {g.owner_id === userId && (
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              {!g.is_public && (
                                <button onClick={e => { e.preventDefault(); e.stopPropagation(); changePassword(g) }} style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  fontSize: 11, fontWeight: 700, color: '#a8a296', padding: 0,
                                }}>비밀번호 변경</button>
                              )}
                              <button onClick={e => { e.preventDefault(); e.stopPropagation(); togglePublic(g) }} style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontSize: 11, fontWeight: 700, color: '#a8a296', padding: 0,
                              }}>{g.is_public ? '비공개로' : '공개로'}</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}

            <div style={{ fontSize: 12, fontWeight: 800, color: '#a8a296', marginBottom: 10 }}>
              둘러보기 {others.length > 0 && <span style={{ color: '#8f8a7e' }}>({others.length})</span>}
            </div>
            {others.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 0', color: '#a8a296', fontSize: 13 }}>
                아직 다른 그룹이 없어요
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {others.map(g => (
                  <div key={g.id} style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 15.5, fontWeight: 800, color: '#e0dcd0' }}>{g.name}</span>
                          {!g.is_public && <span style={{ color: '#a8a296', display: 'flex' }}><Lock /></span>}
                        </div>
                        <div style={{ fontSize: 12.5, color: '#a8a296', marginTop: 3 }}>
                          {[g.description, `${counts[g.id] ?? 0}명`].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <button
                        onClick={() => g.is_public
                          ? joinPublic(g.id)
                          : (setPwFor(pwFor === g.id ? '' : g.id), setPwInput(''), setError(''))}
                        disabled={busy === g.id}
                        style={{
                          flexShrink: 0, padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                          border: g.is_public ? 'none' : '1px solid rgba(240,236,224,0.2)',
                          background: g.is_public ? 'linear-gradient(135deg, #f8f4ec, #c8c4b0)' : 'transparent',
                          color: g.is_public ? '#0a0a08' : '#c0bab0',
                          fontSize: 12.5, fontWeight: 800,
                        }}>
                        {busy === g.id ? '...' : g.is_public ? '참가' : '비밀번호'}
                      </button>
                    </div>

                    {pwFor === g.id && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <input value={pwInput} onChange={e => setPwInput(e.target.value)}
                          placeholder="방 비밀번호" autoFocus
                          onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) joinPrivate(g.id) }}
                          style={{ ...inputStyle, flex: 1, padding: '10px 12px', fontSize: 13 }} />
                        <button onClick={() => joinPrivate(g.id)} disabled={busy === g.id || !pwInput.trim()} style={{
                          padding: '10px 14px', borderRadius: 10, border: 'none',
                          cursor: pwInput.trim() ? 'pointer' : 'default',
                          background: pwInput.trim() ? 'linear-gradient(135deg, #f8f4ec, #c8c4b0)' : 'rgba(240,236,224,0.12)',
                          color: pwInput.trim() ? '#0a0a08' : '#a8a296',
                          fontSize: 12.5, fontWeight: 800, flexShrink: 0,
                        }}>참가</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
