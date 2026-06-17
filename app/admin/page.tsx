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

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
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
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '생성 실패')
      }
      const data = await res.json()
      setDraft({
        title: data.title,
        description: data.description || '',
        progressions: data.progressions,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '생성 실패')
    }
    setGenerating(false)
  }

  async function saveChallenge() {
    if (!draft) return
    setSaving(true); setError(''); setSuccess('')
    const supabase = createClient()
    const { error } = await supabase.from('challenges').insert({
      date: selectedDate,
      title: draft.title,
      description: draft.description || null,
      chords: { progressions: draft.progressions },
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
    const progressions = draft.progressions.map((p, i) => i === progIdx
      ? { ...p, chords: p.chords.map((c, j) => j === chordIdx ? value : c) }
      : p
    )
    setDraft({ ...draft, progressions })
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#09090f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6366f1' }}>로딩 중...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#09090f' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(9,9,15,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 16px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ color: '#818cf8', fontSize: 13, fontWeight: 700 }}>← 피드</Link>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#eeeeff' }}>챌린지 관리</span>
        <div style={{ width: 48 }} />
      </header>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 80px' }}>
        <div style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#eeeeff', marginBottom: 12 }}>챌린지 날짜</div>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ width: '100%', background: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#eeeeff', outline: 'none' }}
          />
          {todayExists && selectedDate === new Date().toISOString().slice(0, 10) && (
            <p style={{ color: '#fbbf24', fontSize: 12, marginTop: 8 }}>⚠️ 오늘 챌린지가 이미 있어요.</p>
          )}
        </div>

        <button onClick={generate} disabled={generating}
          style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: generating ? '#1a1a2e' : 'linear-gradient(135deg, #4f46e5, #6366f1)', color: generating ? '#444466' : '#fff', fontSize: 16, fontWeight: 700, cursor: generating ? 'default' : 'pointer', marginBottom: 16 }}>
          {generating ? '🤖 Claude가 생성 중...' : '🤖 AI로 챌린지 생성'}
        </button>

        {error && <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{error}</p>}
        {success && <p style={{ color: '#34d399', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{success}</p>}

        {draft && (
          <div style={{ background: '#0e0e1a', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#818cf8', marginBottom: 14 }}>생성된 챌린지 미리보기</div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#6666aa', fontWeight: 600, display: 'block', marginBottom: 6 }}>제목</label>
              <input
                value={draft.title}
                onChange={e => setDraft({ ...draft, title: e.target.value })}
                style={{ width: '100%', background: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#eeeeff', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#6666aa', fontWeight: 600, display: 'block', marginBottom: 6 }}>설명</label>
              <textarea
                value={draft.description}
                onChange={e => setDraft({ ...draft, description: e.target.value })}
                rows={2}
                style={{ width: '100%', background: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#eeeeff', outline: 'none', resize: 'none' }}
              />
            </div>

            {draft.progressions.map((prog, pi) => (
              <div key={pi} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#818cf8', fontWeight: 700, marginBottom: 6 }}>
                  {prog.label} {prog.style && <span style={{ color: '#444466' }}>· {prog.style}</span>} {prog.tempo && <span style={{ color: '#444466' }}>♩={prog.tempo}</span>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {prog.chords.map((chord, ci) => (
                    <input
                      key={ci}
                      value={chord}
                      onChange={e => updateChord(pi, ci, e.target.value)}
                      style={{ width: 72, padding: '7px 8px', borderRadius: 8, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', fontSize: 14, fontWeight: 800, color: '#c7d2fe', fontFamily: 'monospace', textAlign: 'center', outline: 'none' }}
                    />
                  ))}
                </div>
              </div>
            ))}

            <button onClick={saveChallenge} disabled={saving}
              style={{ width: '100%', padding: '13px', borderRadius: 13, border: 'none', background: saving ? '#1a1a2e' : 'linear-gradient(135deg, #059669, #10b981)', color: saving ? '#444466' : '#fff', fontSize: 15, fontWeight: 700, cursor: saving ? 'default' : 'pointer', marginTop: 8 }}>
              {saving ? '저장 중...' : '✓ 챌린지 저장하기'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
