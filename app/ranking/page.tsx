'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type RankUser = {
  user_id: string
  name: string
  avatar_url: string | null
  total_likes: number
  submission_count: number
}

export default function RankingPage() {
  const [weekly, setWeekly] = useState<RankUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const { data } = await supabase
        .from('submissions')
        .select('user_id, likes_count, profiles(name, avatar_url)')
        .gte('created_at', weekAgo)
        .is('group_id', null)

      if (!data) { setLoading(false); return }

      const byUser: Record<string, RankUser> = {}
      data.forEach(s => {
        const profile = s.profiles as unknown as { name: string; avatar_url: string | null } | null
        if (!byUser[s.user_id]) {
          byUser[s.user_id] = {
            user_id: s.user_id,
            name: profile?.name ?? '익명',
            avatar_url: profile?.avatar_url ?? null,
            total_likes: 0,
            submission_count: 0,
          }
        }
        byUser[s.user_id].total_likes += s.likes_count
        byUser[s.user_id].submission_count++
      })

      const ranked = Object.values(byUser)
        .sort((a, b) => b.total_likes - a.total_likes || b.submission_count - a.submission_count)
        .slice(0, 10)
      setWeekly(ranked)
      setLoading(false)
    }
    load()
  }, [])

  const weekRange = (() => {
    const end = new Date()
    const start = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
    return `${fmt(start)} – ${fmt(end)}`
  })()

  const podiumOrder = [1, 0, 2]
  const rankColors = [
    'linear-gradient(135deg, #f5c842, #f09c1a)',
    'linear-gradient(135deg, #b0b8c8, #8a94a6)',
    'linear-gradient(135deg, #cd7c3a, #a05a22)',
  ]
  const rankGlows = [
    'rgba(245,200,66,0.35)',
    'rgba(176,184,200,0.2)',
    'rgba(205,124,58,0.25)',
  ]
  const rankLabels = ['1st', '2nd', '3rd']
  const podiumHeights = [80, 52, 36]

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
        <span style={{ fontWeight: 800, fontSize: 16, color: '#f0e6ff', letterSpacing: '-0.02em' }}>이번 주 랭킹</span>
        <div style={{ width: 48 }} />
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '32px 16px 100px' }}>

        {/* Week range badge */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <span style={{
            fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
            background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(236,72,153,0.1))',
            border: '1px solid rgba(124,58,237,0.2)',
            color: '#7c5abf', padding: '5px 16px', borderRadius: 20,
          }}>
            {weekRange} · 좋아요 기준
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#2a1840', fontSize: 14 }}>불러오는 중</div>
        ) : weekly.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ color: '#4a3565', fontSize: 14, fontWeight: 700, marginBottom: 5 }}>이번 주 데이터가 없어요</p>
            <p style={{ color: '#2a1840', fontSize: 13 }}>챌린지에 참여하고 첫 번째가 되어보세요</p>
          </div>
        ) : (
          <>
            {/* Podium */}
            {weekly.length >= 1 && (
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, marginBottom: 40 }}>
                {podiumOrder.map(idx => {
                  const u = weekly[idx]
                  if (!u) return <div key={idx} style={{ flex: 1, maxWidth: 120 }} />
                  const isFirst = idx === 0
                  const initials = u.name.slice(0, 1).toUpperCase()
                  return (
                    <div key={idx} style={{ flex: 1, maxWidth: 120, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {/* Avatar */}
                      <div style={{
                        width: isFirst ? 72 : 58, height: isFirst ? 72 : 58,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                        background: rankColors[idx],
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: isFirst ? 26 : 20, fontWeight: 900, color: '#fff',
                        overflow: 'hidden', flexShrink: 0,
                        boxShadow: `0 8px 24px ${rankGlows[idx]}`,
                        marginBottom: 10,
                      }}>
                        {u.avatar_url
                          ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                          : initials}
                      </div>

                      <div style={{ textAlign: 'center', marginBottom: 10 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 800, marginBottom: 3,
                          background: rankColors[idx],
                          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        }}>
                          {rankLabels[idx]}
                        </div>
                        <div style={{ fontSize: isFirst ? 13 : 12, fontWeight: 800, color: '#d4b8ff' }}>
                          {u.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#4a3565', marginTop: 2 }}>
                          ♥ {u.total_likes}
                        </div>
                      </div>

                      {/* Podium block */}
                      <div style={{
                        width: '100%',
                        height: podiumHeights[idx],
                        background: `linear-gradient(to top, ${rankColors[idx].includes('f5c842') ? 'rgba(245,200,66,0.12)' : rankColors[idx].includes('b0b8c8') ? 'rgba(176,184,200,0.08)' : 'rgba(205,124,58,0.1)'}, transparent)`,
                        border: `1px solid ${rankColors[idx].includes('f5c842') ? 'rgba(245,200,66,0.2)' : rankColors[idx].includes('b0b8c8') ? 'rgba(176,184,200,0.15)' : 'rgba(205,124,58,0.15)'}`,
                        borderRadius: '8px 8px 0 0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{
                          fontSize: 20, fontWeight: 900,
                          background: rankColors[idx],
                          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        }}>
                          {idx + 1}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Rest */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {weekly.slice(3).map((u, i) => {
                const rank = i + 4
                const initials = u.name.slice(0, 1).toUpperCase()
                return (
                  <div key={u.user_id} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 18px',
                    background: 'linear-gradient(145deg, #0f001e, #0b0016)',
                    border: '1px solid rgba(124,58,237,0.1)',
                    borderRadius: 16,
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: '#2a1840', width: 22, textAlign: 'center' }}>
                      {rank}
                    </span>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 800, color: '#fff', overflow: 'hidden', flexShrink: 0,
                    }}>
                      {u.avatar_url
                        ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                        : initials}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#d4b8ff' }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: '#3d2a5a', marginTop: 2 }}>{u.submission_count}회 참여</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#f472b6' }}>{u.total_likes}</div>
                      <div style={{ fontSize: 10, color: '#2a1840' }}>likes</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
