'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type Group = { id: string; name: string; description: string | null; invite_code: string; owner_id: string }
type Submission = {
  id: string; video_url: string; caption: string | null
  likes_count: number; created_at: string; user_id: string; is_private: boolean
  challenge_id: string | null
  profiles: { name: string; avatar_url: string | null } | null
  challenges: { title: string; date: string } | null
}
type Comment = {
  id: string; content: string; created_at: string; user_id: string; parent_id: string | null
  profiles: { name: string; avatar_url: string | null } | null
}
type Announcement = {
  id: string; content: string; created_at: string; user_id: string
  profiles: { name: string; avatar_url: string | null } | null
}
type Message = {
  id: string; content: string; created_at: string; user_id: string
  profiles: { name: string; avatar_url: string | null } | null
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

function Avatar({ profile, size = 34 }: { profile: { name: string; avatar_url: string | null } | null; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 800, color: '#0a0a08', overflow: 'hidden', flexShrink: 0,
    }}>
      {profile?.avatar_url
        ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        : (profile?.name ?? '?').slice(0, 1).toUpperCase()}
    </div>
  )
}

export default function GroupPage() {
  const { id: groupId } = useParams<{ id: string }>()
  const [group, setGroup] = useState<Group | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [commentsBySubId, setCommentsBySubId] = useState<Record<string, Comment[]>>({})
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [feedError, setFeedError] = useState('')
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'feed' | 'chat'>('feed')

  // 공지
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [announcementText, setAnnouncementText] = useState('')
  const [showAnnounceInput, setShowAnnounceInput] = useState(false)
  const [postingAnnouncement, setPostingAnnouncement] = useState(false)

  // 채팅
  const [messages, setMessages] = useState<Message[]>([])
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatLoadedRef = useRef(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }
    setUserId(user.id)

    const { data: g } = await supabase.from('groups').select('*').eq('id', groupId).single()
    if (!g) { window.location.href = '/groups'; return }
    setGroup(g)

    const { data: membership } = await supabase
      .from('group_members').select('id').eq('group_id', groupId).eq('user_id', user.id).single()
    if (!membership) { window.location.href = '/groups'; return }

    const { count } = await supabase.from('group_members').select('id', { count: 'exact', head: true }).eq('group_id', groupId)
    setMemberCount(count ?? 0)

    const { data: subs, error: subsErr } = await supabase
      .from('submissions')
      .select('id, video_url, caption, likes_count, created_at, user_id, is_private, challenge_id')
      .eq('group_id', groupId).order('created_at', { ascending: false })
    if (subsErr) { setFeedError('오류: ' + subsErr.message); setLoading(false); return }
    const subList = ((subs ?? []) as Submission[]).filter(s => !s.is_private || s.user_id === user.id)

    if (subList.length > 0) {
      const userIds = [...new Set(subList.map(s => s.user_id))]
      const challengeIds = [...new Set(subList.map(s => s.challenge_id).filter(Boolean))] as string[]
      const [{ data: profs }, { data: chals }] = await Promise.all([
        supabase.from('profiles').select('id, name, avatar_url').in('id', userIds),
        challengeIds.length > 0
          ? supabase.from('challenges').select('id, title, date').in('id', challengeIds)
          : Promise.resolve({ data: [] }),
      ])
      const profilesMap = Object.fromEntries((profs ?? []).map(p => [p.id, p]))
      const challengesMap = Object.fromEntries((chals ?? []).map(c => [c.id, c]))
      setSubmissions(subList.map(s => ({
        ...s,
        profiles: profilesMap[s.user_id] ?? null,
        challenges: s.challenge_id ? (challengesMap[s.challenge_id] ?? null) : null,
      })))
    } else {
      setSubmissions([])
    }

    const { data: likes } = await supabase.from('likes').select('submission_id').eq('user_id', user.id)
    setLikedIds(new Set(likes?.map(l => l.submission_id) ?? []))

    if (subList.length > 0) {
      const { data: comments } = await supabase
        .from('comments').select('id, content, created_at, user_id, parent_id, submission_id')
        .in('submission_id', subList.map(s => s.id)).order('created_at', { ascending: true })
      const cUids = [...new Set((comments ?? []).map(c => c.user_id))]
      const { data: cProfs } = cUids.length > 0
        ? await supabase.from('profiles').select('id, name, avatar_url').in('id', cUids)
        : { data: [] }
      const cProfMap = Object.fromEntries((cProfs ?? []).map(p => [p.id, p]))
      const byId: Record<string, Comment[]> = {}
      ;(comments ?? []).forEach((c) => {
        const enriched = { ...c, profiles: cProfMap[c.user_id] ?? null }
        if (!byId[c.submission_id]) byId[c.submission_id] = []
        byId[c.submission_id].push(enriched as unknown as Comment & { submission_id: string })
      })
      setCommentsBySubId(byId)
    }

    const { data: announces } = await supabase
      .from('group_announcements').select('id, content, created_at, user_id')
      .eq('group_id', groupId).order('created_at', { ascending: false })
    const aUids = [...new Set((announces ?? []).map(a => a.user_id))]
    const { data: aProfs } = aUids.length > 0
      ? await supabase.from('profiles').select('id, name, avatar_url').in('id', aUids)
      : { data: [] }
    const aProfMap = Object.fromEntries((aProfs ?? []).map(p => [p.id, p]))
    setAnnouncements(((announces ?? []).map(a => ({ ...a, profiles: aProfMap[a.user_id] ?? null }))) as Announcement[])

    setLoading(false)
  }, [groupId])

  useEffect(() => { load() }, [load])

  // 채팅 실시간 구독
  useEffect(() => {
    if (activeTab !== 'chat' || !groupId || !userId) return
    const supabase = createClient()

    if (!chatLoadedRef.current) {
      chatLoadedRef.current = true
      supabase.from('group_messages')
        .select('id, content, created_at, user_id')
        .eq('group_id', groupId).order('created_at', { ascending: true }).limit(100)
        .then(async ({ data: msgs }) => {
          const mUids = [...new Set((msgs ?? []).map(m => m.user_id))]
          const { data: mProfs } = mUids.length > 0
            ? await supabase.from('profiles').select('id, name, avatar_url').in('id', mUids)
            : { data: [] }
          const mProfMap = Object.fromEntries((mProfs ?? []).map(p => [p.id, p]))
          setMessages((msgs ?? []).map(m => ({ ...m, profiles: mProfMap[m.user_id] ?? null })) as Message[])
          setTimeout(() => messagesEndRef.current?.scrollIntoView(), 100)
        })
    }

    const channel = supabase
      .channel(`group-chat-${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'group_messages',
        filter: `group_id=eq.${groupId}`,
      }, async (payload) => {
        const newMsg = payload.new as { id: string; user_id: string; content: string; created_at: string }
        const { data: prof } = await supabase.from('profiles').select('name, avatar_url').eq('id', newMsg.user_id).single()
        const enriched: Message = { ...newMsg, profiles: prof ?? null }
        setMessages(prev => prev.some(m => m.id === enriched.id) ? prev : [...prev, enriched])
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeTab, groupId, userId])

  async function toggleLike(subId: string) {
    const supabase = createClient()
    if (likedIds.has(subId)) {
      await supabase.from('likes').delete().eq('submission_id', subId).eq('user_id', userId)
      setLikedIds(prev => { const s = new Set(prev); s.delete(subId); return s })
      setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, likes_count: s.likes_count - 1 } : s))
    } else {
      await supabase.from('likes').insert({ submission_id: subId, user_id: userId })
      setLikedIds(prev => new Set([...prev, subId]))
      setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, likes_count: s.likes_count + 1 } : s))
    }
  }

  async function addComment(subId: string, content: string, parentId?: string) {
    if (!content.trim()) return
    const supabase = createClient()
    const { data: comment } = await supabase
      .from('comments').insert({
        submission_id: subId, user_id: userId, content: content.trim(),
        parent_id: parentId ?? null,
      })
      .select('id, content, created_at, user_id, parent_id').single()
    if (comment) {
      const { data: profile } = await supabase
        .from('profiles').select('name, avatar_url').eq('id', userId).single()
      const full = { ...comment, profiles: profile ?? null, submission_id: subId }
      setCommentsBySubId(prev => ({
        ...prev,
        [subId]: [...(prev[subId] ?? []), full as Comment & { submission_id: string }],
      }))
    }
  }

  async function deleteComment(subId: string, commentId: string) {
    const supabase = createClient()
    await supabase.from('comments').delete().eq('id', commentId)
    setCommentsBySubId(prev => ({
      ...prev,
      [subId]: (prev[subId] ?? []).filter(c => c.id !== commentId && c.parent_id !== commentId),
    }))
  }

  async function postAnnouncement() {
    if (!announcementText.trim()) return
    setPostingAnnouncement(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('group_announcements')
      .insert({ group_id: groupId, user_id: userId, content: announcementText.trim() })
      .select('id, content, created_at, user_id').single()
    if (data) {
      const { data: prof } = await supabase.from('profiles').select('name, avatar_url').eq('id', userId).single()
      setAnnouncements(prev => [{ ...data, profiles: prof ?? null } as Announcement, ...prev])
      setAnnouncementText('')
      setShowAnnounceInput(false)
    }
    setPostingAnnouncement(false)
  }

  async function deleteAnnouncement(id: string) {
    const supabase = createClient()
    await supabase.from('group_announcements').delete().eq('id', id)
    setAnnouncements(prev => prev.filter(a => a.id !== id))
  }

  async function sendMessage() {
    if (!messageText.trim() || sending) return
    setSending(true)
    const supabase = createClient()
    const content = messageText.trim()
    setMessageText('')
    const { data: msg, error: sendErr } = await supabase.from('group_messages')
      .insert({ group_id: groupId, user_id: userId, content })
      .select('id, content, created_at, user_id').single()
    if (sendErr) {
      setChatError('전송 실패: ' + sendErr.message)
      setTimeout(() => setChatError(''), 3000)
    } else if (msg) {
      setChatError('')
      const { data: prof } = await supabase.from('profiles').select('name, avatar_url').eq('id', userId).single()
      const enriched: Message = { ...msg, profiles: prof ?? null }
      setMessages(prev => prev.some(m => m.id === enriched.id) ? prev : [...prev, enriched])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
    setSending(false)
  }

  function copyCode() {
    if (!group) return
    navigator.clipboard.writeText(group.invite_code)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const isOwner = group?.owner_id === userId

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #080808 0%, #0a0a0a 60%, #090909 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f0ece0', opacity: 0.7 }} />
      <span style={{ color: '#303028', fontSize: 14, fontWeight: 600 }}>불러오는 중</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #080808 0%, #0a0a0a 60%, #090909 100%)' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,8,8,0.88)', backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(240,236,224,0.12)',
        padding: '0 20px', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/groups" style={{ color: '#605850', fontSize: 13, fontWeight: 700 }}>← 그룹</Link>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#f0ece0', letterSpacing: '-0.02em', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {group?.name}
        </span>
        <button onClick={copyCode} style={{
          background: copied ? 'rgba(52,211,153,0.1)' : 'rgba(240,236,224,0.1)',
          border: copied ? '1px solid rgba(52,211,153,0.25)' : '1px solid rgba(240,236,224,0.25)',
          borderRadius: 9, padding: '5px 12px',
          color: copied ? '#34d399' : '#a0988c',
          fontSize: 12, fontWeight: 800, cursor: 'pointer',
          letterSpacing: '0.06em', transition: 'all 0.2s',
        }}>
          {copied ? '복사됨 ✓' : group?.invite_code}
        </button>
      </header>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 16px 0' }}>
        {/* 그룹 정보 */}
        <div style={{
          background: 'linear-gradient(145deg, #111110, #0d0d0c)',
          border: '1px solid rgba(240,236,224,0.12)', borderRadius: 18, padding: '14px 18px', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            {group?.description && <div style={{ fontSize: 13, color: '#a0988c', marginBottom: 4 }}>{group.description}</div>}
            <div style={{ fontSize: 12, color: '#303028', fontWeight: 600 }}>멤버 {memberCount}명</div>
          </div>
          <Link href={`/upload?group=${groupId}`} style={{
            padding: '8px 16px', borderRadius: 10,
            background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
            color: '#0a0a08', fontSize: 13, fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(240,236,224,0.35)',
          }}>업로드</Link>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'rgba(240,236,224,0.04)', borderRadius: 12, padding: 4 }}>
          {(['feed', 'chat'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: '8px', borderRadius: 9, border: 'none', cursor: 'pointer',
              background: activeTab === tab ? 'rgba(240,236,224,0.12)' : 'transparent',
              color: activeTab === tab ? '#f0ece0' : '#605850',
              fontSize: 13, fontWeight: 800, transition: 'all 0.15s',
            }}>
              {tab === 'feed' ? '피드' : '채팅'}
            </button>
          ))}
        </div>
      </div>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px 100px' }}>

        {/* ── 피드 탭 ── */}
        {activeTab === 'feed' && (
          <>
            {/* 공지 */}
            {(isOwner || announcements.length > 0) && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: '#a0988c', marginBottom: 10 }}>📢 공지</div>

                {announcements.map(a => (
                  <div key={a.id} style={{
                    background: 'linear-gradient(145deg, rgba(240,236,224,0.06), rgba(240,236,224,0.03))',
                    border: '1px solid rgba(240,236,224,0.15)', borderRadius: 14, padding: '12px 14px', marginBottom: 8,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <p style={{ fontSize: 13, color: '#d0ccc0', lineHeight: 1.6, margin: 0, flex: 1, whiteSpace: 'pre-wrap' }}>{a.content}</p>
                      {isOwner && (
                        <button onClick={() => deleteAnnouncement(a.id)} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#303028', fontSize: 11, padding: 0, flexShrink: 0,
                        }}>삭제</button>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: '#303028', marginTop: 6 }}>{timeAgo(a.created_at)}</div>
                  </div>
                ))}

                {isOwner && (
                  showAnnounceInput ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <textarea
                        value={announcementText}
                        onChange={e => setAnnouncementText(e.target.value)}
                        placeholder="공지 내용을 입력하세요"
                        rows={3}
                        style={{
                          background: 'rgba(13,13,12,0.8)', border: '1px solid rgba(240,236,224,0.2)',
                          borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#f0ece0',
                          outline: 'none', resize: 'none', width: '100%', boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={postAnnouncement} disabled={postingAnnouncement || !announcementText.trim()} style={{
                          flex: 1, padding: '9px', borderRadius: 9,
                          background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                          color: '#0a0a08', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                          opacity: postingAnnouncement ? 0.6 : 1,
                        }}>공지 올리기</button>
                        <button onClick={() => { setShowAnnounceInput(false); setAnnouncementText('') }} style={{
                          padding: '9px 14px', borderRadius: 9,
                          background: 'transparent', border: '1px solid rgba(240,236,224,0.15)',
                          color: '#303028', fontSize: 13, cursor: 'pointer',
                        }}>취소</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowAnnounceInput(true)} style={{
                      width: '100%', padding: '9px', borderRadius: 10,
                      background: 'transparent', border: '1px dashed rgba(240,236,224,0.15)',
                      color: '#484640', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>+ 공지 올리기</button>
                  )
                )}
              </div>
            )}

            {feedError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
                <p style={{ color: '#f87171', fontSize: 12, margin: 0 }}>{feedError}</p>
                <p style={{ color: '#f87171', fontSize: 11, margin: '4px 0 0', opacity: 0.7 }}>Supabase SQL Editor에서 RLS 정책을 추가해주세요</p>
              </div>
            )}
            {submissions.length === 0 && !feedError ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <p style={{ color: '#303028', fontSize: 14, fontWeight: 700 }}>아직 연주가 없어요</p>
                <p style={{ color: '#1a1a18', fontSize: 13, marginTop: 5 }}>첫 번째로 올려보세요</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {submissions.map(sub => (
                  <SubmissionCard key={sub.id} sub={sub}
                    liked={likedIds.has(sub.id)}
                    comments={commentsBySubId[sub.id] ?? []}
                    currentUserId={userId}
                    onLike={() => toggleLike(sub.id)}
                    onComment={(text, parentId) => addComment(sub.id, text, parentId)}
                    onDeleteComment={cid => deleteComment(sub.id, cid)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── 채팅 탭 ── */}
        {activeTab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100svh - 260px)', minHeight: 360 }}>
            {/* 메시지 목록 */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#303028', fontSize: 14 }}>
                  첫 메시지를 보내보세요
                </div>
              )}
              {messages.map(msg => {
                const isMine = msg.user_id === userId
                return (
                  <div key={msg.id} style={{
                    display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row',
                    gap: 9, alignItems: 'flex-end',
                  }}>
                    {!isMine && <Avatar profile={msg.profiles} size={28} />}
                    <div style={{ maxWidth: '72%' }}>
                      {!isMine && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#605850', marginBottom: 4, paddingLeft: 2 }}>
                          {msg.profiles?.name ?? '익명'}
                        </div>
                      )}
                      <div style={{
                        padding: '9px 13px',
                        borderRadius: isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        background: isMine ? 'linear-gradient(135deg, #f8f4ec, #c8c4b0)' : 'rgba(240,236,224,0.08)',
                        border: isMine ? 'none' : '1px solid rgba(240,236,224,0.12)',
                        fontSize: 13, color: isMine ? '#0a0a08' : '#d0ccc0',
                        lineHeight: 1.5, fontWeight: isMine ? 600 : 400,
                        wordBreak: 'break-word',
                      }}>
                        {msg.content}
                      </div>
                      <div style={{
                        fontSize: 10, color: '#303028', marginTop: 3,
                        textAlign: isMine ? 'right' : 'left',
                        paddingLeft: isMine ? 0 : 2, paddingRight: isMine ? 2 : 0,
                      }}>
                        {timeAgo(msg.created_at)}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* 입력창 */}
            <div style={{ borderTop: '1px solid rgba(240,236,224,0.1)', paddingTop: 12 }}>
            {chatError && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 6, textAlign: 'center' }}>{chatError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="메시지 입력..."
                style={{
                  flex: 1, background: 'rgba(240,236,224,0.06)',
                  border: '1px solid rgba(240,236,224,0.15)',
                  borderRadius: 22, padding: '10px 16px',
                  fontSize: 14, color: '#f0ece0', outline: 'none',
                }}
              />
              <button onClick={sendMessage} disabled={sending || !messageText.trim()} style={{
                width: 44, height: 44, borderRadius: '50%', border: 'none', flexShrink: 0,
                background: messageText.trim() ? 'linear-gradient(135deg, #f8f4ec, #c8c4b0)' : 'rgba(240,236,224,0.08)',
                color: messageText.trim() ? '#0a0a08' : '#303028',
                fontSize: 18, cursor: messageText.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>↑</button>
            </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function SubmissionCard({
  sub, liked, comments, currentUserId, onLike, onComment, onDeleteComment,
}: {
  sub: Submission; liked: boolean; comments: Comment[]
  currentUserId: string; onLike: () => void
  onComment: (text: string, parentId?: string) => void
  onDeleteComment: (id: string) => void
}) {
  const supabase = createClient()
  const [commentText, setCommentText] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const replyInputRef = useRef<HTMLInputElement>(null)

  const videoUrl = sub.video_url.startsWith('http')
    ? sub.video_url
    : supabase.storage.from('videos').getPublicUrl(sub.video_url).data.publicUrl

  const topComments = comments.filter(c => c.parent_id === null)
  const getReplies = (id: string) => comments.filter(c => c.parent_id === id)

  function handleComment() {
    if (!commentText.trim()) return
    onComment(commentText); setCommentText(''); setShowInput(false)
  }

  function handleReply(parentId: string) {
    if (!replyText.trim()) return
    onComment(replyText, parentId); setReplyText(''); setReplyToId(null)
  }

  function startReply(commentId: string | null) {
    setReplyToId(commentId)
    if (commentId) setTimeout(() => replyInputRef.current?.focus(), 50)
  }

  const challengeDate = sub.challenges?.date
    ? new Date(sub.challenges.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    : ''

  return (
    <div style={{
      background: 'linear-gradient(145deg, #111110, #0d0d0c)',
      border: '1px solid rgba(240,236,224,0.1)', borderRadius: 20, overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <video src={videoUrl} controls playsInline preload="metadata"
        style={{ width: '100%', display: 'block', background: '#000', maxHeight: 440, objectFit: 'contain' }} />

      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar profile={sub.profiles} size={34} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#f0ece0', lineHeight: 1.2 }}>{sub.profiles?.name ?? '익명'}</div>
              <div style={{ fontSize: 11, color: '#303028', marginTop: 1 }}>
                {challengeDate && <span style={{ marginRight: 4 }}>{challengeDate} ·</span>}
                {timeAgo(sub.created_at)}
              </div>
            </div>
          </div>
          <button onClick={onLike} style={{
            background: liked ? 'rgba(240,236,224,0.12)' : 'rgba(255,255,255,0.02)',
            border: liked ? '1px solid rgba(240,236,224,0.4)' : '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            color: liked ? '#f0ece0' : '#303028',
            fontSize: 14, fontWeight: 800, padding: '7px 12px',
          }}>
            {liked ? '♥' : '♡'}
            <span style={{ fontSize: 12 }}>{sub.likes_count}</span>
          </button>
        </div>

        {sub.caption && <p style={{ fontSize: 13, color: '#605850', marginBottom: 10, lineHeight: 1.6 }}>{sub.caption}</p>}
        {sub.challenges?.title && (
          <div style={{
            fontSize: 11, color: '#a0988c', fontWeight: 700,
            background: 'rgba(240,236,224,0.07)', border: '1px solid rgba(240,236,224,0.15)',
            borderRadius: 7, padding: '3px 10px', display: 'inline-block', marginBottom: 10,
          }}>{sub.challenges.title}</div>
        )}
      </div>

      {/* 댓글 + 대댓글 */}
      <div style={{ borderTop: '1px solid rgba(240,236,224,0.06)', padding: '12px 16px 14px' }}>
        {topComments.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 12 }}>
            {topComments.map(c => {
              const replies = getReplies(c.id)
              return (
                <div key={c.id}>
                  {/* 댓글 */}
                  <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                    <Avatar profile={c.profiles} size={26} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#f8f4ec' }}>{c.profiles?.name ?? '익명'}</span>
                        <span style={{ fontSize: 10, color: '#1a1a18' }}>{timeAgo(c.created_at)}</span>
                      </div>
                      <p style={{ fontSize: 13, color: '#7a7060', lineHeight: 1.5, margin: 0 }}>{c.content}</p>
                      <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                        <button onClick={() => startReply(replyToId === c.id ? null : c.id)} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: replyToId === c.id ? '#a0988c' : '#484640', fontSize: 11, fontWeight: 600, padding: 0,
                        }}>답글</button>
                        {c.user_id === currentUserId && (
                          <button onClick={() => onDeleteComment(c.id)} style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#2a2a28', fontSize: 11, padding: 0,
                          }}>삭제</button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 대댓글 */}
                  {(replies.length > 0 || replyToId === c.id) && (
                    <div style={{ marginLeft: 35, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {replies.map(r => (
                        <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <Avatar profile={r.profiles} size={22} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#d0ccc0' }}>{r.profiles?.name ?? '익명'}</span>
                              <span style={{ fontSize: 10, color: '#1a1a18' }}>{timeAgo(r.created_at)}</span>
                            </div>
                            <p style={{ fontSize: 12, color: '#605850', lineHeight: 1.5, margin: 0 }}>{r.content}</p>
                          </div>
                          {r.user_id === currentUserId && (
                            <button onClick={() => onDeleteComment(r.id)} style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#2a2a28', fontSize: 11, padding: 0, flexShrink: 0,
                            }}>삭제</button>
                          )}
                        </div>
                      ))}

                      {/* 답글 입력 */}
                      {replyToId === c.id && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            ref={replyInputRef}
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            placeholder="답글을 입력하세요"
                            onKeyDown={e => { if (e.key === 'Enter') handleReply(c.id) }}
                            style={{
                              flex: 1, background: 'rgba(13,13,12,0.8)',
                              border: '1px solid rgba(240,236,224,0.15)',
                              borderRadius: 8, padding: '7px 10px',
                              fontSize: 12, color: '#f0ece0', outline: 'none',
                            }}
                          />
                          <button onClick={() => handleReply(c.id)} style={{
                            padding: '7px 11px', borderRadius: 8,
                            background: 'rgba(240,236,224,0.1)', border: '1px solid rgba(240,236,224,0.2)',
                            color: '#f0ece0', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          }}>등록</button>
                          <button onClick={() => { setReplyToId(null); setReplyText('') }} style={{
                            padding: '7px 8px', borderRadius: 8,
                            background: 'transparent', border: '1px solid rgba(240,236,224,0.1)',
                            color: '#303028', fontSize: 12, cursor: 'pointer',
                          }}>✕</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {!showInput ? (
          <button onClick={() => { setShowInput(true); setTimeout(() => inputRef.current?.focus(), 50) }} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#303028', fontSize: 13, fontWeight: 600, padding: 0,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2h10v8H8l-3 2V10H2V2z" stroke="#303028" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
            {comments.length > 0 ? `댓글 ${comments.length}` : '댓글 달기'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={inputRef} value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="댓글을 입력하세요"
              onKeyDown={e => { if (e.key === 'Enter') handleComment() }}
              style={{
                flex: 1, background: 'rgba(13,13,12,0.8)',
                border: '1px solid rgba(240,236,224,0.2)',
                borderRadius: 9, padding: '9px 12px',
                fontSize: 13, color: '#f0ece0', outline: 'none',
              }} />
            <button onClick={handleComment} style={{
              padding: '9px 14px', borderRadius: 9,
              background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
              color: '#0a0a08', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
            }}>등록</button>
            <button onClick={() => setShowInput(false)} style={{
              padding: '9px 10px', borderRadius: 9,
              background: 'transparent', border: '1px solid rgba(240,236,224,0.15)',
              color: '#303028', fontSize: 13, cursor: 'pointer',
            }}>✕</button>
          </div>
        )}
      </div>
    </div>
  )
}
