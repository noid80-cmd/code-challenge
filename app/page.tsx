'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import dynamic from 'next/dynamic'
const ChordPlayer = dynamic(() => import('./components/ChordPlayer'), { ssr: false })

type Progression = { label: string; chords: string[]; style?: string; tempo?: number }
type Challenge = {
  id: string; date: string; title: string; description?: string
  chords: { progressions: Progression[] }
}
type Submission = {
  id: string; video_url: string; caption?: string
  likes_count: number; created_at: string; user_liked?: boolean
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
  const [profile, setProfile] = useState<{ name: string; avatar_url: string | null } | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    const today = new Date().toISOString().slice(0, 10)
    const { data: ch } = await supabase.from('challenges').select('*').eq('date', today).single()
    setChallenge(ch)

    if (ch) {
      const { data: subs } = await supabase
        .from('submissions').select('*, profiles(name, avatar_url)')
        .eq('challenge_id', ch.id).is('group_id', null)
        .order('created_at', { ascending: false })

      if (subs && user) {
        const { data: userLikes } = await supabase.from('likes').select('submission_id').eq('user_id', user.id)
        const likedIds = new Set(userLikes?.map(l => l.submission_id) || [])
        setSubmissions(subs.map(s => ({ ...s, user_liked: likedIds.has(s.id) })))
      } else {
        setSubmissions(subs || [])
      }
    }

    if (user) {
      const { data: myDates } = await supabase.from('submissions').select('created_at').eq('user_id', user.id)
      setStreak(calcStreak(myDates?.map(s => s.created_at.slice(0, 10)) ?? []))
      const { data: prof } = await supabase.from('profiles').select('name, avatar_url').eq('id', user.id).single()
      setProfile(prof)
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
    setUser(null); setProfile(null)
  }

  const today = new Date()
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`
  const isAdmin = user?.email === 'noid80@hanmail.net'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', opacity: 0.7 }} />
      <span style={{ color: '#4a3800', fontSize: 14, fontWeight: 600 }}>불러오는 중</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0d0800 0%, #060400 60%, #0a0600 100%)' }}>

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,6,0,0.88)', backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(245,158,11,0.12)',
        padding: '0 20px', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'linear-gradient(135deg, #fbbf24, #d97706)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(245,158,11,0.4)',
          }}>
            <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
              <line x1="1" y1="2" x2="12" y2="2" stroke="rgba(8,6,0,0.9)" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="1" y1="5" x2="12" y2="5" stroke="rgba(8,6,0,0.9)" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="1" y1="8" x2="8"  y2="8" stroke="rgba(8,6,0,0.9)" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontWeight: 900, fontSize: 16, color: '#fef3c7', letterSpacing: '-0.03em' }}>
            코드 챌린지
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAdmin && (
            <Link href="/admin" style={{
              padding: '5px 11px', borderRadius: 7,
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
              color: '#b58a2a', fontSize: 12, fontWeight: 700,
            }}>관리</Link>
          )}
          {user ? (
            <>
              <Link href="/groups" style={{
                padding: '6px 13px', borderRadius: 8,
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
                color: '#fbbf24', fontSize: 13, fontWeight: 700,
              }}>크루</Link>
              <Link href="/upload" style={{
                padding: '6px 14px', borderRadius: 8,
                background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                color: '#080600', fontSize: 13, fontWeight: 800,
                boxShadow: '0 3px 12px rgba(245,158,11,0.35)',
              }}>업로드</Link>
              <Link href="/my-videos" style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', overflow: 'hidden',
                  background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, color: '#080600',
                  boxShadow: '0 2px 10px rgba(245,158,11,0.4)',
                  flexShrink: 0,
                }}>
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    : (profile?.name ?? user.email ?? '?').slice(0, 1).toUpperCase()}
                </div>
              </Link>
              <button onClick={handleLogout} style={{
                background: 'none', border: 'none',
                color: '#2a2000', fontSize: 11, cursor: 'pointer', padding: '4px 2px',
              }}>로그아웃</button>
            </>
          ) : (
            <Link href="/login" style={{
              padding: '6px 14px', borderRadius: 8,
              background: 'linear-gradient(135deg, #fbbf24, #d97706)',
              color: '#080600', fontSize: 13, fontWeight: 800,
            }}>로그인</Link>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px 100px' }}>

        {/* Date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b' }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#b58a2a' }}>
            오늘의 챌린지 · {dateStr}
          </span>
        </div>

        {/* Challenge card */}
        <section style={{ marginBottom: 40 }}>
          {challenge ? (
            <div style={{
              background: 'linear-gradient(145deg, #130c00, #0c0700)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 22, padding: 22,
              boxShadow: '0 0 0 1px rgba(245,158,11,0.06), 0 24px 60px rgba(245,158,11,0.1)',
            }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fef3c7', letterSpacing: '-0.025em',
                marginBottom: challenge.description && challenge.description !== challenge.title ? 6 : 18 }}>
                {challenge.title}
              </h2>
              {challenge.description && challenge.description !== challenge.title && (
                <p style={{ fontSize: 13, color: '#6b5010', lineHeight: 1.7, marginBottom: 18 }}>
                  {challenge.description}
                </p>
              )}
              <ChordPlayer progressions={challenge.chords?.progressions ?? []} title={challenge.title} />
              <div style={{ marginTop: 16 }}>
                {user ? (
                  <Link href="/upload" style={{
                    display: 'block', padding: '14px', borderRadius: 13,
                    background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                    color: '#080600', fontSize: 14, fontWeight: 800, textAlign: 'center',
                    letterSpacing: '-0.01em',
                    boxShadow: '0 6px 24px rgba(245,158,11,0.4)',
                  }}>
                    챌린지 참여하기
                  </Link>
                ) : (
                  <Link href="/login" style={{
                    display: 'block', padding: '14px', borderRadius: 13,
                    background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                    color: '#080600', fontSize: 14, fontWeight: 800, textAlign: 'center',
                    boxShadow: '0 6px 24px rgba(245,158,11,0.35)',
                  }}>
                    로그인하고 참여하기
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              background: 'linear-gradient(145deg, #130c00, #0c0700)',
              border: '1px solid rgba(245,158,11,0.08)',
              borderRadius: 22, padding: '48px 20px', textAlign: 'center',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 16,
                background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px',
              }}>
                <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
                  {[0,1,2,3,4].map(i => (
                    <line key={i} x1="1" y1={3 + i * 3.5} x2="21" y2={3 + i * 3.5} stroke="#4a3800" strokeWidth="1" strokeLinecap="round" />
                  ))}
                </svg>
              </div>
              <p style={{ color: '#6b5010', fontSize: 15, fontWeight: 700, marginBottom: 5 }}>오늘의 챌린지를 준비 중이에요</p>
              <p style={{ color: '#4a3800', fontSize: 13 }}>매일 새로운 코드 진행이 올라와요</p>
              {isAdmin && (
                <Link href="/admin" style={{
                  display: 'inline-block', marginTop: 22, padding: '9px 20px', borderRadius: 10,
                  background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                  color: '#080600', fontSize: 13, fontWeight: 700,
                }}>챌린지 생성하기</Link>
              )}
            </div>
          )}
        </section>

        {/* Streak */}
        {user && streak > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.15)',
            borderRadius: 14, padding: '12px 16px', marginBottom: 28,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'rgba(245,158,11,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 18 }}>🔥</span>
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24' }}>{streak}일 연속 참여 중</span>
              <p style={{ fontSize: 12, color: '#6b5010', margin: 0, marginTop: 1 }}>오늘도 올려보세요</p>
            </div>
            <Link href="/my-videos" style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700 }}>
              내 기록 →
            </Link>
          </div>
        )}

        {/* Submissions */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#e8c97a', letterSpacing: '-0.01em' }}>
                오늘의 연주
              </span>
              {submissions.length > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 800,
                  background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                  color: '#080600', padding: '2px 9px', borderRadius: 20,
                }}>
                  {submissions.length}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link href="/ranking" style={{ fontSize: 12, color: '#4a3800', fontWeight: 700 }}>주간랭킹</Link>
              <span style={{ color: '#2a2000', fontSize: 11 }}>·</span>
              <button onClick={() => setSortBy('newest')} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 12, fontWeight: 700,
                color: sortBy === 'newest' ? '#fbbf24' : '#4a3800',
              }}>최신</button>
              <span style={{ color: '#2a2000', fontSize: 11 }}>|</span>
              <button onClick={() => setSortBy('popular')} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 12, fontWeight: 700,
                color: sortBy === 'popular' ? '#fbbf24' : '#4a3800',
              }}>인기</button>
            </div>
          </div>

          {submissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ color: '#4a3800', fontSize: 14, fontWeight: 700, marginBottom: 5 }}>아직 연주가 없어요</p>
              <p style={{ color: '#2a2000', fontSize: 13, marginTop: 5 }}>첫 번째로 올려보세요</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[...submissions]
                .sort((a, b) => sortBy === 'popular'
                  ? b.likes_count - a.likes_count
                  : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )
                .map(sub => (
                  <SubmissionCard key={sub.id} sub={sub} onLike={() => toggleLike(sub.id, !!sub.user_liked)} />
                ))}
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
      background: 'linear-gradient(145deg, #130c00, #0c0700)',
      border: '1px solid rgba(245,158,11,0.1)',
      borderRadius: 20, overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <video src={videoUrl} controls playsInline preload="metadata"
        style={{ width: '100%', display: 'block', background: '#000', maxHeight: 460, objectFit: 'contain' }} />

      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #fbbf24, #d97706)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#080600',
              overflow: 'hidden', flexShrink: 0,
              boxShadow: '0 2px 10px rgba(245,158,11,0.3)',
            }}>
              {sub.profiles?.avatar_url
                ? <img src={sub.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : initials}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fef3c7', lineHeight: 1.2 }}>
                {sub.profiles?.name ?? '익명'}
              </div>
              <div style={{ fontSize: 11, color: '#4a3800', marginTop: 2 }}>{timeAgo(sub.created_at)}</div>
            </div>
          </div>

          <button onClick={onLike} style={{
            background: sub.user_liked
              ? 'rgba(245,158,11,0.12)'
              : 'rgba(255,255,255,0.02)',
            border: sub.user_liked ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            color: sub.user_liked ? '#f59e0b' : '#4a3800',
            fontSize: 14, fontWeight: 800, padding: '7px 13px',
            transition: 'all 0.2s',
          }}>
            {sub.user_liked ? '♥' : '♡'}
            <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{sub.likes_count}</span>
          </button>
        </div>

        {sub.caption && (
          <p style={{ fontSize: 13, color: '#7a6020', marginTop: 10, lineHeight: 1.6 }}>{sub.caption}</p>
        )}
      </div>
    </div>
  )
}
