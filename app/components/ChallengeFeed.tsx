'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import dynamic from 'next/dynamic'
import { localDate, challengeDate } from '@/lib/date'

const ChordPlayer = dynamic(() => import('./ChordPlayer'), { ssr: false })
const RhythmViewer = dynamic(() => import('./RhythmViewer'), { ssr: false })
const MelodyPlayer = dynamic(() => import('./MelodyPlayer'), { ssr: false })

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

function PushBanner({ user }: { user: User }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [supported, setSupported] = useState(false)
  const [alreadyGranted, setAlreadyGranted] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setSupported(true)
    if (Notification.permission === 'granted') setAlreadyGranted(true)
  }, [])

  if (!supported || alreadyGranted || state === 'done') return null

  async function subscribe() {
    setState('loading')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })
      setState('done')
    } catch {
      setState('idle')
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'rgba(240,236,224,0.06)', border: '1px solid rgba(240,236,224,0.15)',
      borderRadius: 14, padding: '12px 16px', marginBottom: 20,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#f0ece0', marginBottom: 2 }}>매일 알림 받기</div>
        <div style={{ fontSize: 11, color: '#605850' }}>낮 12시에 오늘의 챌린지를 알려드려요</div>
      </div>
      <button onClick={subscribe} disabled={state === 'loading'} style={{
        padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
        color: '#0a0a08', fontSize: 12, fontWeight: 800,
        opacity: state === 'loading' ? 0.6 : 1, flexShrink: 0,
      }}>
        {state === 'loading' ? '설정 중...' : '알림 켜기'}
      </button>
    </div>
  )
}

type Progression = { label: string; chords: string[]; style?: string; tempo?: number }
type Challenge = {
  id: string; date: string; title: string; description?: string; level: string
  type: 'chord' | 'rhythm' | 'melody'
  chords: { progressions?: Progression[]; patterns?: { label: string; abc: string }[] }
}
type Submission = {
  id: string; challenge_id: string; video_url: string; caption?: string
  likes_count: number; created_at: string; user_liked?: boolean
  progression_index?: number; thumbnail_url?: string | null
  user_id: string
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
  const today = localDate()
  const yesterday = localDate(new Date(Date.now() - 86400000))
  if (uniq[0] !== today && uniq[0] !== yesterday) return 0
  let streak = 0, checkDate = uniq[0]
  for (const d of uniq) {
    if (d === checkDate) {
      streak++
      const dt = new Date(checkDate); dt.setDate(dt.getDate() - 1)
      checkDate = localDate(dt)
    } else break
  }
  return streak
}

