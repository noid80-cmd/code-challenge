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
    .sort()
    .reverse()

  if (dates.length === 0) return 0

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  if (dates[0] !== today && dates[0] !== yesterday) return 0

  let streak = 0
  let checkDate = dates[0]
  for (const date of dates) {
    if (date === checkDate) {
      streak++
      const d = new Date(checkDate)
      d.setDate(d.getDate() - 1)
      checkDate = d.toISOString().slice(0, 10)
    } else {
      break
    }
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

  // Group by month
  const byMonth: Record<string, Submission[]> = {}
  submissions.forEach(s => {
    const date = new Date(s.created_at)
    const key = `${date.getFullYear()}년 ${date.getMonth() + 1}월`
    if (!byMonth[key]) byMonth[key] = []
    byMonth[key].push(s)
  })

  return (
    <div style={{ minHeight: '100vh', background: '#08080f' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,8,15,0.95)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '0 20px', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ color: '#6666aa', fontSize: 13, fontWeight: 700 }}>← 피드</Link>
        <span style={{ fontWeight: 800, fontSize: 16, color: '#e0e0f8', letterSpacing: '-0.02em' }}>내 성장 기록</span>
        <div style={{ width: 48 }} />
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px 100px' }}>

        {/* Stats */}
        {!loading && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
            <div style={{
              flex: 1, background: '#0d0d1e',
              border: streak > 0 ? '1px solid rgba(99,102,241,0.2)' : '1px solid rgba(255,255,255,0.05)',
              borderRadius: 16, padding: '16px 18px',
            }}>
              <div style={{ fontSize: 11, color: '#4444aa', fontWeight: 800, marginBottom: 6, letterSpacing: '0.08em' }}>
                연속 참여
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: streak > 0 ? '#a5b4fc' : '#333355', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {streak}
              </div>
              <div style={{ fontSize: 12, color: '#444466', marginTop: 4 }}>일 연속</div>
            </div>
            <div style={{
              flex: 1, background: '#0d0d1e',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 16, padding: '16px 18px',
            }}>
              <div style={{ fontSize: 11, color: '#4444aa', fontWeight: 800, marginBottom: 6, letterSpacing: '0.08em' }}>
                총 참여
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#e4e4f8', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {submissions.length}
              </div>
              <div style={{ fontSize: 12, color: '#444466', marginTop: 4 }}>회 업로드</div>
            </div>
            <div style={{
              flex: 1, background: '#0d0d1e',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 16, padding: '16px 18px',
            }}>
              <div style={{ fontSize: 11, color: '#4444aa', fontWeight: 800, marginBottom: 6, letterSpacing: '0.08em' }}>
                받은 좋아요
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#f472b6', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {totalLikes}
              </div>
              <div style={{ fontSize: 12, color: '#444466', marginTop: 4 }}>개</div>
            </div>
          </div>
        )}

        {/* Streak message */}
        {!loading && streak > 0 && (
          <div style={{
            background: 'rgba(99,102,241,0.06)',
            border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 24,
            fontSize: 13, color: '#8888cc', fontWeight: 600,
          }}>
            {streak}일 연속 참여 중이에요.
            {submissions[0]?.created_at.slice(0, 10) !== new Date().toISOString().slice(0, 10)
              ? ' 오늘도 올리면 ' + (streak + 1) + '일이 돼요!'
              : ' 내일도 올려보세요!'}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#333358', fontSize: 14 }}>불러오는 중</div>
        ) : submissions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '52px 0' }}>
            <p style={{ color: '#44445a', fontSize: 14, fontWeight: 700, marginBottom: 5 }}>아직 업로드한 영상이 없어요</p>
            <Link href="/upload" style={{
              display: 'inline-block', marginTop: 16,
              padding: '10px 22px', borderRadius: 10,
              background: '#4f46e5', color: '#fff', fontSize: 13, fontWeight: 700,
            }}>
              첫 영상 올리기
            </Link>
          </div>
        ) : (
          Object.entries(byMonth).map(([month, subs]) => (
            <div key={month} style={{ marginBottom: 32 }}>
              <div style={{
                fontSize: 11, color: '#4444aa', fontWeight: 800,
                letterSpacing: '0.08em', marginBottom: 14,
              }}>
                {month}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {subs.map(sub => (
                  <VideoCard key={sub.id} sub={sub} />
                ))}
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
      background: '#0d0d1e',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 16, overflow: 'hidden',
      display: 'flex', gap: 0,
    }}>
      <div style={{ width: 120, flexShrink: 0, position: 'relative', background: '#000' }}>
        <video
          src={videoUrl}
          preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 80 }}
        />
      </div>
      <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {sub.challenges?.title && (
            <div style={{ fontSize: 13, fontWeight: 800, color: '#ccccee', marginBottom: 4, lineHeight: 1.3 }}>
              {sub.challenges.title}
            </div>
          )}
          {sub.caption && (
            <div style={{ fontSize: 12, color: '#555577', lineHeight: 1.5 }}>
              {sub.caption}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <span style={{ fontSize: 11, color: '#333355' }}>{dateStr}</span>
          <span style={{ fontSize: 12, color: '#f472b6', fontWeight: 700 }}>♥ {sub.likes_count}</span>
        </div>
      </div>
    </div>
  )
}
