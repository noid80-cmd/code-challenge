'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type Group = { id: string; name: string; description: string | null; owner_id: string; is_public: boolean; pending_owner_id: string | null }
type Submission = {
  id: string; video_url: string; caption: string | null
  likes_count: number; created_at: string; user_id: string; is_private: boolean
  challenge_id: string | null; thumbnail_url: string | null
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
  // 공개방은 참가하지 않아도 들어와서 볼 수 있다. 들어가 볼 이유를 안
  // 보여주면서 들어오라고 할 수는 없다. 올리기와 채팅만 참가해야 된다.
  const [guest, setGuest] = useState(false)
  // 방장을 넘길 때만 멤버 목록이 필요하다. 평소엔 인원수만 있으면 된다.
  const [members, setMembers] = useState<{ id: string; name: string }[]>([])
  const [transferOpen, setTransferOpen] = useState(false)
  const [pendingName, setPendingName] = useState('')
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
    if (!user) { window.location.href = '/login?from=' + encodeURIComponent(window.location.pathname); return }
    setUserId(user.id)

    // select('*') 는 이제 못 쓴다. 초대 코드와 비밀번호 해시는 읽을 수 있는
    // 칸에서 빠졌고, 없는 칸을 달라고 하면 요청이 통째로 실패한다.
    const { data: g } = await supabase.from('groups')
      .select('id, name, description, owner_id, is_public, pending_owner_id').eq('id', groupId).single()
    if (!g) { window.location.href = '/groups'; return }
    setGroup(g)

    const { data: membership } = await supabase
      .from('group_members').select('id').eq('group_id', groupId).eq('user_id', user.id).maybeSingle()
    if (!membership && !g.is_public) { window.location.href = '/groups'; return }
    setGuest(!membership)

    const { count } = await supabase.from('group_members').select('id', { count: 'exact', head: true }).eq('group_id', groupId)
    setMemberCount(count ?? 0)

    if (g.pending_owner_id) {
      const { data: pn } = await supabase.from('profiles').select('name').eq('id', g.pending_owner_id).maybeSingle()
      setPendingName((pn?.name as string) ?? '상대방')
    } else {
      setPendingName('')
    }

    const { data: subs, error: subsErr } = await supabase
      .from('submissions')
      .select('id, video_url, caption, likes_count, created_at, user_id, is_private, challenge_id, thumbnail_url')
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

  async function deleteSubmission(subId: string, videoUrl: string) {
    const supabase = createClient()
    if (!videoUrl.startsWith('http')) {
      await supabase.storage.from('videos').remove([videoUrl])
    }
    await supabase.from('submissions').delete().eq('id', subId)
    setSubmissions(prev => prev.filter(s => s.id !== subId))
    setCommentsBySubId(prev => { const next = { ...prev }; delete next[subId]; return next })
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
    // 코드만 주면 상대가 앱을 찾아 들어가 입력해야 한다. 링크를 같이 보내면 눌러서 바로 들어온다.
    const text = `초견챌린지 "${group.name}" 그룹 초대
${window.location.origin}/groups?g=${group.id}`
    navigator.clipboard.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  async function openTransfer() {
    const supabase = createClient()
    const { data: rows } = await supabase.from('group_members')
      .select('user_id').eq('group_id', groupId)
    const ids = (rows ?? []).map((r: { user_id: string }) => r.user_id).filter(id => id !== userId)
    if (ids.length === 0) { alert('넘길 사람이 없어요. 아직 혼자 있는 방입니다.'); return }
    const { data: profs } = await supabase.from('profiles').select('id, name').in('id', ids)
    setMembers(((profs ?? []) as { id: string; name: string }[]))
    setTransferOpen(true)
  }

  // 방장은 나갈 방법이 삭제뿐이었다. 멤버가 여럿인 방을 나가겠다고 통째로
  // 없애면 남의 기록까지 지운다. 넘기고 나가는 길을 만든다.
  //
  // 단, 바로 넘기지 않는다. 방장은 공지·비밀번호·삭제 권한이라 떠넘길 수
  // 있는 자리다. 지명해두고 상대가 수락해야 넘어간다.
  async function offerOwner(toId: string, toName: string) {
    if (!confirm(`${toName} 님에게 방장을 넘기겠다고 제안할까요?\n상대가 수락해야 넘어갑니다.`)) return
    const supabase = createClient()
    const { error } = await supabase.rpc('offer_group_owner', {
      p_group_id: groupId, p_new_owner: toId,
    })
    if (error) { alert('제안하지 못했어요: ' + error.message); return }
    setTransferOpen(false)
    window.location.reload()
  }

  async function answerOwnerOffer(accept: boolean) {
    const supabase = createClient()
    const { error } = await supabase.rpc(accept ? 'accept_group_owner' : 'decline_group_owner', {
      p_group_id: groupId,
    })
    if (error) { alert('처리하지 못했어요: ' + error.message); return }
    window.location.reload()
  }

  // 들어왔으면 나갈 수도 있어야 한다. 나가는 길이 없으면 애초에 안 들어온다.
  async function leaveGroup() {
    if (!group || !userId) return
    if (!confirm(`"${group.name}" 방에서 나갈까요? 올린 영상은 그대로 남습니다.`)) return
    const supabase = createClient()
    const { data, error } = await supabase.from('group_members')
      .delete().eq('group_id', groupId).eq('user_id', userId).select('id')
    if (error || !data?.length) { alert('나가지 못했어요. 잠시 후 다시 시도해주세요.'); return }
    window.location.href = '/groups'
  }

  async function joinHere() {
    if (!group) return
    const supabase = createClient()
    const { data, error } = await supabase.from('group_members')
      .insert({ group_id: groupId, user_id: userId }).select('id')
    if (error || !data?.length) { alert('참가하지 못했어요.'); return }
    window.location.reload()
  }

  async function deleteGroup() {
    if (!group) return
    if (!confirm(`"${group.name}" 그룹을 삭제할까요? 모든 영상과 채팅이 삭제됩니다.`)) return
    const supabase = createClient()
    await supabase.from('group_messages').delete().eq('group_id', groupId)
    await supabase.from('group_announcements').delete().eq('group_id', groupId)
    await supabase.from('group_members').delete().eq('group_id', groupId)
    await supabase.from('submissions').update({ group_id: null }).eq('group_id', groupId)
    await supabase.from('groups').delete().eq('id', groupId)
    window.location.href = '/groups'
  }

  const isOwner = group?.owner_id === userId

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #080808 0%, #0a0a0a 60%, #090909 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f0ece0', opacity: 0.7 }} />
      <span style={{ color: '#a8a296', fontSize: 14, fontWeight: 600 }}>불러오는 중</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #080808 0%, #0a0a0a 60%, #090909 100%)' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,8,8,0.88)', backdropFilter: 'blur(24px)',
        padding: '0 20px', height: 54, paddingTop: 'calc(env(safe-area-inset-top) + 24px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/groups" style={{ color: '#c0bab0', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          그룹
        </Link>
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
          {copied ? '링크 복사됨' : '링크 복사'}
        </button>
      </header>

      {transferOpen && (
        <>
          <div onClick={() => setTransferOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)' }} />
          <div style={{
            position: 'fixed', zIndex: 201, left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
            width: 'min(360px, calc(100vw - 40px))', maxHeight: '70vh', overflowY: 'auto',
            background: '#131312', border: '1px solid rgba(240,236,224,0.14)',
            borderRadius: 18, padding: 18,
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#f0ece0', marginBottom: 6 }}>방장 넘기기</div>
            <div style={{ fontSize: 12.5, color: '#c0bab0', lineHeight: 1.6, marginBottom: 14, wordBreak: 'keep-all' }}>
              고른 사람이 수락하면 이 방의 공지·비밀번호·삭제 권한이 그 사람에게 갑니다. 넘어간 뒤에는 방에서 나갈 수 있어요.
            </div>
            {members.map(m => (
              <button key={m.id} onClick={() => offerOwner(m.id, m.name)} style={{
                display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                background: 'rgba(240,236,224,0.05)', border: '1px solid rgba(240,236,224,0.12)',
                borderRadius: 11, padding: '11px 13px', marginBottom: 8,
                color: '#e0dcd0', fontSize: 13.5, fontWeight: 700,
              }}>{m.name}</button>
            ))}
            <button onClick={() => setTransferOpen(false)} style={{
              width: '100%', marginTop: 4, padding: '11px', borderRadius: 11,
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#a8a296', fontSize: 13, fontWeight: 700,
            }}>닫기</button>
          </div>
        </>
      )}

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 16px 0' }}>
        {group?.pending_owner_id === userId && (
          <div style={{
            background: 'rgba(230,197,131,0.1)', border: '1px solid rgba(230,197,131,0.4)',
            borderRadius: 16, padding: '14px 16px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#e6c583', marginBottom: 4 }}>
              방장을 넘겨받으시겠어요?
            </div>
            <div style={{ fontSize: 12.5, color: '#e0dcd0', lineHeight: 1.6, marginBottom: 12, wordBreak: 'keep-all' }}>
              수락하면 이 방의 공지·비밀번호·삭제 권한이 넘어옵니다.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => answerOwnerOffer(true)} style={{
                flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                color: '#0a0a08', fontSize: 13, fontWeight: 800,
              }}>수락</button>
              <button onClick={() => answerOwnerOffer(false)} style={{
                flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
                background: 'transparent', border: '1px solid rgba(240,236,224,0.2)',
                color: '#c0bab0', fontSize: 13, fontWeight: 700,
              }}>거절</button>
            </div>
          </div>
        )}

        {/* 그룹 정보 */}
        <div style={{
          background: 'linear-gradient(145deg, #111110, #0d0d0c)',
          border: '1px solid rgba(240,236,224,0.12)', borderRadius: 18, padding: '14px 18px', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            {group?.description && <div style={{ fontSize: 13, color: '#a0988c', marginBottom: 4 }}>{group.description}</div>}
            <div style={{ fontSize: 12, color: '#a8a296', fontWeight: 600 }}>멤버 {memberCount}명</div>
            {isOwner && (
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                {memberCount > 1 && (
                  group?.pending_owner_id ? (
                    <button onClick={() => answerOwnerOffer(false)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#e6c583', fontSize: 11, fontWeight: 700, padding: 0,
                    }}>{pendingName} 님 수락 대기 중 · 취소</button>
                  ) : (
                    <button onClick={openTransfer} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#98948a', fontSize: 11, fontWeight: 600, padding: 0,
                    }}>방장 넘기기</button>
                  )
                )}
                <button onClick={deleteGroup} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#98948a', fontSize: 11, fontWeight: 600, padding: 0,
                }}>그룹 삭제</button>
              </div>
            )}
            {!isOwner && !guest && (
              <button onClick={leaveGroup} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#98948a', fontSize: 11, fontWeight: 600, padding: 0, marginTop: 6,
              }}>방 나가기</button>
            )}
          </div>
          {guest ? (
            <button onClick={joinHere} style={{
              padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
              color: '#0a0a08', fontSize: 13, fontWeight: 700,
            }}>참가하기</button>
          ) : (
            <Link href={`/upload?group=${groupId}`} style={{
              padding: '8px 16px', borderRadius: 10,
              background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
              color: '#0a0a08', fontSize: 13, fontWeight: 700, textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(240,236,224,0.35)',
            }}>업로드</Link>
          )}
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'rgba(240,236,224,0.04)', borderRadius: 12, padding: 4 }}>
          {(['feed', 'chat'] as const).map(tab => (
            <button key={tab}
              onClick={() => {
                // 채팅은 방 사람들의 것이다. 구경하는 사람에게는 열지 않는다.
                if (tab === 'chat' && guest) { alert('참가하면 채팅을 볼 수 있어요.'); return }
                setActiveTab(tab)
              }}
              style={{
              flex: 1, padding: '8px', borderRadius: 9, border: 'none', cursor: 'pointer',
              background: activeTab === tab ? 'rgba(240,236,224,0.12)' : 'transparent',
              color: activeTab === tab ? '#f0ece0' : '#c0bab0',
              fontSize: 13, fontWeight: 800, transition: 'all 0.15s',
            }}>
              {tab === 'feed' ? '피드' : '채팅'}
            </button>
          ))}
        </div>
      </div>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px max(120px, calc(100px + env(safe-area-inset-bottom)))' }}>

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
                          color: '#a8a296', fontSize: 11, padding: 0, flexShrink: 0,
                        }}>삭제</button>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: '#a8a296', marginTop: 6 }}>{timeAgo(a.created_at)}</div>
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
                          color: '#a8a296', fontSize: 13, cursor: 'pointer',
                        }}>취소</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowAnnounceInput(true)} style={{
                      width: '100%', padding: '9px', borderRadius: 10,
                      background: 'transparent', border: '1px dashed rgba(240,236,224,0.15)',
                      color: '#98948a', fontSize: 12, fontWeight: 700, cursor: 'pointer',
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
                <p style={{ color: '#a8a296', fontSize: 14, fontWeight: 700 }}>아직 연주가 없어요</p>
                <p style={{ color: '#a8a296', fontSize: 13, marginTop: 5 }}>첫 번째로 올려보세요</p>
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
                    onDeleteSubmission={() => deleteSubmission(sub.id, sub.video_url)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── 채팅 탭 ── */}
        {activeTab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 260px)', minHeight: 360 }}>
            {/* 메시지 목록 */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#a8a296', fontSize: 14 }}>
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
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#c0bab0', marginBottom: 4, paddingLeft: 2 }}>
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
                        fontSize: 10, color: '#a8a296', marginTop: 3,
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
            <div style={{ borderTop: '1px solid rgba(240,236,224,0.1)', paddingTop: 12, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            {chatError && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 6, textAlign: 'center' }}>{chatError}</p>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
              <input
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="메시지 입력..."
                style={{
                  flex: 1, minWidth: 0, width: 0, background: 'rgba(240,236,224,0.06)',
                  border: '1px solid rgba(240,236,224,0.15)',
                  borderRadius: 22, padding: '10px 16px',
                  fontSize: 14, color: '#f0ece0', outline: 'none',
                }}
              />
              <button onClick={sendMessage} disabled={sending || !messageText.trim()} style={{
                width: 44, height: 44, borderRadius: '50%', border: 'none', flexShrink: 0,
                background: messageText.trim() ? 'linear-gradient(135deg, #f8f4ec, #c8c4b0)' : 'rgba(240,236,224,0.08)',
                color: messageText.trim() ? '#0a0a08' : '#a8a296',
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
  sub, liked, comments, currentUserId, onLike, onComment, onDeleteComment, onDeleteSubmission,
}: {
  sub: Submission; liked: boolean; comments: Comment[]
  currentUserId: string; onLike: () => void
  onComment: (text: string, parentId?: string) => void
  onDeleteComment: (id: string) => void
  onDeleteSubmission: () => void
}) {
  const supabase = createClient()
  const [commentText, setCommentText] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const replyInputRef = useRef<HTMLInputElement>(null)

  async function handleDelete() {
    if (!confirm('이 영상을 삭제할까요?')) return
    setDeleting(true)
    onDeleteSubmission()
  }

  const videoUrl = sub.video_url.startsWith('http')
    ? sub.video_url
    : supabase.storage.from('videos').getPublicUrl(sub.video_url).data.publicUrl
  const posterUrl = sub.thumbnail_url
    ? sub.thumbnail_url.startsWith('http')
      ? sub.thumbnail_url
      : supabase.storage.from('videos').getPublicUrl(sub.thumbnail_url).data.publicUrl
    : undefined

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
      <video src={videoUrl} poster={posterUrl} controls playsInline preload="metadata"
        style={{ width: '100%', display: 'block', background: '#000', height: 'auto' }} />

      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar profile={sub.profiles} size={34} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#f0ece0', lineHeight: 1.2 }}>{sub.profiles?.name ?? '익명'}</div>
              <div style={{ fontSize: 11, color: '#a8a296', marginTop: 1 }}>
                {challengeDate && <span style={{ marginRight: 4 }}>{challengeDate} ·</span>}
                {timeAgo(sub.created_at)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {sub.user_id === currentUserId && (
              <button onClick={handleDelete} disabled={deleting} style={{
                background: 'none', border: 'none', cursor: deleting ? 'default' : 'pointer',
                color: '#98948a', fontSize: 12, fontWeight: 600, padding: '4px 6px',
              }}>{deleting ? '...' : '삭제'}</button>
            )}
            <button onClick={onLike} style={{
              background: liked ? 'rgba(240,236,224,0.12)' : 'rgba(255,255,255,0.02)',
              border: liked ? '1px solid rgba(240,236,224,0.4)' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              color: liked ? '#f0ece0' : '#a8a296',
              fontSize: 14, fontWeight: 800, padding: '7px 12px',
            }}>
              {liked ? '♥' : '♡'}
              <span style={{ fontSize: 12 }}>{sub.likes_count}</span>
            </button>
          </div>
        </div>

        {sub.caption && <p style={{ fontSize: 13, color: '#c0bab0', marginBottom: 10, lineHeight: 1.6 }}>{sub.caption}</p>}
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
                        <span style={{ fontSize: 10, color: '#a8a296' }}>{timeAgo(c.created_at)}</span>
                      </div>
                      <p style={{ fontSize: 13, color: '#aca291', lineHeight: 1.5, margin: 0 }}>{c.content}</p>
                      <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                        <button onClick={() => startReply(replyToId === c.id ? null : c.id)} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: replyToId === c.id ? '#a0988c' : '#98948a', fontSize: 11, fontWeight: 600, padding: 0,
                        }}>답글</button>
                        {c.user_id === currentUserId && (
                          <button onClick={() => onDeleteComment(c.id)} style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#8a847a', fontSize: 11, padding: 0,
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
                              <span style={{ fontSize: 10, color: '#a8a296' }}>{timeAgo(r.created_at)}</span>
                            </div>
                            <p style={{ fontSize: 12, color: '#c0bab0', lineHeight: 1.5, margin: 0 }}>{r.content}</p>
                          </div>
                          {r.user_id === currentUserId && (
                            <button onClick={() => onDeleteComment(r.id)} style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#8a847a', fontSize: 11, padding: 0, flexShrink: 0,
                            }}>삭제</button>
                          )}
                        </div>
                      ))}

                      {/* 답글 입력 */}
                      {replyToId === c.id && (
                        <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                          <input
                            ref={replyInputRef}
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            placeholder="답글을 입력하세요"
                            onKeyDown={e => { if (e.key === 'Enter') handleReply(c.id) }}
                            style={{
                              flex: 1, minWidth: 0, width: 0, background: 'rgba(13,13,12,0.8)',
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
                            color: '#a8a296', fontSize: 12, cursor: 'pointer',
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
            color: '#a8a296', fontSize: 13, fontWeight: 600, padding: 0,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2h10v8H8l-3 2V10H2V2z" stroke="#303028" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
            {comments.length > 0 ? `댓글 ${comments.length}` : '댓글 달기'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <input ref={inputRef} value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="댓글을 입력하세요"
              onKeyDown={e => { if (e.key === 'Enter') handleComment() }}
              style={{
                flex: 1, minWidth: 0, width: 0, background: 'rgba(13,13,12,0.8)',
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
              color: '#a8a296', fontSize: 13, cursor: 'pointer',
            }}>✕</button>
          </div>
        )}
      </div>
    </div>
  )
}
