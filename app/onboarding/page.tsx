'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AcademyCard from '@/app/components/AcademyCard'

const STEPS = 3

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login?from=/onboarding'; return }
      const { data: prof } = await supabase.from('profiles').select('onboarded_at').eq('id', user.id).single()
      if (prof?.onboarded_at) { window.location.href = '/'; return }
      setUserId(user.id)
      setReady(true)
    }
    check()
  }, [])

  async function finish() {
    if (!userId) return
    const supabase = createClient()
    await supabase.from('profiles').update({ onboarded_at: new Date().toISOString() }).eq('id', userId)
    window.location.href = '/'
  }

  if (!ready) return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'rgba(240,236,224,0.3)', fontSize: 14 }}>불러오는 중...</p>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #080808 0%, #0a0a0a 60%, #090909 100%)',
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <div key={i} style={{
              width: 24, height: 4, borderRadius: 2,
              background: i <= step ? '#f0ece0' : 'rgba(240,236,224,0.15)',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>
        <button onClick={finish} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#605850', fontSize: 13, fontWeight: 700,
        }}>
          건너뛰기
        </button>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px', maxWidth: 420, margin: '0 auto', width: '100%' }}>
        {step === 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
              boxShadow: '0 12px 40px rgba(240,236,224,0.35)',
            }}>
              <svg width="26" height="20" viewBox="0 0 26 20" fill="none">
                <line x1="2" y1="4" x2="24" y2="4" stroke="rgba(4,7,0,0.9)" strokeWidth="2.4" strokeLinecap="round" />
                <line x1="2" y1="10" x2="24" y2="10" stroke="rgba(4,7,0,0.9)" strokeWidth="2.4" strokeLinecap="round" />
                <line x1="2" y1="16" x2="16" y2="16" stroke="rgba(4,7,0,0.9)" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: '#f0ece0', letterSpacing: '-0.03em', marginBottom: 14, lineHeight: 1.3 }}>
              매일 새로 배달되는<br />코드·리듬·멜로디 초견
            </h1>
            <p style={{ fontSize: 14, color: '#807060', lineHeight: 1.8 }}>
              매일 낮 12시, AI가 만든 새로운 챌린지가 올라와요.<br />
              세 가지 초견을 매일 조금씩 연습해보세요.
            </p>
          </div>
        )}

        {step === 1 && (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f0ece0', letterSpacing: '-0.03em', marginBottom: 28 }}>
              이렇게 사용해요
            </h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
              {[
                { n: '1', title: '오늘의 챌린지 확인', desc: '코드·리듬·멜로디 중 원하는 걸 골라 오늘의 악보를 봐요' },
                { n: '2', title: '연주하고 업로드', desc: '보면서 바로 연주하거나, 연습한 영상을 올려요' },
                { n: '3', title: '다른 사람 연주 구경', desc: '같은 챌린지를 어떻게 연주했는지 비교하며 배워요' },
              ].map(item => (
                <div key={item.n} style={{
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                  background: 'rgba(240,236,224,0.04)',
                  border: '1px solid rgba(240,236,224,0.08)',
                  borderRadius: 16, padding: '14px 16px',
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(240,236,224,0.1)', border: '1px solid rgba(240,236,224,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, color: '#f0ece0',
                  }}>
                    {item.n}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#e0dcd0', marginBottom: 3 }}>{item.title}</div>
                    <div style={{ fontSize: 13, color: '#605850', lineHeight: 1.6 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f0ece0', letterSpacing: '-0.03em', marginBottom: 10 }}>
              준비됐어요!
            </h1>
            <p style={{ fontSize: 14, color: '#807060', lineHeight: 1.8, marginBottom: 28 }}>
              오늘의 챌린지로 첫 연습을 시작해보세요
            </p>
            <AcademyCard />
          </div>
        )}
      </main>

      <div style={{ padding: '0 24px 40px', maxWidth: 420, margin: '0 auto', width: '100%' }}>
        <button
          onClick={() => step < STEPS - 1 ? setStep(s => s + 1) : finish()}
          style={{
            display: 'block', width: '100%', padding: '16px', borderRadius: 14, textAlign: 'center',
            background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
            color: '#0a0a08', fontSize: 16, fontWeight: 900,
            border: 'none', cursor: 'pointer',
            boxShadow: '0 8px 28px rgba(240,236,224,0.35)',
          }}
        >
          {step < STEPS - 1 ? '다음' : '시작하기'}
        </button>
      </div>
    </div>
  )
}
