'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

export default function LandingPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  const today = new Date()
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #080808 0%, #0a0a0a 60%, #090909 100%)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* 헤더 */}
      <header style={{
        padding: '0 20px', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(240,236,224,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(240,236,224,0.4)',
          }}>
            <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
              <line x1="1" y1="2" x2="12" y2="2" stroke="rgba(4,7,0,0.9)" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="1" y1="5" x2="12" y2="5" stroke="rgba(4,7,0,0.9)" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="1" y1="8" x2="8"  y2="8" stroke="rgba(4,7,0,0.9)" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontWeight: 900, fontSize: 16, color: '#f0ece0', letterSpacing: '-0.03em' }}>초견챌린지</span>
        </div>
        {user === undefined ? null : user ? (
          <Link href="/my-videos" style={{
            width: 32, height: 32, borderRadius: '50%', overflow: 'hidden',
            background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, color: '#0a0a08',
          }}>
            {(user.email ?? '?').slice(0, 1).toUpperCase()}
          </Link>
        ) : (
          <Link href="/login" style={{
            padding: '6px 14px', borderRadius: 8,
            background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
            color: '#0a0a08', fontSize: 13, fontWeight: 800,
          }}>로그인</Link>
        )}
      </header>

      {/* 메인 */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', color: '#403830', marginBottom: 12, textTransform: 'uppercase' }}>
            {dateStr}
          </p>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: '#f0ece0', letterSpacing: '-0.04em', margin: 0, lineHeight: 1.1 }}>
            오늘의 챌린지
          </h1>
          <p style={{ fontSize: 14, color: '#504840', marginTop: 12, fontWeight: 500 }}>
            연주하고 공유하세요
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 400 }}>
          <Link href="/chord" style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'linear-gradient(145deg, #111110, #0e0e0c)',
              border: '1px solid rgba(240,236,224,0.15)',
              borderRadius: 24, padding: '28px 24px',
              display: 'flex', alignItems: 'center', gap: 20,
              boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
              cursor: 'pointer', transition: 'all 0.2s',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, boxShadow: '0 4px 16px rgba(240,236,224,0.3)',
              }}>🎵</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#f0ece0', letterSpacing: '-0.02em', marginBottom: 4 }}>
                  코드챌린지
                </div>
                <div style={{ fontSize: 13, color: '#605850', fontWeight: 500 }}>
                  매일 새로운 코드 진행을 초견하세요
                </div>
              </div>
              <span style={{ fontSize: 18, color: '#403830' }}>→</span>
            </div>
          </Link>

          <Link href="/rhythm" style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'linear-gradient(145deg, #111110, #0e0e0c)',
              border: '1px solid rgba(240,236,224,0.15)',
              borderRadius: 24, padding: '28px 24px',
              display: 'flex', alignItems: 'center', gap: 20,
              boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
              cursor: 'pointer', transition: 'all 0.2s',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, boxShadow: '0 4px 16px rgba(240,236,224,0.3)',
              }}>🥁</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#f0ece0', letterSpacing: '-0.02em', marginBottom: 4 }}>
                  리듬챌린지
                </div>
                <div style={{ fontSize: 13, color: '#605850', fontWeight: 500 }}>
                  매일 새로운 리듬 패턴을 연주하세요
                </div>
              </div>
              <span style={{ fontSize: 18, color: '#403830' }}>→</span>
            </div>
          </Link>
        </div>
      </main>

    </div>
  )
}
