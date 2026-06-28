'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { localDate } from '@/lib/date'

type ChallengeItem = {
  id: string
  date: string
  title: string
  submissions: { count: number }[]
}

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<ChallengeItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: chs } = await supabase
        .from('challenges')
        .select('id, date, title')
        .order('date', { ascending: false })

      if (!chs) { setLoading(false); return }

      const { data: counts } = await supabase
        .from('submissions')
        .select('challenge_id')
        .is('group_id', null)
        .eq('is_private', false)

      const countMap: Record<string, number> = {}
      for (const s of counts ?? []) {
        countMap[s.challenge_id] = (countMap[s.challenge_id] ?? 0) + 1
      }

      setChallenges(chs.map(ch => ({
        ...ch,
        submissions: [{ count: countMap[ch.id] ?? 0 }],
      })))
      setLoading(false)
    }
    load()
  }, [])

  const today = localDate()

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
        padding: '0 20px', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ color: '#605850', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          홈
        </Link>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#f0ece0', letterSpacing: '-0.01em' }}>챌린지 아카이브</span>
        <div style={{ width: 48 }} />
      </header>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 100px' }}>
        {challenges.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ color: '#303028', fontSize: 14 }}>아직 챌린지가 없어요</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {challenges.map(ch => {
              const isToday = ch.date === today
              const count = ch.submissions?.[0]?.count ?? 0
              return (
                <Link key={ch.id} href={`/challenges/${ch.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: 'linear-gradient(145deg, #111110, #0d0d0c)',
                    border: isToday ? '1px solid rgba(240,236,224,0.3)' : '1px solid rgba(240,236,224,0.1)',
                    borderRadius: 16, padding: '16px 18px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 12,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#403830', letterSpacing: '0.04em' }}>
                          {ch.date}
                        </span>
                        {isToday && (
                          <span style={{
                            fontSize: 10, fontWeight: 800, color: '#0a0a08',
                            background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                            padding: '1px 7px', borderRadius: 20,
                          }}>오늘</span>
                        )}
                      </div>
                      <div style={{
                        fontSize: 14, fontWeight: 800, color: '#f0ece0',
                        letterSpacing: '-0.01em',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {ch.title}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      {count > 0 && (
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#a0988c' }}>{count}</span>
                          <span style={{ fontSize: 10, color: '#403830', marginLeft: 3, fontWeight: 600 }}>연주</span>
                        </div>
                      )}
                      <span style={{ color: '#303028', fontSize: 16 }}>›</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
