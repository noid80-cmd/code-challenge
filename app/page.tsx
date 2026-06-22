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

export default function HomePage() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
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
    <div style={{ minHeight: '100vh', background: '#09090f', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', animation: 'pulse 1s infinite' }} />
      <span style={{ color: '#444466', fontSize: 14 }}>불러오는 중...</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#09090f' }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(9,9,15,0.96)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 16px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, boxShadow: '0 0 20px rgba(99,102,241,0.45)',
          }}>🎵</div>
          <span style={{ fontWeight: 900, fontSize: 17, color: '#eeeeff', letterSpacing: '-0.03em' }}>
            코드 챌린지
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAdmin && (
            <Link href="/admin" style={{
              padding: '6px 12px', borderRadius: 8,
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.25)',
              color: '#818cf8', fontSize: 12, fontWeight: 700,
            }}>
              어드민
            </Link>
          )}
          {user ? (
            <>
              <Link href="/upload" style={{
                padding: '7px 15px', borderRadius: 10,
                background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                color: '#fff', fontSize: 13, fontWeight: 700,
                boxShadow: '0 2px 12px rgba(99,102,241,0.4)',
              }}>
                + 업로드
              </Link>
              <button onClick={handleLogout} style={{
                background: 'none', border: 'none',
                color: '#444466', fontSize: 12, cursor: 'pointer', padding: '4px 8px',
              }}>
                로그아웃
              </button>
            </>
          ) : (
            <Link href="/login" style={{
              padding: '7px 15px', borderRadius: 10,
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.25)',
              color: '#818cf8', fontSize: 13, fontWeight: 700,
            }}>
              로그인
            </Link>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '28px 16px 100px' }}>

        {/* Date badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%', background: '#6366f1',
            boxShadow: '0 0 10px rgba(99,102,241,0.9)',
          }} />
          <span style={{
            fontSize: 11, color: '#6366f1', fontWeight: 800,
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            오늘의 챌린지 · {dateStr}
          </span>
        </div>

        {/* Challenge */}
        <section style={{ marginBottom: 40 }}>
          {challenge ? (
            <div style={{
              background: 'linear-gradient(155deg, #0e0e20 0%, #0a0a17 100%)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 22,
              padding: 20,
              boxShadow: '0 0 60px rgba(99,102,241,0.06)',
            }}>
              <h2 style={{
                fontSize: 20, fontWeight: 900, color: '#eeeeff',
                letterSpacing: '-0.02em',
                marginBottom: challenge.description ? 6 : 18,
              }}>
                {challenge.title}
              </h2>
              {challenge.description && (
                <p style={{ fontSize: 13, color: '#7777a8', lineHeight: 1.65, marginBottom: 18 }}>
                  {challenge.description}
                </p>
              )}
              <ChordPlayer
                progressions={challenge.chords?.progressions ?? []}
                defaultTempo={challenge.chords?.progressions?.[0]?.tempo ?? 120}
              />
              {user ? (
                <Link href="/upload" style={{
                  display: 'block', marginTop: 14, padding: '13px',
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                  color: '#fff', fontSize: 14, fontWeight: 800, textAlign: 'center',
                  boxShadow: '0 4px 24px rgba(99,102,241,0.35)',
                  letterSpacing: '-0.01em',
                }}>
                  🎹 챌린지 참여하기
                </Link>
              ) : (
                <Link href="/login" style={{
                  display: 'block', marginTop: 14, padding: '13px',
                  borderRadius: 14,
                  background: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  color: '#818cf8', fontSize: 14, fontWeight: 700, textAlign: 'center',
                }}>
                  로그인하고 참여하기
                </Link>
              )}
            </div>
          ) : (
            <div style={{
              background: '#0d0d1a',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 22, padding: '44px 20px', textAlign: 'center',
            }}>
              <div style={{
                width: 68, height: 68, borderRadius: 22,
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, margin: '0 auto 18px',
              }}>🎼</div>
              <p style={{ color: '#666688', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                오늘의 챌린지를 준비 중이에요
              </p>
              <p style={{ color: '#333352', fontSize: 13 }}>
                매일 새로운 코드 진행이 올라와요
              </p>
              {isAdmin && (
                <Link href="/admin" style={{
                  display: 'inline-block', marginTop: 22,
                  padding: '10px 22px', borderRadius: 12,
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  color: '#818cf8', fontSize: 13, fontWeight: 700,
                }}>
                  챌린지 생성하기
                </Link>
              )}
            </div>
          )}
        </section>

        {/* Submissions */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#ccccee', letterSpacing: '-0.01em' }}>
              오늘의 연주
            </span>
            {submissions.length > 0 && (
              <span style={{
                fontSize: 11, color: '#6366f1', fontWeight: 800,
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.2)',
                padding: '3px 10px', borderRadius: 20,
              }}>
                {submissions.length}개
              </span>
            )}
          </div>

          {submissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '56px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 14, opacity: 0.35 }}>🎸</div>
              <p style={{ color: '#555578', fontSize: 15, fontWeight: 700 }}>아직 연주가 없어요</p>
              <p style={{ color: '#333352', fontSize: 13, marginTop: 5 }}>첫 번째로 올려보세요!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {submissions.map(sub => (
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
      background: '#0d0d1a',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 20, overflow: 'hidden',
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
              width: 34, height: 34, borderRadius: '50%',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#fff',
              overflow: 'hidden', flexShrink: 0,
            }}>
              {sub.profiles?.avatar_url
                ? <img src={sub.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : initials}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#ddddff', lineHeight: 1.2 }}>
                {sub.profiles?.name ?? '익명'}
              </div>
              <div style={{ fontSize: 11, color: '#44445a', marginTop: 2 }}>
                {timeAgo(sub.created_at)}
              </div>
            </div>
          </div>
          <button onClick={onLike} style={{
            background: sub.user_liked ? 'rgba(244,114,182,0.1)' : 'rgba(255,255,255,0.04)',
            border: sub.user_liked ? '1px solid rgba(244,114,182,0.3)' : '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            color: sub.user_liked ? '#f472b6' : '#555578',
            fontSize: 14, fontWeight: 700, padding: '6px 12px',
          }}>
            {sub.user_liked ? '♥' : '♡'}
            <span style={{ fontSize: 13 }}>{sub.likes_count}</span>
          </button>
        </div>
        {sub.caption && (
          <p style={{ fontSize: 13, color: '#8888aa', marginTop: 10, lineHeight: 1.6 }}>
            {sub.caption}
          </p>
        )}
      </div>
    </div>
  )
}
