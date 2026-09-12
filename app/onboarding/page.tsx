'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AcademyCard from '@/app/components/AcademyCard'
import LevelPicker from '@/app/components/LevelPicker'
import MajorPicker from '@/app/components/MajorPicker'
import { saveLevel } from '@/app/components/levelClient'
import { saveMajor } from '@/app/components/majorClient'
import { DEFAULT_LEVEL, type Level } from '@/lib/level'
import { isMajor, type Major } from '@/lib/majors'
import { enablePush } from '@/lib/pushEnable'
import { readPendingInvite } from '@/lib/pendingInvite'

const STEPS = 6

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [level, setLevel] = useState<Level>(DEFAULT_LEVEL)
  // 전공은 여기서 한 번만 고르면 업로드할 때마다 다시 묻지 않는다.
  const [major, setMajor] = useState<Major | ''>('')
  // 알림은 이 앱의 심장이다 — 매일 새 챌린지가 올라오는 걸 모르면 안 들어온다.
  // 그런데 지금까지는 어디서도 먼저 묻지 않아서, 가입자 288명 중 92명(32%)만
  // 켜져 있었다. 방금 "매일 오전에 올라와요"라고 말한 이 자리가 물을 자리다.
  const [pushBusy, setPushBusy] = useState(false)
  const [pushOn, setPushOn] = useState(false)
  // 이미 온보딩을 마쳤는데 전공만 없는 사람. 6단계를 처음부터 다시 보여주면
  // 이미 아는 이야기를 또 읽히는 것이라, 전공 한 단계만 보여주고 끝낸다.
  const [majorOnly, setMajorOnly] = useState(false)

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login?from=/onboarding'; return }
      const { data: prof } = await supabase.from('profiles').select('onboarded_at, major').eq('id', user.id).single()
      if (prof?.onboarded_at) {
        if (isMajor(prof?.major)) { window.location.href = '/'; return }
        setMajorOnly(true)
        setStep(3)
      }
      setUserId(user.id)
      setReady(true)
    }
    check()
  }, [])

  async function finish() {
    if (!userId) return
    const supabase = createClient()
    await saveLevel(userId, level)
    if (major) await saveMajor(userId, major)
    await supabase.from('profiles').update({ onboarded_at: new Date().toISOString() }).eq('id', userId)
    // 초대 링크로 들어와 가입한 사람은 홈이 아니라 그룹으로 보낸다
    window.location.href = readPendingInvite() ? '/groups' : '/'
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
      <header style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, visibility: majorOnly ? 'hidden' : 'visible' }}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <div key={i} style={{
              width: 24, height: 4, borderRadius: 2,
              background: i <= step ? '#f0ece0' : 'rgba(240,236,224,0.15)',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>
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
            <p style={{ fontSize: 14, color: '#c8c4b0', lineHeight: 1.8, wordBreak: 'keep-all' }}>
              매일 오전 10~11시, AI가 만든 새로운 챌린지가 올라와요.<br />
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
                    <div style={{ fontSize: 13, color: '#c8c4b0', lineHeight: 1.6, wordBreak: 'keep-all' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f0ece0', letterSpacing: '-0.03em', marginBottom: 8, textAlign: 'center' }}>
              지금 어느 정도인가요?
            </h1>
            <p style={{ fontSize: 13.5, color: '#c8c4b0', lineHeight: 1.7, marginBottom: 22, textAlign: 'center', wordBreak: 'keep-all' }}>
              고른 난이도의 챌린지만 보여드려요.<br />나중에 언제든 바꿀 수 있어요.
            </p>
            <LevelPicker value={level} onChange={setLevel} />
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f0ece0', letterSpacing: '-0.03em', marginBottom: 8, textAlign: 'center' }}>
              어떤 악기를 하나요?
            </h1>
            <p style={{ fontSize: 13.5, color: '#c8c4b0', lineHeight: 1.7, marginBottom: 22, textAlign: 'center', wordBreak: 'keep-all' }}>
              올린 연주에 전공이 함께 붙어요.<br />한 번만 고르면 다음부터는 묻지 않아요.
            </p>
            <MajorPicker value={major} onChange={setMajor} />
          </div>
        )}

        {step === 4 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 58, height: 58, borderRadius: 18, margin: '0 auto 22px',
              background: pushOn ? 'linear-gradient(135deg, #f8f4ec, #c8c4b0)' : 'rgba(240,236,224,0.08)',
              border: pushOn ? 'none' : '1px solid rgba(240,236,224,0.16)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke={pushOn ? '#0a0a08' : '#c8c4b0'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 01-3.4 0" />
              </svg>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f0ece0', letterSpacing: '-0.03em', marginBottom: 10, lineHeight: 1.35 }}>
              {pushOn ? '알림을 켰어요' : `새 챌린지가 올라오면
알려드릴까요?`}
            </h1>
            <p style={{ fontSize: 14, color: '#c8c4b0', lineHeight: 1.8, wordBreak: 'keep-all', whiteSpace: 'pre-line' }}>
              {pushOn
                ? `매일 오전에 새 챌린지를 알려드릴게요.
알림은 언제든 끌 수 있어요.`
                : `하루 한 번, 오전에 한 번이에요.
연습 안 한 날만 저녁에 한 번 더 알려드려요.`}
            </p>
          </div>
        )}

        {step === 5 && (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f0ece0', letterSpacing: '-0.03em', marginBottom: 10 }}>
              준비됐어요!
            </h1>
            <p style={{ fontSize: 14, color: '#c8c4b0', lineHeight: 1.8, marginBottom: 28, wordBreak: 'keep-all' }}>
              오늘의 챌린지로 첫 연습을 시작해보세요
            </p>
            <AcademyCard />
          </div>
        )}
      </main>

      <div style={{ padding: '0 24px 40px', maxWidth: 420, margin: '0 auto', width: '100%' }}>
        {/* 전공 단계에서는 하나 고를 때까지 기다린다 — 비어 있으면 올린 연주가
            어느 악기인지 알 길이 없다. */}
        {(() => {
          const blocked = step === 3 && !major
          const askingPush = step === 4 && !pushOn
          const next = () => setStep(s => s + 1)
          return (
            <>
              <button
                onClick={async () => {
                  if (blocked || pushBusy) return
                  if (askingPush) {
                    // 켜졌는지와 무관하게 앞으로 간다 — 알림 때문에 가입이 막히면 안 된다.
                    setPushBusy(true)
                    const ok = await enablePush()
                    setPushBusy(false)
                    if (ok) setPushOn(true)
                    else next()
                    return
                  }
                  majorOnly || step >= STEPS - 1 ? finish() : next()
                }}
                disabled={blocked || pushBusy}
                style={{
                  display: 'block', width: '100%', padding: '16px', borderRadius: 14, textAlign: 'center',
                  background: blocked ? 'rgba(240,236,224,0.08)' : 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                  color: blocked ? '#8a8478' : '#0a0a08', fontSize: 16, fontWeight: 900,
                  border: 'none', cursor: blocked || pushBusy ? 'default' : 'pointer',
                  boxShadow: blocked ? 'none' : '0 8px 28px rgba(240,236,224,0.35)',
                  opacity: pushBusy ? 0.6 : 1,
                }}
              >
                {blocked ? '전공을 골라주세요'
                  : pushBusy ? '켜는 중...'
                  : askingPush ? '알림 받기'
                  : majorOnly || step >= STEPS - 1 ? '시작하기' : '다음'}
              </button>
              {/* 길을 막지는 않는다. 넘어가도 홈의 배너로 언제든 켤 수 있다. */}
              {askingPush && !pushBusy && (
                <button
                  onClick={next}
                  style={{
                    display: 'block', width: '100%', padding: '13px', marginTop: 8,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#8a8478', fontSize: 14, fontWeight: 700,
                  }}
                >
                  나중에
                </button>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}
