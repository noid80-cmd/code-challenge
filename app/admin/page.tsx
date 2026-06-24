'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// chords는 string[][] (마디 배열, 각 마디에 1~4개 코드)
type Progression = { label: string; chords: string[][]; style?: string; tempo?: number }
type DraftChallenge = { title: string; description: string; progressions: Progression[] }
type ExistingChallenge = { id: string; date: string; title: string }

function toMeasures(chords: unknown): string[][] {
  if (!chords || !Array.isArray(chords) || chords.length === 0) return [['']]
  if (Array.isArray(chords[0])) return chords as string[][]
  // 구버전 string[] → string[][] (4개씩 마디로)
  const flat = (chords as string[]).filter(c => c.trim())
  if (flat.length === 0) return [['']]
  const out: string[][] = []
  for (let i = 0; i < flat.length; i += 4) out.push(flat.slice(i, i + 4))
  return out
}

const STYLE_OPTIONS = [
  { group: '재즈',  value: 'swing',      label: '미디엄 스윙' },
  { group: '재즈',  value: 'slow-swing', label: '슬로우 스윙' },
  { group: '재즈',  value: 'fast-swing', label: '패스트 스윙' },
  { group: '재즈',  value: 'ballad',     label: '재즈발라드' },
  { group: '재즈',  value: 'jazz-waltz', label: '재즈왈츠' },
  { group: '라틴',  value: 'bossa',      label: '보사노바' },
  { group: '라틴',  value: 'samba',      label: '삼바' },
  { group: '라틴',  value: 'afro-cuban', label: '아프로쿠반' },
  { group: '라틴',  value: 'mambo',      label: '맘보' },
  { group: '라틴',  value: 'cha-cha',    label: '차차' },
  { group: '라틴',  value: 'tango',      label: '탱고' },
  { group: '팝/록', value: 'pop',        label: '팝발라드' },
  { group: '팝/록', value: 'straight',   label: '스트레이트' },
  { group: '팝/록', value: 'rock',       label: '록' },
  { group: '팝/록', value: 'funk',       label: '펑크' },
  { group: '팝/록', value: 'shuffle',    label: '셔플' },
  { group: '팝/록', value: 'rnb',        label: 'R&B' },
  { group: '팝/록', value: 'reggae',     label: '레게' },
]

