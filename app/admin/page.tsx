'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Progression = { label: string; chords: string[]; style?: string; tempo?: number }
type DraftChallenge = {
  title: string
  description: string
  progressions: Progression[]
}

const emptyDraft = (): DraftChallenge => ({
  title: '',
  description: '',
  progressions: [{ label: '진행 1', chords: ['', '', '', ''], style: '' }],
})

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'ai' | 'manual'>('manual')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<DraftChallenge | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [todayExists, setTodayExists] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.email !== 'noid80@hanmail.net') {
        router.push('/')
        return
      }
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase.from('challenges').select('id').eq('date', today).single()
      setTodayExists(!!data)
      setLoading(false)
    }
    check()
  }, [router])

  async function generate() {
    setGenerating(true); setError(''); setDraft(null)
    try {
      const res = await fetch('/api/generate-challenge', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '생성 실패')
      setDraft({ title: data.title, description: data.description || '', progressions: data.progressions })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '생성 실패')
    }
    setGenerating(false)
  }

  async function saveChallenge() {
    if (!draft) return
    const validProgressions = draft.progressions.map(p => ({
      ...p,
      chords: p.chords.filter(c => c.trim()),
    })).filter(p => p.chords.length > 0)
    if (!draft.title.trim() || validProgressions.length === 0) {
      setError('제목과 코드를 입력해주세요.')
      return
    }
    setSaving(true); setError(''); setSuccess('')
    const supabase = createClient()
    const { error } = await supabase.from('challenges').insert({
      date: selectedDate,
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      chords: { progressions: validProgressions },
    })
    if (error) {
      setError(error.message.includes('duplicate') || error.message.includes('unique')
        ? '해당 날짜의 챌린지가 이미 있어요.'
        : error.message)
    } else {
      setSuccess(`${selectedDate} 챌린지가 저장되었어요!`)
      if (selectedDate === new Date().toISOString().slice(0, 10)) setTodayExists(true)
      setDraft(null)
    }
    setSaving(false)
  }

  function updateChord(progIdx: number, chordIdx: number, value: string) {
    if (!draft) return
    setDraft({
      ...draft,
      progressions: draft.progressions.map((p, i) => i === progIdx
        ? { ...p, chords: p.chords.map((c, j) => j === chordIdx ? value : c) }
        : p
      )
    })
  }

  function addChord(progIdx: number) {
    if (!draft) return
    setDraft({
      ...draft,
      progressions: draft.progressions.map((p, i) => i === progIdx
        ? { ...p, chords: [...p.chords, ''] }
        : p
      )
    })
  }

  function removeChord(progIdx: number, chordIdx: number) {
    if (!draft) return
    setDraft({
      ...draft,
      progressions: draft.progressions.map((p, i) => i === progIdx
        ? { ...p, chords: p.chords.filter((_, j) => j !== chordIdx) }
        : p
      )
    })
  }

  function addProgression() {
    if (!draft) return
    const n = draft.progressions.length + 1
    setDraft({
      ...draft,
      progressions: [...draft.progressions, { label: `진행 ${n}`, chords: ['', '', '', ''], style: '' }]
    })
  }

  function removeProgression(idx: number) {
    if (!draft || draft.progressions.length <= 1) return
    setDraft({ ...draft, progressions: draft.progressions.filter((_, i) => i !== idx) })
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#09090f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6366f1' }}>로딩 중...</div>
    </div>
  )

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#111118', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#eeeeff', outline: 'none',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#09090f' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(9,9,15,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 16px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ color: '#818cf8', fontSize: 13, fontWeight: 700 }}>← 피드</Link>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#eeeeff' }}>챌린지 관리</span>
        <div style={{ width: 48 }} />
      </header>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 80px' }}>

        {/* 날짜 */}
        <div style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#eeeeff', marginBottom: 10 }}>챌린지 날짜</div>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={inputStyle} />
          {todayExists && selectedDate === new Date().toISOString().slice(0, 10) && (
            <p style={{ color: '#fbbf24', fontSize: 12, marginTop: 8 }}>⚠️ 오늘 챌린지가 이미 있어요.</p>
          )}
        </div>

        {/* 모드 탭 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => { setMode('manual'); setDraft(emptyDraft()); setError('') }}
            style={{ flex: 1, padding: '11px', borderRadius: 12, background: mode === 'manual' ? 'rgba(99,102,241,0.2)' : '#0e0e1a', color: mode === 'manual' ? '#a5b4fc' : '#555570', fontSize: 14, fontWeight: 700, cursor: 'pointer', border: mode === 'manual' ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.07)' }}>
            ✏️ 직접 입력
          </button>
          <button onClick={() => { setMode('ai'); setDraft(null); setError('') }}
            style={{ flex: 1, padding: '11px', borderRadius: 12, background: mode === 'ai' ? 'rgba(99,102,241,0.2)' : '#0e0e1a', color: mode === 'ai' ? '#a5b4fc' : '#555570', fontSize: 14, fontWeight: 700, cursor: 'pointer', border: mode === 'ai' ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.07)' }}>
            🤖 AI 생성
          </button>
        </div>

        {/* AI 모드 */}
        {mode === 'ai' && (
          <button onClick={generate} disabled={generating}
            style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: generating ? '#1a1a2e' : 'linear-gradient(135deg, #4f46e5, #6366f1)', color: generating ? '#444466' : '#fff', fontSize: 16, fontWeight: 700, cursor: generating ? 'default' : 'pointer', marginBottom: 16 }}>
            {generating ? '🤖 Claude가 생성 중...' : '🤖 AI로 챌린지 생성'}
          </button>
        )}

        {error && <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{error}</p>}
        {success && <p style={{ color: '#34d399', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{success}</p>}

        {/* 입력/편집 폼 */}
        {draft && (
          <div style={{ background: '#0e0e1a', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#818cf8', marginBottom: 16 }}>
              {mode === 'ai' ? '생성된 챌린지 확인 · 수정' : '챌린지 입력'}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#6666aa', fontWeight: 600, display: 'block', marginBottom: 6 }}>제목</label>
              <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })}
                placeholder="예: 재즈 스윙 코드 챌린지" style={inputStyle} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#6666aa', fontWeight: 600, display: 'block', marginBottom: 6 }}>설명 (선택)</label>
              <textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}
                placeholder="간단한 설명을 입력하세요" rows={2}
                style={{ ...inputStyle, resize: 'none' }} />
            </div>

            {draft.progressions.map((prog, pi) => (
              <div key={pi} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: pi < draft.progressions.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                    <input value={prog.label} onChange={e => setDraft({ ...draft, progressions: draft.progressions.map((p, i) => i === pi ? { ...p, label: e.target.value } : p) })}
                      style={{ ...inputStyle, width: 90, padding: '7px 10px', fontSize: 12 }} />
                    <input value={prog.style || ''} onChange={e => setDraft({ ...draft, progressions: draft.progressions.map((p, i) => i === pi ? { ...p, style: e.target.value } : p) })}
                      placeholder="장르 (예: Jazz)" style={{ ...inputStyle, padding: '7px 10px', fontSize: 12 }} />
                  </div>
                  {draft.progressions.length > 1 && (
                    <button onClick={() => removeProgression(pi)}
                      style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 18, cursor: 'pointer', padding: '0 8px', flexShrink: 0 }}>×</button>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {prog.chords.map((chord, ci) => (
                    <div key={ci} style={{ position: 'relative' }}>
                      <input value={chord} onChange={e => updateChord(pi, ci, e.target.value)}
                        placeholder="코드"
                        style={{ width: 68, padding: '7px 8px', borderRadius: 8, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', fontSize: 14, fontWeight: 800, color: '#c7d2fe', fontFamily: 'monospace', textAlign: 'center', outline: 'none' }} />
                      {prog.chords.length > 1 && (
                        <button onClick={() => removeChord(pi, ci)}
                          style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: '#f87171', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => addChord(pi)}
                    style={{ width: 68, padding: '7px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.15)', fontSize: 18, color: '#444466', cursor: 'pointer' }}>+</button>
                </div>
              </div>
            ))}

            <button onClick={addProgression}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px dashed rgba(99,102,241,0.3)', background: 'none', color: '#6366f1', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}>
              + 진행 추가
            </button>

            <button onClick={saveChallenge} disabled={saving}
              style={{ width: '100%', padding: '13px', borderRadius: 13, border: 'none', background: saving ? '#1a1a2e' : 'linear-gradient(135deg, #059669, #10b981)', color: saving ? '#444466' : '#fff', fontSize: 15, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? '저장 중...' : '✓ 챌린지 저장하기'}
            </button>
          </div>
        )}

        {/* 직접 입력 모드인데 draft가 없으면 시작 버튼 */}
        {mode === 'manual' && !draft && (
          <button onClick={() => setDraft(emptyDraft())}
            style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            ✏️ 직접 입력하기
          </button>
        )}
      </main>
    </div>
  )
}
