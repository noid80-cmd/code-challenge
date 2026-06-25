'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import dynamic from 'next/dynamic'
const ChordPlayer = dynamic(() => import('@/app/components/ChordPlayer'), { ssr: false })
import { localDate } from '@/lib/date'

type Progression = { label: string; chords: string[] | string[][]; style?: string; tempo?: number }
type Challenge = { id: string; date: string; title: string; description?: string; chords: { progressions: Progression[] } }
type Submission = {
  id: string; video_url: string; caption?: string
  likes_count: number; created_at: string; user_liked?: boolean
  progression_index?: number; thumbnail_url?: string | null
  profiles: { name: string; avatar_url?: string } | null
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

export default function ChallengePage() {
  const { id } = useParams<{ id: string }>()
  const [user, setUser] = useState<User | null>(null)
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    const { data: ch } = await supabase.from('challenges').select('*').eq('id', id).single()
    setChallenge(ch)

    if (ch) {
      const { data: subs } = await supabase
        .from('submissions').select('*, profiles(name, avatar_url)')
        .eq('challenge_id', ch.id).is('group_id', null).eq('is_private', false)
        .order('created_at', { ascending: false })

      if (subs && user) {
        const { data: userLikes } = await supabase.from('likes').select('submission_id').eq('user_id', user.id)
        const likedIds = new Set(userLikes?.map(l => l.submission_id) || [])
        setSubmissions(subs.map(s => ({ ...s, user_liked: likedIds.has(s.id) })))
      } else {
        setSubmissions(subs || [])
      }
    }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function toggleLike(submissionId: string, liked: boolean) {
    if (!user) { window.location.href = '/login'; return }
    const supabase = createClient()
    if (liked) {
      await supabase.from('likes').delete().eq('submission_id', submissionId).eq('user_id', user.id)
    } else {
      await supabase.from('likes').insert({ submission_id: submissionId, user_id: user.id })
    }
    setSubmissions(prev => prev.map(s => s.id === submissionId
      ? { ...s, user_liked: !liked, likes_count: liked ? s.likes_count - 1 : s.likes_count + 1 }
      : s
    ))
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a08', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f0ece0', opacity: 0.7 }} />
      <span style={{ color: '#303028', fontSize: 14, fontWeight: 600 }}>불러오는 중</span>
    </div>
  )

  if (!challenge) return (
    <div style={{ minHeight: '100vh', background: '#0a0a08', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#303028', fontSize: 14 }}>챌린지를 찾을 수 없어요</p>
    </div>
  )

  const today = localDate()
  const isToday = challenge.date === today
  const progressions = challenge.chords?.progressions ?? []

  const sorted = [...submissions].sort((a, b) =>
    sortBy === 'popular'
      ? b.likes_count - a.likes_count
      : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
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
        <Link href="/challenges" style={{ color: '#605850', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          아카이브
        </Link>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#403830', letterSpacing: '0.04em' }}>{challenge.date}</span>
        <div style={{ width: 60 }} />
      </header>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '28px 16px max(120px, calc(100px + env(safe-area-inset-bottom)))' }}>

        {/* 챌린지 카드 */}
        <div style={{
          background: 'linear-gradient(145deg, #111110, #0d0d0c)',
          border: '1px solid rgba(240,236,224,0.2)',
          borderRadius: 22, padding: 22, marginBottom: 32,
          boxShadow: '0 0 0 1px rgba(240,236,224,0.06), 0 24px 60px rgba(240,236,224,0.08)',
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#f0ece0', letterSpacing: '-0.025em',
            marginBottom: challenge.description && challenge.description !== challenge.title ? 6 : 18 }}>
            {challenge.title}
          </h2>
          {challenge.description && challenge.description !== challenge.title && (
            <p style={{ fontSize: 13, color: '#605850', lineHeight: 1.7, marginBottom: 18 }}>
              {challenge.description}
            </p>
          )}
          <div style={{ overflowX: 'auto' }}>
            <ChordPlayer progressions={progressions} title={challenge.title} />
          </div>
          {isToday && user && (
            <div style={{ marginTop: 16 }}>
              <Link href="/upload" style={{
                display: 'block', padding: '14px', borderRadius: 13,
                background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                color: '#0a0a08', fontSize: 14, fontWeight: 800, textAlign: 'center',
                letterSpacing: '-0.01em',
                boxShadow: '0 6px 24px rgba(240,236,224,0.4)',
              }}>
                챌린지 참여하기
              </Link>
            </div>
          )}
        </div>

        {/* 연주 목록 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#e0dcd0', letterSpacing: '-0.01em' }}>
              연주
            </span>
            {submissions.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 800,
                background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                color: '#0a0a08', padding: '2px 9px', borderRadius: 20,
              }}>
                {submissions.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setSortBy('newest')} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontSize: 12, fontWeight: 700,
              color: sortBy === 'newest' ? '#f8f4ec' : '#303028',
            }}>최신</button>
            <span style={{ color: '#1a1a18', fontSize: 11 }}>|</span>
            <button onClick={() => setSortBy('popular')} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontSize: 12, fontWeight: 700,
              color: sortBy === 'popular' ? '#f8f4ec' : '#303028',
            }}>인기</button>
          </div>
        </div>

        {submissions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ color: '#303028', fontSize: 14, fontWeight: 700, marginBottom: 5 }}>아직 연주가 없어요</p>
            {isToday && <p style={{ color: '#1a1a18', fontSize: 13 }}>첫 번째로 올려보세요</p>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {sorted.map(sub => (
              <SubmissionCard key={sub.id} sub={sub} onLike={() => toggleLike(sub.id, !!sub.user_liked)} progressions={progressions} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function SubmissionCard({ sub, onLike, progressions }: { sub: Submission; onLike: () => void; progressions: Progression[] }) {
  const supabase = createClient()
  const videoUrl = sub.video_url.startsWith('http')
    ? sub.video_url
    : supabase.storage.from('videos').getPublicUrl(sub.video_url).data.publicUrl
  const posterUrl = sub.thumbnail_url
    ? sub.thumbnail_url.startsWith('http')
      ? sub.thumbnail_url
      : supabase.storage.from('videos').getPublicUrl(sub.thumbnail_url).data.publicUrl
    : undefined
  const initials = (sub.profiles?.name ?? '?').slice(0, 1).toUpperCase()

  return (
    <div style={{
      background: 'linear-gradient(145deg, #111110, #0d0d0c)',
      border: '1px solid rgba(240,236,224,0.1)',
      borderRadius: 20, overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      {progressions.length > 1 && sub.progression_index != null && (
        <div style={{
          padding: '8px 14px',
          borderBottom: '1px solid rgba(240,236,224,0.06)',
          background: 'rgba(240,236,224,0.04)',
        }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#a0988c', letterSpacing: '0.05em' }}>
            {progressions[sub.progression_index]?.label ?? `진행 ${sub.progression_index + 1}`}
          </span>
        </div>
      )}
      <video src={videoUrl} poster={posterUrl} controls playsInline preload="metadata"
        style={{ width: '100%', display: 'block', background: '#000', maxHeight: 460, objectFit: 'contain' }} />

      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#0a0a08',
              overflow: 'hidden', flexShrink: 0,
            }}>
              {sub.profiles?.avatar_url
                ? <img src={sub.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : initials}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#f0ece0', lineHeight: 1.2 }}>
                {sub.profiles?.name ?? '익명'}
              </div>
              <div style={{ fontSize: 11, color: '#303028', marginTop: 2 }}>{timeAgo(sub.created_at)}</div>
            </div>
          </div>

          <button onClick={onLike} style={{
            background: sub.user_liked ? 'rgba(240,236,224,0.12)' : 'rgba(255,255,255,0.02)',
            border: sub.user_liked ? '1px solid rgba(240,236,224,0.4)' : '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            color: sub.user_liked ? '#f0ece0' : '#303028',
            fontSize: 14, fontWeight: 800, padding: '7px 13px',
          }}>
            {sub.user_liked ? '♥' : '♡'}
            <span style={{ fontSize: 13 }}>{sub.likes_count}</span>
          </button>
        </div>

        {sub.caption && (
          <p style={{ fontSize: 13, color: '#7a6020', marginTop: 10, lineHeight: 1.6 }}>{sub.caption}</p>
        )}
      </div>
    </div>
  )
}
