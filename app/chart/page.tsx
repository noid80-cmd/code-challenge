'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ChordPlayer from '@/app/components/ChordPlayer'
import Link from 'next/link'

type Progression = { label: string; chords: string[]; style?: string; tempo?: number }
type Challenge = { id: string; title: string; description?: string; chords: { progressions: Progression[] } }

export default function ChartPage() {
  const [challenge, setChallenge] = useState<Challenge | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase.from('challenges').select('*').eq('date', today).single()
      setChallenge(data)
    }
    load()
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080808',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* 얇은 상단 바 */}
      <div style={{
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(240,236,224,0.08)',
      }}>
        <Link href="/upload" style={{ fontSize: 13, fontWeight: 700, color: '#605850', textDecoration: 'none' }}>
          ← 업로드
        </Link>
        <span style={{ fontSize: 11, color: '#303028', fontWeight: 600, letterSpacing: '0.08em' }}>
          악보 보기
        </span>
        <div style={{ width: 48 }} />
      </div>

      {/* 메인: 악보 중앙 배치 */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 20px',
      }}>
        {challenge ? (
          <div style={{ width: '100%', maxWidth: 520 }}>
            {/* 타이틀 */}
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: '#a0988c', marginBottom: 10 }}>
                TODAY&apos;S CHALLENGE
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#f0ece0', letterSpacing: '-0.03em', lineHeight: 1.3 }}>
                {challenge.title}
              </div>
              {challenge.description && (
                <div style={{ fontSize: 13, color: '#605850', marginTop: 10, lineHeight: 1.6 }}>
                  {challenge.description}
                </div>
              )}
            </div>

            {/* 악보 */}
            <div style={{
              background: 'linear-gradient(145deg, #111110, #0d0d0c)',
              border: '1px solid rgba(240,236,224,0.12)',
              borderRadius: 24, padding: '28px 20px',
              boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
              overflowX: 'auto',
            }}>
              <ChordPlayer
                progressions={challenge.chords.progressions}
                title={challenge.title}
              />
            </div>

            {/* 코드 목록 (빠른 참고용) */}
            <div style={{ marginTop: 24 }}>
              {challenge.chords.progressions.map((prog, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  {challenge.chords.progressions.length > 1 && (
                    <div style={{ fontSize: 10, color: '#605850', fontWeight: 700, marginBottom: 7, letterSpacing: '0.08em' }}>
                      {prog.label}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {prog.chords.map((chord, j) => (
                      <span key={j} style={{
                        padding: '6px 14px', borderRadius: 9,
                        background: 'rgba(240,236,224,0.06)',
                        border: '1px solid rgba(240,236,224,0.15)',
                        fontSize: 15, fontWeight: 900, color: '#f8f4ec',
                        letterSpacing: '-0.01em',
                      }}>{chord}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* 안내 문구 */}
            <div style={{
              marginTop: 28, padding: '14px 18px',
              background: 'rgba(240,236,224,0.04)',
              border: '1px solid rgba(240,236,224,0.08)',
              borderRadius: 14, textAlign: 'center',
            }}>
              <p style={{ fontSize: 12, color: '#303028', fontWeight: 600, lineHeight: 1.8, margin: 0 }}>
                이 화면을 보며 연주를 녹화하세요<br />
                화면 꺼짐 방지는 기기 설정에서 조정하세요
              </p>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#303028', fontSize: 14 }}>
            오늘의 챌린지를 불러오는 중...
          </div>
        )}
      </div>

      {/* 하단 CTA */}
      {challenge && (
        <div style={{ padding: '16px 20px 36px' }}>
          <Link href="/upload" style={{
            display: 'block', textAlign: 'center',
            padding: '14px', borderRadius: 14,
            background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
            color: '#0a0a08', fontSize: 15, fontWeight: 800,
            textDecoration: 'none',
            boxShadow: '0 6px 24px rgba(240,236,224,0.25)',
          }}>
            녹화 완료 → 업로드하기
          </Link>
        </div>
      )}
    </div>
  )
}
