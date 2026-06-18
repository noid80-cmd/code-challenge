'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import ChordPlayer from './components/ChordPlayer'

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
    <div style={{ minHeight: '100vh', background: '#09090f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 32 }}>🎵</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#09090f' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(9,9,15,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 16px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🎵</div>
          <span style={{ fontWeight: 900, fontSize: 16, color: '#eeeeff', letterSpacing: '-0.02em' }}>코드 챌린지</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAdmin && (
            <Link href="/admin" style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', fontSize: 12, fontWeight: 700 }}>
              어드민
            </Link>
          )}
          {user ? (
            <>
              <Link href="/upload" style={{ padding: '7px 14px', borderRadius: 10, background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                + 업로드
              </Link>
              <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#444466', fontSize: 12, cursor: 'pointer', padding: '4px 8px' }}>
                로그아웃
              </button>
            </>
          ) : (
            <Link href="/login" style={{ padding: '7px 14px', borderRadius: 10, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', fontSize: 13, fontWeight: 700 }}>
              로그인
            </Link>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px 80px' }}>
        {/* Today's Challenge */}
        <section style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, marginBottom: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            오늘의 챌린지 · {dateStr}
          </div>

          {challenge ? (
            <div>
              <div style={{ marginBottom: 12 }}>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: '#eeeeff', marginBottom: challenge.description ? 4 : 0 }}>
                  {challenge.title}
                </h2>
                {challenge.description && (
                  <p style={{ fontSize: 13, color: '#8888aa', lineHeight: 1.5 }}>{challenge.description}</p>
                )}
              </div>
              <ChordPlayer
                progressions={challenge.chords?.progressions ?? []}
                defaultTempo={challenge.chords?.progressions?.[0]?.tempo ?? 120}
              />
              {user ? (
                <Link href="/upload" style={{ display: 'block', marginTop: 12, padding: '12px', borderRadius: 13, background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: '#fff', fontSize: 14, fontWeight: 700, textAlign: 'center' }}>
                  🎹 챌린지 참여하기
                </Link>
              ) : (
                <Link href="/login" style={{ display: 'block', marginTop: 12, padding: '12px', borderRadius: 13, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', fontSize: 14, fontWeight: 700, textAlign: 'center' }}>
                  로그인하고 참여하기
                </Link>
              )}
            </div>
          ) : (
            <div style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: 28, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🎼</div>
              <p style={{ color: '#555570', fontSize: 14 }}>오늘의 챌린지를 준비 중이에요</p>
              {isAdmin && (
                <Link href="/admin" style={{ display: 'inline-block', marginTop: 14, padding: '8px 18px', borderRadius: 10, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', fontSize: 13, fontWeight: 700 }}>
                  챌린지 생성하기
                </Link>
              )}
            </div>
          )}
        </section>

        {/* Submissions Feed */}
        <section>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#555570', marginBottom: 14 }}>
            오늘의 연주{submissions.length > 0 ? ` ${submissions.length}개` : ''}
          </div>
          {submissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🎸</div>
              <p style={{ color: '#444466', fontSize: 14 }}>첫 번째로 연주를 올려보세요!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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

  return (
    <div style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
      <video
        src={videoUrl}
        controls
        playsInline
        preload="metadata"
        style={{ width: '100%', display: 'block', background: '#000', maxHeight: 420, objectFit: 'contain' }}
      />
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, overflow: 'hidden', flexShrink: 0 }}>
              {sub.profiles?.avatar_url
                ? <img src={sub.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : '🎵'}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ccccee' }}>{sub.profiles?.name ?? '익명'}</span>
          </div>
          <button onClick={onLike} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: sub.user_liked ? '#f472b6' : '#444466', fontSize: 14, fontWeight: 700, padding: '4px 0' }}>
            {sub.user_liked ? '♥' : '♡'} <span style={{ fontSize: 13 }}>{sub.likes_count}</span>
          </button>
        </div>
        {sub.caption && (
          <p style={{ fontSize: 13, color: '#8888aa', marginTop: 8, lineHeight: 1.5 }}>{sub.caption}</p>
        )}
      </div>
    </div>
  )
}
