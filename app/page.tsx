'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import dynamic from 'next/dynamic'
const ChordPlayer = dynamic(() => import('./components/ChordPlayer'), { ssr: false })

type Progression = { label: string; chords: string[]; style?: string; tempo?: number }
type Challenge = {
  id: string
  date: string
  title: string
  description?: string
  chords: { progressions: Progression[] }
}
type Submission = {
  id: string
  video_url: string
  caption?: string
  likes_count: number
  created_at: string
  user_liked?: boolean
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

function calcStreak(dates: string[]) {
  const uniq = [...new Set(dates)].sort().reverse()
  if (uniq.length === 0) return 0
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (uniq[0] !== today && uniq[0] !== yesterday) return 0
  let streak = 0, checkDate = uniq[0]
  for (const d of uniq) {
    if (d === checkDate) {
      streak++
      const dt = new Date(checkDate); dt.setDate(dt.getDate() - 1)
      checkDate = dt.toISOString().slice(0, 10)
    } else break
  }
  return streak
}

export default function HomePage() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest')
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    const today = new Date().toISOString().slice(0, 10)
    const { data: ch } = await supabase
      .from('challenges')
      .select('*')
      .eq('date', today)
      .single()
    setChallenge(ch)

    if (ch) {
      const { data: subs } = await supabase
        .from('submissions')
        .select('*, profiles(name, avatar_url)')
        .eq('challenge_id', ch.id)
        .is('group_id', null)
        .order('created_at', { ascending: false })

      if (subs && user) {
        const { data: userLikes } = await supabase
          .from('likes')
          .select('submission_id')
          .eq('user_id', user.id)
        const likedIds = new Set(userLikes?.map(l => l.submission_id) || [])
        setSubmissions(subs.map(s => ({ ...s, user_liked: likedIds.has(s.id) })))
      } else {
        setSubmissions(subs || [])
      }
    }

    if (user) {
      const { data: myDates } = await supabase
        .from('submissions')
        .select('created_at')
        .eq('user_id', user.id)
      setStreak(calcStreak(myDates?.map(s => s.created_at.slice(0, 10)) ?? []))
    }

    setLoading(false)
  }, [])

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

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
  }

  const today = new Date()
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`
  const isAdmin = user?.email === 'noid80@hanmail.net'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#08080f', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', opacity: 0.8 }} />
      <span style={{ color: '#333358', fontSize: 14, fontWeight: 600 }}>불러오는 중</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#08080f' }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,8,15,0.95)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '0 20px', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
              <line x1="1" y1="2" x2="12" y2="2" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="1" y1="5" x2="12" y2="5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="1" y1="8" x2="9"  y2="8" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, color: '#e0e0f8', letterSpacing: '-0.03em' }}>
            코드 챌린지
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAdmin && (
            <Link href="/admin" style={{
              padding: '5px 11px', borderRadius: 7,
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.2)',
              color: '#7777cc', fontSize: 12, fontWeight: 700,
            }}>
              관리
            </Link>
          )}
          {user ? (
            <>
              <Link href="/ranking" style={{ color: '#555588', fontSize: 12, fontWeight: 700, padding: '4px 6px' }}>
                랭킹
              </Link>
              <Link href="/my-videos" style={{ color: '#555588', fontSize: 12, fontWeight: 700, padding: '4px 6px' }}>
                내 기록
              </Link>
              <Link href="/groups" style={{
                padding: '6px 12px', borderRadius: 8,
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.15)',
                color: '#8888cc', fontSize: 13, fontWeight: 700,
              }}>
                크루
              </Link>
              <Link href="/upload" style={{
                padding: '6px 14px', borderRadius: 8,
                background: '#4f46e5',
                color: '#fff', fontSize: 13, fontWeight: 700,
              }}>
                업로드
              </Link>
              <button onClick={handleLogout} style={{
                background: 'none', border: 'none',
                color: '#333358', fontSize: 12, cursor: 'pointer', padding: '4px 6px',
              }}>
                로그아웃
              </button>
            </>
          ) : (
            <Link href="/login" style={{
              padding: '6px 14px', borderRadius: 8,
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.2)',
              color: '#7777cc', fontSize: 13, fontWeight: 700,
            }}>
              로그인
            </Link>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px 100px' }}>

        {/* Date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#6366f1' }} />
          <span style={{ fontSize: 11, color: '#4444aa', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            오늘의 챌린지 · {dateStr}
          </span>
        </div>

        {/* Challenge */}
        <section style={{ marginBottom: 48 }}>
          {challenge ? (
            <div style={{
              background: '#0d0d1e',
              border: '1px solid rgba(99,102,241,0.15)',
              borderRadius: 20,
              padding: 22,
            }}>
              <h2 style={{
                fontSize: 19, fontWeight: 900, color: '#e4e4f8',
                letterSpacing: '-0.025em',
                marginBottom: challenge.description ? 6 : 20,
              }}>
                {challenge.title}
              </h2>
              {challenge.description && (
                <p style={{ fontSize: 13, color: '#6666a0', lineHeight: 1.7, marginBottom: 20 }}>
                  {challenge.description}
                </p>
              )}
              <ChordPlayer
                progressions={challenge.chords?.progressions ?? []}
                title={challenge.title}
              />
              <div style={{ marginTop: 14 }}>
                {user ? (
                  <Link href="/upload" style={{
                    display: 'block', padding: '13px',
                    borderRadius: 12,
                    background: '#4f46e5',
                    color: '#fff', fontSize: 14, fontWeight: 800, textAlign: 'center',
                    letterSpacing: '-0.01em',
                  }}>
                    챌린지 참여하기
                  </Link>
                ) : (
                  <Link href="/login" style={{
                    display: 'block', padding: '13px',
                    borderRadius: 12,
                    background: 'rgba(99,102,241,0.08)',
                    border: '1px solid rgba(99,102,241,0.18)',
                    color: '#7777cc', fontSize: 14, fontWeight: 700, textAlign: 'center',
                  }}>
                    로그인하고 참여하기
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              background: '#0d0d1e',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 20, padding: '48px 20px', textAlign: 'center',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 16,
                background: 'rgba(99,102,241,0.06)',
                border: '1px solid rgba(99,102,241,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 18px',
              }}>
                <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
                  {[2,6,10,14,18].map(y => (
                    <line key={y} x1="1" y1={y/10*18} x2="21" y2={y/10*18} stroke="#4444aa" strokeWidth="1" strokeLinecap="round" />
                  ))}
                </svg>
              </div>
              <p style={{ color: '#555588', fontSize: 15, fontWeight: 700, marginBottom: 5 }}>
                오늘의 챌린지를 준비 중이에요
              </p>
              <p style={{ color: '#2e2e52', fontSize: 13 }}>
                매일 새로운 코드 진행이 올라와요
              </p>
              {isAdmin && (
                <Link href="/admin" style={{
                  display: 'inline-block', marginTop: 22,
                  padding: '9px 20px', borderRadius: 10,
                  background: 'rgba(99,102,241,0.1)',
                  border: '1px solid rgba(99,102,241,0.25)',
                  color: '#7777cc', fontSize: 13, fontWeight: 700,
                }}>
                  챌린지 생성하기
                </Link>
              )}
            </div>
          )}
        </section>

        {/* Streak banner */}
        {user && streak > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(99,102,241,0.05)',
            border: '1px solid rgba(99,102,241,0.12)',
            borderRadius: 12, padding: '10px 14px', marginBottom: 28,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(99,102,241,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="13" height="14" viewBox="0 0 13 14" fill="none">
                <path d="M6.5 1C6.5 1 10 4 10 7.5C10 9.43 8.43 11 6.5 11C4.57 11 3 9.43 3 7.5C3 6 4 5 4 5C4 5 4.5 7 6 7C6 5.5 5.5 3 6.5 1Z" fill="#7777cc"/>
                <path d="M6.5 11V13" stroke="#7777cc" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#8888cc' }}>
                {streak}일 연속 참여 중
              </span>
              <span style={{ fontSize: 12, color: '#444466', marginLeft: 8 }}>
                {submissions.some(s => s.profiles?.name) ? '오늘도 했어요!' : '오늘도 올려보세요'}
              </span>
            </div>
            <Link href="/my-videos" style={{ fontSize: 11, color: '#4444aa', fontWeight: 700 }}>
              내 기록 →
            </Link>
          </div>
        )}

        {/* Submissions */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#b0b0d8', letterSpacing: '-0.01em' }}>
                오늘의 연주
              </span>
              {submissions.length > 0 && (
                <span style={{
                  fontSize: 11, color: '#6366f1', fontWeight: 800,
                  background: 'rgba(99,102,241,0.1)',
                  border: '1px solid rgba(99,102,241,0.18)',
                  padding: '3px 10px', borderRadius: 20,
                }}>
                  {submissions.length}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setSortBy('newest')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                  fontSize: 12, fontWeight: 700,
                  color: sortBy === 'newest' ? '#8888cc' : '#333355',
                }}
              >
                최신
              </button>
              <span style={{ color: '#222240', fontSize: 11 }}>|</span>
              <button
                onClick={() => setSortBy('popular')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                  fontSize: 12, fontWeight: 700,
                  color: sortBy === 'popular' ? '#8888cc' : '#333355',
                }}
              >
                인기
              </button>
            </div>
          </div>

          {submissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '52px 0' }}>
              <p style={{ color: '#44445a', fontSize: 14, fontWeight: 700 }}>아직 연주가 없어요</p>
              <p style={{ color: '#2a2a42', fontSize: 13, marginTop: 5 }}>첫 번째로 올려보세요</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[...submissions]
                .sort((a, b) => sortBy === 'popular'
                  ? b.likes_count - a.likes_count
                  : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )
                .map(sub => (
                  <SubmissionCard key={sub.id} sub={sub} onLike={() => toggleLike(sub.id, !!sub.user_liked)} />
                ))
              }
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function SubmissionCard({ sub, onLike }: { sub: Submission; onLike: () => void }) {
  const supabase = createClient()
  const videoUrl = sub.video_url.startsWith('http')
    ? sub.video_url
    : supabase.storage.from('videos').getPublicUrl(sub.video_url).data.publicUrl

  const initials = (sub.profiles?.name ?? '?').slice(0, 1).toUpperCase()

  return (
    <div style={{
      background: '#0d0d1e',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 18, overflow: 'hidden',
    }}>
      <video
        src={videoUrl}
        controls
        playsInline
        preload="metadata"
        style={{ width: '100%', display: 'block', background: '#000', maxHeight: 420, objectFit: 'contain' }}
      />
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: '#fff',
              overflow: 'hidden', flexShrink: 0,
            }}>
              {sub.profiles?.avatar_url
                ? <img src={sub.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : initials}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ccccee', lineHeight: 1.2 }}>
                {sub.profiles?.name ?? '익명'}
              </div>
              <div style={{ fontSize: 11, color: '#333358', marginTop: 2 }}>
                {timeAgo(sub.created_at)}
              </div>
            </div>
          </div>
          <button onClick={onLike} style={{
            background: sub.user_liked ? 'rgba(244,114,182,0.08)' : 'transparent',
            border: sub.user_liked ? '1px solid rgba(244,114,182,0.2)' : '1px solid rgba(255,255,255,0.07)',
            borderRadius: 9, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            color: sub.user_liked ? '#f472b6' : '#444466',
            fontSize: 13, fontWeight: 700, padding: '5px 11px',
          }}>
            {sub.user_liked ? '♥' : '♡'}
            <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{sub.likes_count}</span>
          </button>
        </div>
        {sub.caption && (
          <p style={{ fontSize: 13, color: '#7777a0', marginTop: 10, lineHeight: 1.6 }}>
            {sub.caption}
          </p>
        )}
      </div>
    </div>
  )
}
