'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Submission = {
  id: string
  video_url: string
  caption: string | null
  likes_count: number
  created_at: string
  challenges: { title: string; date: string } | null
}

function calcStreak(submissions: { created_at: string }[]) {
  const dates = [...new Set(submissions.map(s => s.created_at.slice(0, 10)))]
    .sort().reverse()
  if (dates.length === 0) return 0
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dates[0] !== today && dates[0] !== yesterday) return 0
  let streak = 0, checkDate = dates[0]
  for (const date of dates) {
    if (date === checkDate) {
      streak++
      const d = new Date(checkDate); d.setDate(d.getDate() - 1)
      checkDate = d.toISOString().slice(0, 10)
    } else break
  }
  return streak
}

export default function MyVideosPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [streak, setStreak] = useState(0)
  const [totalLikes, setTotalLikes] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      const { data } = await supabase
        .from('submissions')
        .select('*, challenges(title, date)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const subs = (data ?? []) as Submission[]
      setSubmissions(subs)
      setStreak(calcStreak(subs))
      setTotalLikes(subs.reduce((sum, s) => sum + s.likes_count, 0))
      setLoading(false)
    }
    load()
  }, [])

  const byMonth: Record<string, Submission[]> = {}
  submissions.forEach(s => {
    const date = new Date(s.created_at)
    const key = `${date.getFullYear()}년 ${date.getMonth() + 1}월`
    if (!byMonth[key]) byMonth[key] = []
    byMonth[key].push(s)
  })

  const uploadsToday = submissions[0]?.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10)

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0a0012 0%, #050008 60%, #080010 100%)' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(7,0,15,0.85)', backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(124,58,237,0.12)',
        padding: '0 20px', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ color: '#5a3f80', fontSize: 13, fontWeight: 700 }}>← 피드</Link>
        <span style={{ fontWeight: 800, fontSize: 16, color: '#f0e6ff', letterSpacing: '-0.02em' }}>내 성장 기록</span>
        <div style={{ width: 48 }} />
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '28px 16px 100px' }}>

        {!loading && (
          <>
            {/* Stats */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              {/* Streak */}
              <div style={{
                flex: 1,
                background: streak > 0
                  ? 'linear-gradient(145deg, rgba(124,58,237,0.15), rgba(236,72,153,0.08))'
                  : 'linear-gradient(145deg, #0f001e, #0b0016)',
                border: streak > 0 ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(124,58,237,0.1)',
                borderRadius: 18, padding: '18px',
                boxShadow: streak > 0 ? '0 8px 32px rgba(124,58,237,0.12)' : 'none',
              }}>
                <div style={{ fontSize: 10, color: streak > 0 ? '#7c5abf' : '#3d2a5a', fontWeight: 800, marginBottom: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  연속 참여
                </div>
                <div style={{
                  fontSize: 36, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em',
                  background: streak > 0 ? 'linear-gradient(135deg, #a78bfa, #f472b6)' : undefined,
                  WebkitBackgroundClip: streak > 0 ? 'text' : undefined,
                  WebkitTextFillColor: streak > 0 ? 'transparent' : undefined,
                  color: streak > 0 ? undefined : '#2a1840',
                }}>
                  {streak}
                </div>
                <div style={{ fontSize: 11, color: streak > 0 ? '#5a3f80' : '#2a1840', marginTop: 5 }}>일 연속</div>
              </div>

              {/* Total */}
              <div style={{
                flex: 1, background: 'linear-gradient(145deg, #0f001e, #0b0016)',
                border: '1px solid rgba(124,58,237,0.1)',
                borderRadius: 18, padding: '18px',
              }}>
                <div style={{ fontSize: 10, color: '#3d2a5a', fontWeight: 800, marginBottom: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  총 참여
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#d4b8ff', lineHeight: 1, letterSpacing: '-0.04em' }}>
                  {submissions.length}
                </div>
                <div style={{ fontSize: 11, color: '#2a1840', marginTop: 5 }}>회 업로드</div>
              </div>

              {/* Likes */}
              <div style={{
                flex: 1, background: 'linear-gradient(145deg, #0f001e, #0b0016)',
                border: '1px solid rgba(124,58,237,0.1)',
                borderRadius: 18, padding: '18px',
              }}>
                <div style={{ fontSize: 10, color: '#3d2a5a', fontWeight: 800, marginBottom: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  받은 좋아요
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#f472b6', lineHeight: 1, letterSpacing: '-0.04em' }}>
                  {totalLikes}
                </div>
                <div style={{ fontSize: 11, color: '#2a1840', marginTop: 5 }}>개</div>
              </div>
            </div>

            {/* Streak nudge */}
            {streak > 0 && (
              <div style={{
                background: 'rgba(124,58,237,0.06)',
                border: '1px solid rgba(124,58,237,0.15)',
                borderRadius: 14, padding: '12px 16px', marginBottom: 24,
                fontSize: 13, color: '#7c5abf', fontWeight: 600, lineHeight: 1.6,
              }}>
                🔥 {streak}일 연속 참여 중이에요.{' '}
                {uploadsToday ? '내일도 올려보세요!' : `오늘 올리면 ${streak + 1}일이 돼요!`}
              </div>
            )}
          </>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#2a1840', fontSize: 14 }}>불러오는 중</div>
        ) : submissions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '52px 0' }}>
            <p style={{ color: '#4a3565', fontSize: 14, fontWeight: 700, marginBottom: 5 }}>아직 업로드한 영상이 없어요</p>
            <Link href="/upload" style={{
              display: 'inline-block', marginTop: 16,
              padding: '11px 24px', borderRadius: 12,
              background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
              color: '#fff', fontSize: 14, fontWeight: 700,
              boxShadow: '0 6px 20px rgba(236,72,153,0.3)',
            }}>
              첫 영상 올리기
            </Link>
          </div>
        ) : (
          Object.entries(byMonth).map(([month, subs]) => (
            <div key={month} style={{ marginBottom: 32 }}>
              <div style={{
                fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
                marginBottom: 14,
                background: 'linear-gradient(135deg, #a78bfa, #f472b6)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                {month}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {subs.map(sub => <VideoCard key={sub.id} sub={sub} />)}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  )
}

function VideoCard({ sub }: { sub: Submission }) {
  const supabase = createClient()
  const videoUrl = sub.video_url.startsWith('http')
    ? sub.video_url
    : supabase.storage.from('videos').getPublicUrl(sub.video_url).data.publicUrl

  const date = new Date(sub.created_at)
  const dateStr = `${date.getMonth() + 1}/${date.getDate()}`

  return (
    <div style={{
      background: 'linear-gradient(145deg, #0f001e, #0b0016)',
      border: '1px solid rgba(124,58,237,0.1)',
      borderRadius: 18, overflow: 'hidden',
      display: 'flex', gap: 0,
    }}>
      <div style={{ width: 120, flexShrink: 0, background: '#000' }}>
        <video src={videoUrl} preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 80 }} />
      </div>
      <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {sub.challenges?.title && (
            <div style={{ fontSize: 13, fontWeight: 800, color: '#d4b8ff', marginBottom: 4, lineHeight: 1.3 }}>
              {sub.challenges.title}
            </div>
          )}
          {sub.caption && (
            <div style={{ fontSize: 12, color: '#4a3565', lineHeight: 1.5 }}>{sub.caption}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <span style={{ fontSize: 11, color: '#2a1840' }}>{dateStr}</span>
          <span style={{ fontSize: 13, color: '#f472b6', fontWeight: 800 }}>♥ {sub.likes_count}</span>
        </div>
      </div>
    </div>
  )
}
