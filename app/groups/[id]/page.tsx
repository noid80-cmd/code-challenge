'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type Group = { id: string; name: string; description: string | null; invite_code: string; owner_id: string }
type Submission = {
  id: string
  video_url: string
  caption: string | null
  likes_count: number
  created_at: string
  user_id: string
  profiles: { name: string; avatar_url: string | null } | null
  challenges: { title: string; date: string } | null
}
type Comment = {
  id: string
  content: string
  created_at: string
  user_id: string
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

export default function GroupPage() {
  const { id: groupId } = useParams<{ id: string }>()
  const [group, setGroup] = useState<Group | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [commentsBySubId, setCommentsBySubId] = useState<Record<string, Comment[]>>({})
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

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

    const { count } = await supabase
      .from('group_members').select('id', { count: 'exact', head: true }).eq('group_id', groupId)
    setMemberCount(count ?? 0)

    const { data: subs } = await supabase
      .from('submissions')
      .select('*, profiles(name, avatar_url), challenges(title, date)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
    const subList = (subs ?? []) as Submission[]
    setSubmissions(subList)

    const { data: likes } = await supabase
      .from('likes').select('submission_id').eq('user_id', user.id)
    setLikedIds(new Set(likes?.map(l => l.submission_id) ?? []))

    if (subList.length > 0) {
      const { data: comments } = await supabase
        .from('comments')
        .select('*, profiles(name, avatar_url)')
        .in('submission_id', subList.map(s => s.id))
        .order('created_at', { ascending: true })
      const byId: Record<string, Comment[]> = {}
      ;(comments ?? []).forEach((c: Comment & { submission_id: string }) => {
        if (!byId[c.submission_id]) byId[c.submission_id] = []
        byId[c.submission_id].push(c)
      })
      setCommentsBySubId(byId)
    }

    setLoading(false)
  }, [groupId])

  useEffect(() => { load() }, [load])

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

  async function addComment(subId: string, content: string) {
    if (!content.trim()) return
    const supabase = createClient()
    const { data: comment } = await supabase
      .from('comments')
      .insert({ submission_id: subId, user_id: userId, content: content.trim() })
      .select('*, profiles(name, avatar_url)')
      .single()
    if (comment) {
      setCommentsBySubId(prev => ({
        ...prev,
        [subId]: [...(prev[subId] ?? []), comment as Comment & { submission_id: string }],
      }))
    }
  }

  async function deleteComment(subId: string, commentId: string) {
    const supabase = createClient()
    await supabase.from('comments').delete().eq('id', commentId)
    setCommentsBySubId(prev => ({
      ...prev,
      [subId]: (prev[subId] ?? []).filter(c => c.id !== commentId),
    }))
  }

  function copyCode() {
    if (!group) return
    navigator.clipboard.writeText(group.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#08080f', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', opacity: 0.8 }} />
      <span style={{ color: '#333358', fontSize: 14, fontWeight: 600 }}>불러오는 중</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#08080f' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,8,15,0.95)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '0 20px', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/groups" style={{ color: '#6666aa', fontSize: 13, fontWeight: 700 }}>← 크루</Link>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#e0e0f8', letterSpacing: '-0.02em', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {group?.name}
        </span>
        <button onClick={copyCode} style={{
          background: copied ? 'rgba(52,211,153,0.1)' : 'rgba(99,102,241,0.08)',
          border: copied ? '1px solid rgba(52,211,153,0.2)' : '1px solid rgba(99,102,241,0.2)',
          borderRadius: 8, padding: '5px 11px',
          color: copied ? '#34d399' : '#6666aa',
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'monospace', letterSpacing: '0.05em',
          transition: 'all 0.2s',
        }}>
          {copied ? '복사됨' : group?.invite_code}
        </button>
      </header>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 100px' }}>

        {/* Group info */}
        <div style={{
          background: '#0d0d1e',
          border: '1px solid rgba(99,102,241,0.12)',
          borderRadius: 16, padding: '14px 18px', marginBottom: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            {group?.description && (
              <div style={{ fontSize: 13, color: '#7777a0', marginBottom: 4 }}>{group.description}</div>
            )}
            <div style={{ fontSize: 12, color: '#444466' }}>
              멤버 {memberCount}명
            </div>
          </div>
          <Link href="/upload" style={{
            padding: '8px 14px', borderRadius: 9,
            background: '#4f46e5', color: '#fff',
            fontSize: 13, fontWeight: 700, textDecoration: 'none',
          }}>
            업로드
          </Link>
        </div>

        {/* Feed */}
        {submissions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ color: '#44445a', fontSize: 14, fontWeight: 700, marginBottom: 5 }}>아직 연주가 없어요</p>
            <p style={{ color: '#2a2a42', fontSize: 13 }}>첫 번째로 올려보세요</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {submissions.map(sub => (
              <SubmissionCard
                key={sub.id}
                sub={sub}
                liked={likedIds.has(sub.id)}
                comments={commentsBySubId[sub.id] ?? []}
                currentUserId={userId}
                onLike={() => toggleLike(sub.id)}
                onComment={(text) => addComment(sub.id, text)}
                onDeleteComment={(cid) => deleteComment(sub.id, cid)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function SubmissionCard({
  sub, liked, comments, currentUserId, onLike, onComment, onDeleteComment,
}: {
  sub: Submission
  liked: boolean
  comments: Comment[]
  currentUserId: string
  onLike: () => void
  onComment: (text: string) => void
  onDeleteComment: (id: string) => void
}) {
  const supabase = createClient()
  const [commentText, setCommentText] = useState('')
  const [showInput, setShowInput] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const videoUrl = sub.video_url.startsWith('http')
    ? sub.video_url
    : supabase.storage.from('videos').getPublicUrl(sub.video_url).data.publicUrl

  const initials = (sub.profiles?.name ?? '?').slice(0, 1).toUpperCase()

  function handleComment() {
    if (!commentText.trim()) return
    onComment(commentText)
    setCommentText('')
  }

  function toggleInput() {
    setShowInput(v => !v)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const challengeDate = sub.challenges?.date
    ? new Date(sub.challenges.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    : ''

  return (
    <div style={{ background: '#0d0d1e', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, overflow: 'hidden' }}>
      <video
        src={videoUrl}
        controls
        playsInline
        preload="metadata"
        style={{ width: '100%', display: 'block', background: '#000', maxHeight: 420, objectFit: 'contain' }}
      />

      <div style={{ padding: '14px 16px' }}>
        {/* User + meta */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: '#fff', overflow: 'hidden', flexShrink: 0,
            }}>
              {sub.profiles?.avatar_url
                ? <img src={sub.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : initials}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ccccee', lineHeight: 1.2 }}>
                {sub.profiles?.name ?? '익명'}
              </div>
              <div style={{ fontSize: 11, color: '#333358', marginTop: 1 }}>
                {challengeDate && <span style={{ color: '#3a3a7a', marginRight: 4 }}>{challengeDate} ·</span>}
                {timeAgo(sub.created_at)}
              </div>
            </div>
          </div>
          <button onClick={onLike} style={{
            background: liked ? 'rgba(244,114,182,0.08)' : 'transparent',
            border: liked ? '1px solid rgba(244,114,182,0.2)' : '1px solid rgba(255,255,255,0.07)',
            borderRadius: 9, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            color: liked ? '#f472b6' : '#444466',
            fontSize: 13, fontWeight: 700, padding: '5px 11px',
          }}>
            {liked ? '♥' : '♡'}
            <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{sub.likes_count}</span>
          </button>
        </div>

        {sub.caption && (
          <p style={{ fontSize: 13, color: '#7777a0', marginBottom: 12, lineHeight: 1.6 }}>{sub.caption}</p>
        )}

        {/* Challenge title */}
        {sub.challenges?.title && (
          <div style={{
            fontSize: 11, color: '#4444aa', fontWeight: 700,
            background: 'rgba(99,102,241,0.07)',
            borderRadius: 6, padding: '3px 9px', display: 'inline-block',
            marginBottom: 12, letterSpacing: '0.02em',
          }}>
            {sub.challenges.title}
          </div>
        )}
      </div>

      {/* Comments */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '12px 16px 14px' }}>
        {comments.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            {comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: '#fff', overflow: 'hidden',
                }}>
                  {c.profiles?.avatar_url
                    ? <img src={c.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    : (c.profiles?.name ?? '?').slice(0, 1).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#9999cc' }}>{c.profiles?.name ?? '익명'}</span>
                    <span style={{ fontSize: 10, color: '#333355' }}>{timeAgo(c.created_at)}</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#8888b8', lineHeight: 1.5, margin: 0 }}>{c.content}</p>
                </div>
                {c.user_id === currentUserId && (
                  <button onClick={() => onDeleteComment(c.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#2a2a40', fontSize: 11, padding: '2px 4px', flexShrink: 0,
                  }}>
                    삭제
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Comment toggle + input */}
        {!showInput ? (
          <button onClick={toggleInput} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#4444aa', fontSize: 13, fontWeight: 600, padding: 0,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2h10v8H8l-3 2V10H2V2z" stroke="#4444aa" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
            {comments.length > 0 ? `댓글 ${comments.length}` : '댓글 달기'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="댓글을 입력하세요"
              onKeyDown={e => { if (e.key === 'Enter') handleComment() }}
              style={{
                flex: 1, background: '#0a0a18',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 9, padding: '9px 12px',
                fontSize: 13, color: '#e4e4f8', outline: 'none',
              }}
            />
            <button onClick={handleComment} style={{
              padding: '9px 14px', borderRadius: 9,
              background: '#4f46e5', color: '#fff',
              fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
            }}>
              등록
            </button>
            <button onClick={() => setShowInput(false)} style={{
              padding: '9px 10px', borderRadius: 9,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.07)',
              color: '#333358', fontSize: 13, cursor: 'pointer',
            }}>
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