const emptyDraft = (): DraftChallenge => ({
  title: '',
  description: '',
  progressions: [{ label: '진행 1', chords: [[''], [''], [''], ['']], style: 'swing', tempo: 120 }],
})

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'ai' | 'manual'>('manual')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<DraftChallenge | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [todayExists, setTodayExists] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [challenges, setChallenges] = useState<ExistingChallenge[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)

  const loadChallenges = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('challenges').select('id, date, title')
      .order('date', { ascending: false }).limit(30)
    setChallenges(data ?? [])
    const today = new Date().toISOString().slice(0, 10)
    setTodayExists(!!(data ?? []).find(c => c.date === today))
  }, [])

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.email !== 'noid80@hanmail.net') { router.push('/'); return }
      await loadChallenges()
      setLoading(false)
    }
    check()
  }, [router, loadChallenges])

  async function generate() {
    setGenerating(true); setError(''); setDraft(null); setEditingId(null)
    try {
      const res = await fetch('/api/generate-challenge', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '생성 실패')
      setDraft({
        title: data.title,
        description: data.description || '',
        progressions: (data.progressions ?? []).map((p: { label: string; chords: unknown; style?: string; tempo?: number }) => ({
          ...p,
          chords: toMeasures(p.chords),
        })),
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '생성 실패')
    }
    setGenerating(false)
  }

  async function saveChallenge() {
    if (!draft) return
    const validProgressions = draft.progressions.map(p => ({
      ...p,
      chords: p.chords.map(m => m.filter(c => c.trim())).filter(m => m.length > 0),
    })).filter(p => p.chords.length > 0)
    if (!draft.title.trim() || validProgressions.length === 0) {
      setError('제목과 코드를 입력해주세요.'); return
    }
    setSaving(true); setError(''); setSuccess('')
    const supabase = createClient()
    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      chords: { progressions: validProgressions },
    }
    if (editingId) {
      const { error } = await supabase.from('challenges').update(payload).eq('id', editingId)
      if (error) { setError(error.message) }
      else { setSuccess('챌린지가 수정되었어요!'); setDraft(null); setEditingId(null); await loadChallenges() }
    } else {
      const { error } = await supabase.from('challenges').insert({ date: selectedDate, ...payload })
      if (error) {
        setError(error.message.includes('duplicate') || error.message.includes('unique')
          ? '해당 날짜의 챌린지가 이미 있어요.' : error.message)
      } else {
        setSuccess(`${selectedDate} 챌린지가 저장되었어요!`)
        if (selectedDate === new Date().toISOString().slice(0, 10)) setTodayExists(true)
        setDraft(null); await loadChallenges()
      }
    }
    setSaving(false)
  }

  async function startEdit(ch: ExistingChallenge) {
    const supabase = createClient()
    const { data } = await supabase.from('challenges').select('*').eq('id', ch.id).single()
    if (!data) return
    setEditingId(ch.id)
    setSelectedDate(data.date)
    setDraft({
      title: data.title,
      description: data.description ?? '',
      progressions: (data.chords?.progressions ?? []).map((p: { label: string; chords: unknown; style?: string; tempo?: number }) => ({
        ...p,
        chords: toMeasures(p.chords),
      })),
    })
    setMode('manual'); setError(''); setSuccess('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteChallenge(id: string) {
    if (!confirm('정말 삭제할까요?')) return
    setDeleting(id)
    const supabase = createClient()
    await supabase.from('challenges').delete().eq('id', id)
    await loadChallenges()
    if (editingId === id) { setDraft(null); setEditingId(null) }
    setDeleting(null)
  }

  // ── 마디/코드 편집 헬퍼 ────────────────────────────────────────────────────

  function updateProg<K extends keyof Progression>(pi: number, key: K, value: Progression[K]) {
    if (!draft) return
    setDraft({ ...draft, progressions: draft.progressions.map((p, i) => i === pi ? { ...p, [key]: value } : p) })
  }

  function updateChord(pi: number, mi: number, ci: number, value: string) {
    if (!draft) return
    setDraft({
      ...draft,
      progressions: draft.progressions.map((p, i) => i !== pi ? p : {
        ...p,
        chords: p.chords.map((m, j) => j !== mi ? m : m.map((c, k) => k === ci ? value : c)),
      }),
    })
  }

  function addChordToMeasure(pi: number, mi: number) {
    if (!draft) return
    setDraft({
      ...draft,
      progressions: draft.progressions.map((p, i) => i !== pi ? p : {
        ...p,
        chords: p.chords.map((m, j) => j !== mi ? m : [...m, '']),
      }),
    })
  }

  function removeChordFromMeasure(pi: number, mi: number, ci: number) {
    if (!draft) return
    setDraft({
      ...draft,
      progressions: draft.progressions.map((p, i) => i !== pi ? p : {
        ...p,
        chords: p.chords.map((m, j) => j !== mi ? m : m.filter((_, k) => k !== ci)),
      }),
    })
  }

  function addMeasure(pi: number) {
    if (!draft) return
    setDraft({
      ...draft,
      progressions: draft.progressions.map((p, i) => i !== pi ? p : { ...p, chords: [...p.chords, ['']] }),
    })
  }

  function removeMeasure(pi: number, mi: number) {
    if (!draft) return
    setDraft({
      ...draft,
      progressions: draft.progressions.map((p, i) => i !== pi ? p : {
        ...p, chords: p.chords.filter((_, j) => j !== mi),
      }),
    })
  }

  function addProgression() {
    if (!draft) return
    const n = draft.progressions.length + 1
    setDraft({ ...draft, progressions: [...draft.progressions, { label: `진행 ${n}`, chords: [[''], [''], [''], ['']], style: '' }] })
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

        {!editingId && (
          <div style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#eeeeff', marginBottom: 10 }}>챌린지 날짜</div>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={inputStyle} />
            {todayExists && selectedDate === new Date().toISOString().slice(0, 10) && (
              <p style={{ color: '#fbbf24', fontSize: 12, marginTop: 8 }}>⚠️ 오늘 챌린지가 이미 있어요.</p>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => { setMode('manual'); if (!editingId) setDraft(emptyDraft()); setError('') }}
            style={{ flex: 1, padding: '11px', borderRadius: 12, background: mode === 'manual' ? 'rgba(99,102,241,0.2)' : '#0e0e1a', color: mode === 'manual' ? '#a5b4fc' : '#555570', fontSize: 14, fontWeight: 700, cursor: 'pointer', border: mode === 'manual' ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.07)' }}>
            직접 입력
          </button>
          <button onClick={() => { setMode('ai'); setDraft(null); setEditingId(null); setError('') }}
            style={{ flex: 1, padding: '11px', borderRadius: 12, background: mode === 'ai' ? 'rgba(99,102,241,0.2)' : '#0e0e1a', color: mode === 'ai' ? '#a5b4fc' : '#555570', fontSize: 14, fontWeight: 700, cursor: 'pointer', border: mode === 'ai' ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.07)' }}>
            AI 생성
          </button>
        </div>

        {mode === 'ai' && (
          <button onClick={generate} disabled={generating}
            style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: generating ? '#1a1a2e' : 'linear-gradient(135deg, #4f46e5, #6366f1)', color: generating ? '#444466' : '#fff', fontSize: 16, fontWeight: 700, cursor: generating ? 'default' : 'pointer', marginBottom: 16 }}>
            {generating ? '생성 중...' : 'AI로 챌린지 생성'}
          </button>
        )}

        {error && <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{error}</p>}
        {success && <p style={{ color: '#34d399', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{success}</p>}

        {draft && (
          <div style={{ background: '#0e0e1a', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#818cf8' }}>
                {editingId ? '챌린지 수정' : mode === 'ai' ? '생성된 챌린지 확인 · 수정' : '챌린지 입력'}
              </div>
              {editingId && (
                <button onClick={() => { setDraft(null); setEditingId(null); setError('') }}
                  style={{ background: 'none', border: 'none', color: '#555570', fontSize: 12, cursor: 'pointer' }}>취소</button>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#6666aa', fontWeight: 600, display: 'block', marginBottom: 6 }}>제목</label>
              <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })}
                placeholder="예: 재즈 스윙 코드 챌린지" style={inputStyle} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#6666aa', fontWeight: 600, display: 'block', marginBottom: 6 }}>설명 (선택)</label>
              <textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}
                placeholder="간단한 설명을 입력하세요" rows={2} style={{ ...inputStyle, resize: 'none' }} />
            </div>

            {draft.progressions.map((prog, pi) => (
              <div key={pi} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: pi < draft.progressions.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                {/* 진행 헤더 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input value={prog.label}
                      onChange={e => updateProg(pi, 'label', e.target.value)}
                      style={{ ...inputStyle, width: 90, padding: '7px 10px', fontSize: 12 }} />
                    {draft.progressions.length > 1 && (
                      <button onClick={() => removeProgression(pi)}
                        style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 18, cursor: 'pointer', padding: '0 4px', marginLeft: 'auto' }}>×</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      value={prog.style || 'swing'}
                      onChange={e => updateProg(pi, 'style', e.target.value)}
                      style={{ ...inputStyle, flex: 1, padding: '7px 10px', fontSize: 12, cursor: 'pointer' }}
                    >
                      {['재즈', '라틴', '팝/록'].map(group => (
                        <optgroup key={group} label={group}>
                          {STYLE_OPTIONS.filter(o => o.group === group).map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 마디 목록 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {prog.chords.map((measure, mi) => (
                    <div key={mi} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* 마디 번호 */}
                      <div style={{ fontSize: 10, color: '#333355', fontWeight: 700, width: 32, textAlign: 'right', flexShrink: 0 }}>
                        {mi + 1}마디
                      </div>
                      {/* 세로 구분선 */}
                      <div style={{ width: 2, height: 28, background: 'rgba(99,102,241,0.3)', borderRadius: 1, flexShrink: 0 }} />
                      {/* 코드 인풋들 */}
                      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                        {measure.map((chord, ci) => (
                          <div key={ci} style={{ position: 'relative' }}>
                            <input
                              value={chord}
                              onChange={e => updateChord(pi, mi, ci, e.target.value)}
                              placeholder="코드"
                              style={{
                                width: 58, padding: '6px 4px', borderRadius: 8,
                                background: chord ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)',
                                border: chord ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.1)',
                                fontSize: 13, fontWeight: 800, color: '#c7d2fe',
                                fontFamily: 'monospace', textAlign: 'center', outline: 'none',
                              }}
                            />
                            {measure.length > 1 && (
                              <button onClick={() => removeChordFromMeasure(pi, mi, ci)}
                                style={{ position: 'absolute', top: -5, right: -5, width: 14, height: 14, borderRadius: '50%', background: '#f87171', border: 'none', color: '#fff', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                            )}
                          </div>
                        ))}
                        {/* 코드 추가 (최대 4개) */}
                        {measure.length < 4 && (
                          <button onClick={() => addChordToMeasure(pi, mi)}
                            style={{ width: 30, padding: '6px 4px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)', fontSize: 14, color: '#333355', cursor: 'pointer' }}>+</button>
                        )}
                      </div>
                      {/* 마디 삭제 */}
                      {prog.chords.length > 1 && (
                        <button onClick={() => removeMeasure(pi, mi)}
                          style={{ background: 'none', border: 'none', color: '#444466', fontSize: 14, cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>×</button>
                      )}
                    </div>
                  ))}
                </div>

                {/* 마디 추가 */}
                <button onClick={() => addMeasure(pi)}
                  style={{ marginTop: 8, marginLeft: 40, padding: '5px 12px', borderRadius: 7, border: '1px dashed rgba(99,102,241,0.25)', background: 'none', color: '#555577', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  + 마디 추가
                </button>
              </div>
            ))}

            <button onClick={addProgression}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px dashed rgba(99,102,241,0.3)', background: 'none', color: '#6366f1', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}>
              + 진행 추가
            </button>

            <button onClick={saveChallenge} disabled={saving}
              style={{ width: '100%', padding: '13px', borderRadius: 13, border: 'none', background: saving ? '#1a1a2e' : 'linear-gradient(135deg, #059669, #10b981)', color: saving ? '#444466' : '#fff', fontSize: 15, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? '저장 중...' : editingId ? '✓ 수정 저장' : '✓ 챌린지 저장하기'}
            </button>
          </div>
        )}

        {mode === 'manual' && !draft && (
          <button onClick={() => setDraft(emptyDraft())}
            style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 20 }}>
            직접 입력하기
          </button>
        )}

        {challenges.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#ccccee', marginBottom: 12 }}>기존 챌린지</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {challenges.map(ch => (
                <div key={ch.id} style={{
                  background: '#0d0d1a',
                  border: editingId === ch.id ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#5555aa', fontWeight: 700, marginBottom: 2 }}>{ch.date}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#ccccee', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.title}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => startEdit(ch)}
                      style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>수정</button>
                    <button onClick={() => deleteChallenge(ch.id)} disabled={deleting === ch.id}
                      style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {deleting === ch.id ? '...' : '삭제'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