export default function ChallengeFeed({ type }: { type: 'chord' | 'rhythm' | 'melody' }) {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [extraChallenges, setExtraChallenges] = useState<Challenge[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest')
  const [filterProg, setFilterProg] = useState<number | 'all'>('all')
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isBeforeNoon, setIsBeforeNoon] = useState(false)
  const [profile, setProfile] = useState<{ name: string; avatar_url: string | null } | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [uploadedToday, setUploadedToday] = useState(false)
  const [challengeOpen, setChallengeOpen] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    const { date: chDate, isBeforeNoon } = challengeDate()
    setIsBeforeNoon(isBeforeNoon)
    const { data: chAll, error: chError } = await supabase.from('challenges').select('*')
      .eq('date', chDate).eq('type', type)
      .order('seq', { ascending: true })
    if (chError) console.error('[ChallengeFeed] challenge query error:', chError)
    const ch = chAll?.[0] ?? null
    setChallenge(ch)
    setExtraChallenges(chAll?.slice(1) ?? [])

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

      const { count } = await supabase
        .from('submissions').select('*', { count: 'exact', head: true }).eq('challenge_id', ch.id)
      setTotalCount(count ?? 0)
    }

    if (user) {
      const { data: myDates } = await supabase.from('submissions').select('created_at').eq('user_id', user.id)
      const dates = myDates?.map(s => localDate(new Date(s.created_at))) ?? []
      setStreak(calcStreak(dates))
      setUploadedToday(dates.includes(localDate()))
      const { data: prof } = await supabase.from('profiles').select('name, avatar_url').eq('id', user.id).single()
      setProfile(prof)
    }

    setLoading(false)
  }, [type])

  useEffect(() => { load() }, [load])

  async function toggleLike(submissionId: string, liked: boolean) {
    if (!user) { window.location.href = '/login?from=' + encodeURIComponent(window.location.pathname); return }
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

  void handleLogout

  const today = new Date()
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`
  const isAdmin = user?.email === 'noid80@hanmail.net'
  const typeLabel = type === 'chord' ? '코드챌린지' : type === 'rhythm' ? '리듬챌린지' : '멜로디챌린지'
  const typeEmoji = type === 'chord' ? '🎵' : type === 'rhythm' ? '🥁' : '🎼'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a08', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
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
        padding: '0 16px', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(240,236,224,0.4)',
          }}>
            <svg width="14" height="13" viewBox="0 0 14 13" fill="none">
              <path d="M1.5 6L7 1.5L12.5 6" stroke="rgba(4,7,0,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 5V11.5H11V5" stroke="rgba(4,7,0,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </Link>

        {/* 타입 스위처 */}
        <div style={{ position: 'relative', display: 'flex', background: 'rgba(240,236,224,0.06)', borderRadius: 11, padding: 3 }}>
          <div style={{
            position: 'absolute', top: 3, left: 3, width: 36, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
            boxShadow: '0 2px 8px rgba(240,236,224,0.25)',
            transform: `translateX(${(['chord', 'rhythm', 'melody'] as const).indexOf(type) * 36}px)`,
            transition: 'transform 0.25s cubic-bezier(0.34, 1.2, 0.64, 1)',
          }} />
          {(['chord', 'rhythm', 'melody'] as const).map(t => {
            const active = type === t
            const iconColor = active ? 'rgba(4,7,0,0.85)' : 'rgba(240,236,224,0.4)'
            return (
              <Link key={t} href={`/${t}`} style={{
                position: 'relative', zIndex: 1,
                width: 36, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                textDecoration: 'none',
              }}>
                {t === 'chord' && (
                  <svg width="16" height="13" viewBox="0 0 22 18" fill="none">
                    <line x1="1" y1="3" x2="21" y2="3" stroke={iconColor} strokeWidth="2" strokeLinecap="round"/>
                    <line x1="1" y1="9" x2="21" y2="9" stroke={iconColor} strokeWidth="2" strokeLinecap="round"/>
                    <line x1="1" y1="15" x2="14" y2="15" stroke={iconColor} strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                )}
                {t === 'rhythm' && (
                  <svg width="16" height="13" viewBox="0 0 22 18" fill="none">
                    <rect x="1" y="6" width="4" height="10" rx="1.5" fill={iconColor}/>
                    <rect x="7" y="3" width="4" height="13" rx="1.5" fill={iconColor}/>
                    <rect x="13" y="1" width="4" height="15" rx="1.5" fill={iconColor}/>
                    <rect x="19" y="4" width="2" height="12" rx="1" fill={iconColor}/>
                  </svg>
                )}
                {t === 'melody' && (
                  <svg width="16" height="13" viewBox="0 0 22 18" fill="none">
                    <circle cx="5" cy="14" r="3.2" fill={iconColor}/>
                    <circle cx="16" cy="11" r="3.2" fill={iconColor}/>
                    <line x1="8" y1="14" x2="8" y2="2" stroke={iconColor} strokeWidth="1.8" strokeLinecap="round"/>
                    <line x1="19" y1="11" x2="19" y2="2" stroke={iconColor} strokeWidth="1.8" strokeLinecap="round"/>
                    <line x1="8" y1="2" x2="19" y2="2" stroke={iconColor} strokeWidth="2.4" strokeLinecap="round"/>
                  </svg>
                )}
              </Link>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isAdmin && (
            <Link href="/admin" style={{
              padding: '5px 9px', borderRadius: 7,
              background: 'rgba(240,236,224,0.1)', border: '1px solid rgba(240,236,224,0.2)',
              color: '#a0988c', fontSize: 12, fontWeight: 700,
            }}>관리</Link>
          )}
          {user ? (
            <>
              <Link href={`/upload?type=${type}`} style={{
                padding: '6px 14px', borderRadius: 8,
                background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                color: '#0a0a08', fontSize: 13, fontWeight: 800,
                boxShadow: '0 3px 12px rgba(240,236,224,0.35)',
              }}>업로드</Link>
              <Link href="/groups" style={{
                padding: '6px 14px', borderRadius: 8,
                background: 'rgba(240,236,224,0.08)', border: '1px solid rgba(240,236,224,0.15)',
                color: '#a0988c', fontSize: 13, fontWeight: 800,
              }}>그룹</Link>
              <Link href="/my-videos" style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', overflow: 'hidden',
                  background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, color: '#0a0a08',
                  boxShadow: '0 2px 10px rgba(240,236,224,0.4)', flexShrink: 0,
                }}>
                  {(profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture)
                    ? <img src={profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    : (profile?.name ?? user.email ?? '?').slice(0, 1).toUpperCase()}
                </div>
              </Link>
            </>
          ) : (
            <Link href={`/login?from=/${type}`} style={{
              padding: '6px 14px', borderRadius: 8,
              background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
              color: '#0a0a08', fontSize: 13, fontWeight: 800,
            }}>로그인</Link>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px 100px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#f0ece0' }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#a0988c' }}>
            오늘의 챌린지 · {dateStr}
          </span>
        </div>

        {isBeforeNoon && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(240,236,224,0.05)', border: '1px solid rgba(240,236,224,0.12)',
            borderRadius: 14, padding: '11px 16px', marginBottom: 16,
          }}>
            <span style={{ fontSize: 15 }}>🌅</span>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#a0988c' }}>오늘의 챌린지는 낮 12시에 올라와요</span>
              <span style={{ fontSize: 12, color: '#484640', marginLeft: 8 }}>지금은 어제 챌린지예요</span>
            </div>
          </div>
        )}

        <section style={{ marginBottom: 40 }}>
          {challenge ? (
            <div style={{
              background: 'linear-gradient(145deg, #111110, #0d0d0c)',
              border: '1px solid rgba(240,236,224,0.2)', borderRadius: 22, padding: 22,
              boxShadow: '0 0 0 1px rgba(240,236,224,0.06), 0 24px 60px rgba(240,236,224,0.1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: challengeOpen ? (challenge.description && challenge.description !== challenge.title ? 6 : 18) : 0 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: '#f0ece0', letterSpacing: '-0.025em', margin: 0, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {challenge.title}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {challenge.level && (() => {
                    const levelMap: Record<string, { label: string; color: string; bg: string; border: string }> = {
                      beginner:     { label: '초급', color: '#6fcf8a', bg: 'rgba(111,207,138,0.12)', border: 'rgba(111,207,138,0.3)' },
                      intermediate: { label: '중급', color: '#f0c060', bg: 'rgba(240,192,96,0.12)',  border: 'rgba(240,192,96,0.3)'  },
                      advanced:     { label: '고급', color: '#e07060', bg: 'rgba(224,112,96,0.12)',  border: 'rgba(224,112,96,0.3)'  },
                    }
                    const lv = levelMap[challenge.level] ?? levelMap.intermediate
                    return (
                      <span style={{
                        fontSize: 11, fontWeight: 800,
                        color: lv.color, background: lv.bg, border: `1px solid ${lv.border}`,
                        borderRadius: 7, padding: '3px 9px', letterSpacing: '0.04em',
                      }}>{lv.label}</span>
                    )
                  })()}
                  <button onClick={() => setChallengeOpen(o => !o)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#504840', fontSize: 12, padding: '4px 2px', lineHeight: 1,
                  }}>
                    {challengeOpen ? '▴' : '▾'}
                  </button>
                </div>
              </div>
              {challengeOpen && (
                <>
                  {challenge.description && challenge.description !== challenge.title && (
                    <p style={{ fontSize: 13, color: '#605850', lineHeight: 1.7, marginBottom: 18 }}>
                      {challenge.description}
                    </p>
                  )}
                  {type === 'rhythm'
                    ? <RhythmViewer patterns={challenge.chords?.patterns ?? []} />
                    : type === 'melody'
                    ? <MelodyPlayer patterns={challenge.chords?.patterns ?? []} />
                    : <ChordPlayer progressions={challenge.chords?.progressions ?? []} title={challenge.title} />
                  }
                  <div style={{ marginTop: 16 }}>
                    {user ? (
                      <Link href={`/upload?type=${type}`} style={{
                        display: 'block', padding: '14px', borderRadius: 13,
                        background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                        color: '#0a0a08', fontSize: 14, fontWeight: 800, textAlign: 'center',
                        letterSpacing: '-0.01em', boxShadow: '0 6px 24px rgba(240,236,224,0.4)',
                      }}>
                        챌린지 참여하기
                      </Link>
                    ) : (
                      <Link href="/login" style={{
                        display: 'block', padding: '14px', borderRadius: 13,
                        background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                        color: '#0a0a08', fontSize: 14, fontWeight: 800, textAlign: 'center',
                        boxShadow: '0 6px 24px rgba(240,236,224,0.35)',
                      }}>
                        로그인하고 참여하기
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{
              background: 'linear-gradient(145deg, #111110, #0d0d0c)',
              border: '1px solid rgba(240,236,224,0.08)',
              borderRadius: 22, padding: '48px 20px', textAlign: 'center',
            }}>
              <p style={{ color: '#605850', fontSize: 15, fontWeight: 700, marginBottom: 5 }}>오늘의 챌린지를 준비 중이에요</p>
              <p style={{ color: '#303028', fontSize: 13 }}>매일 낮 12시에 새로운 {type === 'rhythm' ? '리듬 패턴' : type === 'melody' ? '멜로디 프레이즈' : '코드 진행'}이 올라와요</p>
              {isAdmin && (
                <Link href="/admin" style={{
                  display: 'inline-block', marginTop: 22, padding: '9px 20px', borderRadius: 10,
                  background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                  color: '#0a0a08', fontSize: 13, fontWeight: 700,
                }}>챌린지 생성하기</Link>
              )}
            </div>
          )}
          {extraChallenges.map(ec => (
            <div key={ec.id} style={{
              marginTop: 16,
              background: 'linear-gradient(145deg, #111110, #0d0d0c)',
              border: '1px solid rgba(240,236,224,0.2)', borderRadius: 22, padding: 22,
              boxShadow: '0 0 0 1px rgba(240,236,224,0.06), 0 24px 60px rgba(240,236,224,0.1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: '#f0ece0', letterSpacing: '-0.025em', margin: 0, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ec.title}
                </h2>
                {ec.level && (() => {
                  const levelMap: Record<string, { label: string; color: string; bg: string; border: string }> = {
                    beginner:     { label: '초급', color: '#6fcf8a', bg: 'rgba(111,207,138,0.12)', border: 'rgba(111,207,138,0.3)' },
                    intermediate: { label: '중급', color: '#f0c060', bg: 'rgba(240,192,96,0.12)',  border: 'rgba(240,192,96,0.3)'  },
                    advanced:     { label: '고급', color: '#e07060', bg: 'rgba(224,112,96,0.12)',  border: 'rgba(224,112,96,0.3)'  },
                  }
                  const lv = levelMap[ec.level] ?? levelMap.intermediate
                  return <span style={{ fontSize: 11, fontWeight: 800, color: lv.color, background: lv.bg, border: `1px solid ${lv.border}`, borderRadius: 7, padding: '3px 9px' }}>{lv.label}</span>
                })()}
              </div>
              {ec.description && ec.description !== ec.title && (
                <p style={{ fontSize: 13, color: '#605850', lineHeight: 1.7, marginBottom: 18 }}>{ec.description}</p>
              )}
              {type === 'melody'
                ? <MelodyPlayer patterns={ec.chords?.patterns ?? []} />
                : <RhythmViewer patterns={ec.chords?.patterns ?? []} />
              }
              <div style={{ marginTop: 16 }}>
                <Link href={`/upload?type=${type}&challenge=${ec.id}`} style={{
                  display: 'block', padding: '14px', borderRadius: 13,
                  background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                  color: '#0a0a08', fontSize: 14, fontWeight: 800, textAlign: 'center',
                  boxShadow: '0 6px 24px rgba(240,236,224,0.4)',
                }}>챌린지 참여하기</Link>
              </div>
            </div>
          ))}
        </section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -28, marginBottom: 28 }}>
          <Link href="/challenges" style={{
            fontSize: 12, fontWeight: 700, color: '#403830',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>지난 챌린지 보기 →</Link>
        </div>

        {user && <PushBanner user={user} />}

        {user && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: uploadedToday ? 'rgba(240,236,224,0.08)' : 'rgba(240,236,224,0.05)',
            border: `1px solid ${streak > 0 && !uploadedToday ? 'rgba(240,180,60,0.3)' : 'rgba(240,236,224,0.15)'}`,
            borderRadius: 14, padding: '12px 16px', marginBottom: 28,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'rgba(240,236,224,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>
              {uploadedToday ? '✓' : streak > 0 ? '🔥' : '🎵'}
            </div>
            <div style={{ flex: 1 }}>
              {uploadedToday ? (
                <>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#f8f4ec' }}>
                    {streak > 0 ? `${streak}일 연속 달성!` : '오늘 참여 완료!'}
                  </span>
                  <p style={{ fontSize: 12, color: '#605850', margin: 0, marginTop: 1 }}>
                    {streak > 1 ? '내일도 이어가면 더 길어져요' : '내일도 올리면 2일 연속이에요'}
                  </p>
                </>
              ) : streak > 0 ? (
                <>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#f8f4ec' }}>{streak}일 연속 중</span>
                  <p style={{ fontSize: 12, color: '#a08040', margin: 0, marginTop: 1 }}>오늘 올리면 {streak + 1}일 연속이에요</p>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#f8f4ec' }}>오늘 첫 연주를 올려보세요</span>
                  <p style={{ fontSize: 12, color: '#605850', margin: 0, marginTop: 1 }}>매일 올리면 연속 기록이 쌓여요</p>
                </>
              )}
            </div>
            <Link href={uploadedToday ? '/my-videos' : `/upload?type=${type}`} style={{
              fontSize: 12, fontWeight: 700, flexShrink: 0,
              color: streak > 0 && !uploadedToday ? '#c8a040' : '#f0ece0',
            }}>
              {uploadedToday ? '내 기록 →' : '업로드 →'}
            </Link>
          </div>
        )}

        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: totalCount > submissions.length ? 4 : 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#e0dcd0', letterSpacing: '-0.01em' }}>오늘의 연주</span>
              {submissions.length > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 800,
                  background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                  color: '#0a0a08', padding: '2px 9px', borderRadius: 20,
                }}>{submissions.length}</span>
              )}
            </div>
            <Link href="/ranking" style={{ fontSize: 12, color: '#303028', fontWeight: 700 }}>주간랭킹</Link>
          </div>
          {totalCount > submissions.length && (
            <p style={{ fontSize: 12, color: '#504840', marginBottom: 10, marginTop: 0 }}>
              오늘 {totalCount}명이 참여했어요
            </p>
          )}

          {type === 'chord' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {(challenge?.chords?.progressions?.length ?? 0) > 1 && (
                  [{ key: 'all' as const, label: '전체' }, ...(challenge?.chords?.progressions ?? []).map((_, i) => ({ key: i as number, label: `진행 ${i + 1}` }))].map(tab => (
                    <button key={String(tab.key)} onClick={() => setFilterProg(tab.key)} style={{
                      padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                      background: filterProg === tab.key ? 'rgba(240,236,224,0.15)' : 'transparent',
                      color: filterProg === tab.key ? '#f0ece0' : '#403830',
                      fontSize: 12, fontWeight: 700,
                      outline: filterProg === tab.key ? '1px solid rgba(240,236,224,0.25)' : '1px solid transparent',
                      transition: 'all 0.15s',
                    }}>{tab.label}</button>
                  ))
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => setSortBy('newest')} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: 12, fontWeight: 700, color: sortBy === 'newest' ? '#f8f4ec' : '#303028',
                }}>최신</button>
                <span style={{ color: '#1a1a18', fontSize: 11 }}>|</span>
                <button onClick={() => setSortBy('popular')} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: 12, fontWeight: 700, color: sortBy === 'popular' ? '#f8f4ec' : '#303028',
                }}>인기</button>
              </div>
            </div>
          )}

          {(type === 'rhythm' || type === 'melody') && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => setSortBy('newest')} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: 12, fontWeight: 700, color: sortBy === 'newest' ? '#f8f4ec' : '#303028',
                }}>최신</button>
                <span style={{ color: '#1a1a18', fontSize: 11 }}>|</span>
                <button onClick={() => setSortBy('popular')} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: 12, fontWeight: 700, color: sortBy === 'popular' ? '#f8f4ec' : '#303028',
                }}>인기</button>
              </div>
            </div>
          )}

          {submissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ color: '#303028', fontSize: 14, fontWeight: 700, marginBottom: 5 }}>아직 연주가 없어요</p>
              <p style={{ color: '#1a1a18', fontSize: 13, marginTop: 5 }}>첫 번째로 올려보세요</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[...submissions]
                .filter(s => type === 'chord' ? (filterProg === 'all' || s.progression_index === filterProg) : true)
                .sort((a, b) => sortBy === 'popular'
                  ? b.likes_count - a.likes_count
                  : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )
                .map(sub => (
                  <SubmissionCard key={sub.id} sub={sub} onLike={() => toggleLike(sub.id, !!sub.user_liked)}
                    progressions={type === 'chord' ? challenge?.chords?.progressions : undefined}
                    patterns={type === 'rhythm' || type === 'melody' ? challenge?.chords?.patterns : undefined} />
                ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function SubmissionCard({ sub, onLike, progressions, patterns }: { sub: Submission; onLike: () => void; progressions?: Progression[]; patterns?: { label: string; abc: string }[] }) {
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
      {progressions && progressions.length > 1 && sub.progression_index != null && (
        <div style={{
          position: 'relative', padding: '8px 14px',
          borderBottom: '1px solid rgba(240,236,224,0.06)',
          background: 'rgba(240,236,224,0.04)',
        }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#a0988c', letterSpacing: '0.05em' }}>
            {progressions[sub.progression_index]?.label ?? `진행 ${sub.progression_index + 1}`}
          </span>
        </div>
      )}
      {patterns && patterns.length > 1 && sub.progression_index != null && (
        <div style={{
          position: 'relative', padding: '8px 14px',
          borderBottom: '1px solid rgba(240,236,224,0.06)',
          background: 'rgba(240,236,224,0.04)',
        }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#a0988c', letterSpacing: '0.05em' }}>
            {patterns[sub.progression_index]?.label ?? `패턴 ${sub.progression_index + 1}`}
          </span>
        </div>
      )}
      <video src={videoUrl} poster={posterUrl} controls playsInline preload="metadata"
        style={{ width: '100%', display: 'block', background: '#000', maxHeight: 460, objectFit: 'contain' }} />
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href={`/profile/${sub.user_id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#0a0a08',
              overflow: 'hidden', flexShrink: 0,
              boxShadow: '0 2px 10px rgba(240,236,224,0.3)',
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
          </Link>
          <button onClick={onLike} style={{
            background: sub.user_liked ? 'rgba(240,236,224,0.12)' : 'rgba(255,255,255,0.02)',
            border: sub.user_liked ? '1px solid rgba(240,236,224,0.4)' : '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            color: sub.user_liked ? '#f0ece0' : '#303028',
            fontSize: 14, fontWeight: 800, padding: '7px 13px', transition: 'all 0.2s',
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
