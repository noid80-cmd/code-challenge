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

  const rankColors = ['#f5c842', '#b0b8c8', '#cd7c3a']
  const rankLabels = ['1st', '2nd', '3rd']

  const weekRange = (() => {
    const end = new Date()
    const start = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
    return `${fmt(start)} – ${fmt(end)}`
  })()

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
        <span style={{ fontWeight: 800, fontSize: 16, color: '#e0e0f8', letterSpacing: '-0.02em' }}>이번 주 랭킹</span>
        <div style={{ width: 48 }} />
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '28px 16px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{
            fontSize: 11, color: '#4444aa', fontWeight: 800,
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.15)',
            padding: '4px 14px', borderRadius: 20,
            letterSpacing: '0.08em',
          }}>
            {weekRange} · 좋아요 기준
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#333358', fontSize: 14 }}>불러오는 중</div>
        ) : weekly.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ color: '#44445a', fontSize: 14, fontWeight: 700, marginBottom: 5 }}>이번 주 데이터가 없어요</p>
            <p style={{ color: '#2a2a42', fontSize: 13 }}>챌린지에 참여하고 첫 번째가 되어보세요</p>
          </div>
        ) : (
          <>
            {/* Top 3 podium */}
            {weekly.length >= 1 && (
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginBottom: 32 }}>
                {[1, 0, 2].map(idx => {
                  const u = weekly[idx]
                  if (!u) return <div key={idx} style={{ width: 100 }} />
                  const isFirst = idx === 0
                  const initials = u.name.slice(0, 1).toUpperCase()
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: isFirst ? 64 : 52, height: isFirst ? 64 : 52,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                        border: `2.5px solid ${rankColors[idx]}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: isFirst ? 22 : 18, fontWeight: 800, color: '#fff',
                        overflow: 'hidden',
                      }}>
                        {u.avatar_url
                          ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                          : initials}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: isFirst ? 14 : 12, fontWeight: 800, color: rankColors[idx] }}>
                          {rankLabels[idx]}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#ccccee', marginTop: 2 }}>
                          {u.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#555577', marginTop: 1 }}>
                          {u.total_likes} likes
                        </div>
                      </div>
                      <div style={{
                        width: isFirst ? 100 : 84,
                        height: isFirst ? 72 : 48,
                        background: `linear-gradient(to top, ${rankColors[idx]}18, transparent)`,
                        border: `1px solid ${rankColors[idx]}30`,
                        borderRadius: '8px 8px 0 0',
                      }} />
                    </div>
                  )
                })}
              </div>
            )}

            {/* Rest of ranking */}
            {weekly.slice(3).map((u, i) => {
              const rank = i + 4
              const initials = u.name.slice(0, 1).toUpperCase()
              return (
                <div key={u.user_id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 18px',
                  background: '#0d0d1e',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 14, marginBottom: 8,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#333355', width: 20, textAlign: 'center' }}>
                    {rank}
                  </span>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 800, color: '#fff', overflow: 'hidden', flexShrink: 0,
                  }}>
                    {u.avatar_url
                      ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                      : initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#ccccee' }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: '#444466', marginTop: 2 }}>
                      {u.submission_count}회 참여
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#f472b6' }}>{u.total_likes}</div>
                    <div style={{ fontSize: 10, color: '#333355' }}>likes</div>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </main>
    </div>
  )
}
