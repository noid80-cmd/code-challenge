'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MAJORS, MAJOR_LABELS, isMajor, type Major } from '@/lib/majors'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { localDate, challengeDate } from '@/lib/date'

// chords는 string[][] (마디 배열, 각 마디에 1~4개 코드)
type Progression = { label: string; chords: string[][]; style?: string; tempo?: number }
type DraftChallenge = { title: string; description: string; progressions: Progression[]; level: string }
type ExistingChallenge = { id: string; date: string; title: string; level: string; type?: string }
type RhythmDraft = { title: string; description: string; level: string; patterns: { label: string; abc: string }[] }
type MelodyDraft = { title: string; description: string; level: string; patterns: { label: string; abc: string }[] }
type Member = { id: string; name: string; avatar_url: string | null; created_at: string; submissionCount: number; lastSubmission: string | null; suspended_at: string | null }
type AdminSubmission = {
  id: string; user_id: string; created_at: string; hidden_at: string | null
  caption: string | null; group_id: string | null; userName: string; challengeTitle: string
  video_url: string; major: string | null
}
type BugRow = {
  id: string; message: string; page: string | null
  created_at: string; resolved_at: string | null; userName: string
  userId: string | null; adminReply: string | null
}
type AdminGroup = {
  id: string; name: string; created_at: string
  ownerName: string; memberCount: number; videoCount: number
}

const LEVEL_LABELS: Record<string, string> = { beginner: '초급', intermediate: '중급', advanced: '고급' }
const LEVEL_COLORS: Record<string, string> = { beginner: '#34d399', intermediate: '#818cf8', advanced: '#f87171' }

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
  level: 'intermediate',
})

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [adminTab, setAdminTab] = useState<'challenges' | 'members' | 'videos' | 'groups' | 'bugs'>('challenges')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<DraftChallenge | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedDate, setSelectedDate] = useState(challengeDate().date)
  const [challenges, setChallenges] = useState<ExistingChallenge[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoaded, setMembersLoaded] = useState(false)
  const [subs, setSubs] = useState<AdminSubmission[]>([])
  // 어드민에서 영상을 볼 수가 없었다. 내리기 버튼만 있고, 무엇을 내리는지
  // 확인할 방법이 없어서 캡션만 읽고 판단해야 했다.
  const [playing, setPlaying] = useState<AdminSubmission | null>(null)
  const [subsLoaded, setSubsLoaded] = useState(false)
  const [adminGroups, setAdminGroups] = useState<AdminGroup[]>([])
  const [groupsLoaded, setGroupsLoaded] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [bugs, setBugs] = useState<BugRow[]>([])
  const [bugsLoaded, setBugsLoaded] = useState(false)
  const [bugDrafts, setBugDrafts] = useState<Record<string, string>>({})
  const [challengeTypeForNew, setChallengeTypeForNew] = useState<'chord' | 'rhythm' | 'melody'>('chord')
  const [rhythmDraft, setRhythmDraft] = useState<RhythmDraft | null>(null)
  const [generatingRhythm, setGeneratingRhythm] = useState(false)
  const [melodyDraft, setMelodyDraft] = useState<MelodyDraft | null>(null)
  const [generatingMelody, setGeneratingMelody] = useState(false)

  const loadChallenges = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('challenges').select('id, date, title, level, type')
      .order('date', { ascending: false }).limit(30)
    setChallenges(data ?? [])
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

  async function generateRhythm() {
    setGeneratingRhythm(true); setError(''); setRhythmDraft(null)
    try {
      const { data: sess } = await createClient().auth.getSession()
      const tok = sess.session?.access_token
      const res = await fetch('/api/generate-rhythm', {
        method: 'POST',
        headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '생성 실패')
      const ch = data.challenge
      setRhythmDraft({
        title: ch.title ?? '',
        description: ch.description ?? '',
        level: ch.level ?? 'intermediate',
        patterns: ch.patterns ?? [],
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '생성 실패')
    }
    setGeneratingRhythm(false)
  }

  async function saveRhythmChallenge() {
    if (!rhythmDraft || rhythmDraft.patterns.length === 0) {
      setError('생성된 챌린지가 없어요.'); return
    }
    const draftToSave = { ...rhythmDraft }
    setRhythmDraft(null)
    setSaving(true); setError(''); setSuccess('')
    const supabase = createClient()
    const { error } = await supabase.from('challenges').insert({
      date: selectedDate,
      type: 'rhythm',
      title: draftToSave.title.trim(),
      description: draftToSave.description.trim() || null,
      chords: { patterns: draftToSave.patterns },
      level: draftToSave.level,
    })
    if (error) {
      setError(error.message.includes('duplicate') || error.message.includes('unique')
        ? `${selectedDate} 리듬 챌린지가 이미 있어요. 기존 걸 삭제하거나 수정해주세요.` : error.message)
    } else {
      setSuccess(`${selectedDate} 리듬 챌린지 저장됐어요!`)
      await loadChallenges()
    }
    setSaving(false)
  }

  async function generateMelody() {
    setGeneratingMelody(true); setError(''); setMelodyDraft(null)
    try {
      const { data: sess } = await createClient().auth.getSession()
      const tok = sess.session?.access_token
      const res = await fetch('/api/generate-melody', {
        method: 'POST',
        headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '생성 실패')
      const ch = data.challenge
      setMelodyDraft({
        title: ch.title ?? '',
        description: ch.description ?? '',
        level: ch.level ?? 'intermediate',
        patterns: ch.patterns ?? [],
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '생성 실패')
    }
    setGeneratingMelody(false)
  }

  async function saveMelodyChallenge() {
    if (!melodyDraft || melodyDraft.patterns.length === 0) {
      setError('생성된 챌린지가 없어요.'); return
    }
    const draftToSave = { ...melodyDraft }
    setMelodyDraft(null)
    setSaving(true); setError(''); setSuccess('')
    const supabase = createClient()
    const { error } = await supabase.from('challenges').insert({
      date: selectedDate,
      type: 'melody',
      title: draftToSave.title.trim(),
      description: draftToSave.description.trim() || null,
      chords: { patterns: draftToSave.patterns },
      level: draftToSave.level,
    })
    if (error) {
      setError(error.message.includes('duplicate') || error.message.includes('unique')
        ? `${selectedDate} 멜로디 챌린지가 이미 있어요. 기존 걸 삭제하거나 수정해주세요.` : error.message)
    } else {
      setSuccess(`${selectedDate} 멜로디 챌린지 저장됐어요!`)
      await loadChallenges()
    }
    setSaving(false)
  }

  async function generate() {
    setGenerating(true); setError(''); setDraft(null); setEditingId(null)
    try {
      const { data: sess } = await createClient().auth.getSession()
      const tok = sess.session?.access_token
      const res = await fetch('/api/generate-challenge', {
        method: 'POST',
        headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '생성 실패')
      setDraft({
        title: data.title,
        description: data.description || '',
        level: 'intermediate',
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
      level: draft.level || 'intermediate',
    }
    if (editingId) {
      const { error } = await supabase.from('challenges').update(payload).eq('id', editingId)
      if (error) { setError(error.message) }
      else { setSuccess('챌린지가 수정되었어요!'); setDraft(null); setEditingId(null); await loadChallenges() }
    } else {
      const { error } = await supabase.from('challenges').insert({ date: selectedDate, ...payload })
      if (error) {
        setError(error.message.includes('duplicate') || error.message.includes('unique')
          ? `${selectedDate} ${LEVEL_LABELS[draft.level || 'intermediate']} 챌린지가 이미 있어요.` : error.message)
      } else {
        setSuccess(`${selectedDate} ${LEVEL_LABELS[draft.level || 'intermediate']} 챌린지가 저장되었어요!`)
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
      level: data.level || 'intermediate',
      progressions: (data.chords?.progressions ?? []).map((p: { label: string; chords: unknown; style?: string; tempo?: number }) => ({
        ...p,
        chords: toMeasures(p.chords),
      })),
    })
    setError(''); setSuccess('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 쓰기 결과를 반드시 확인한다. RLS가 막으면 Supabase는 에러 없이 0행을
  // 처리하고 끝나서, 확인하지 않으면 화면만 바뀌고 서버는 그대로다.
  async function applyUpdate(table: string, id: string, patch: Record<string, unknown>) {
    const supabase = createClient()
    const { data, error } = await supabase.from(table).update(patch).eq('id', id).select('id')
    if (error) { setError(`실패: ${error.message}`); return false }
    if (!data?.length) { setError('반영되지 않았습니다. 권한 정책을 확인해주세요.'); return false }
    setError(''); return true
  }

  // 이미 올라온 영상에는 전공이 없다. 영상만 봐서는 알 수 없으니 어드민이
  // 지정한다. 한 사람이 같은 악기를 계속 올리므로, 나머지도 같이 채울지 묻는다.
  async function setMajor(sub: AdminSubmission, major: Major | '') {
    setBusyId(sub.id)
    const value = major || null
    const ok = await applyUpdate('submissions', sub.id, { major: value })
    if (!ok) { setBusyId(''); return }
    setSubs(prev => prev.map(x => x.id === sub.id ? { ...x, major: value } : x))

    const others = subs.filter(x => x.user_id === sub.user_id && x.id !== sub.id && !x.major)
    if (value && others.length > 0 &&
        confirm(`${sub.userName} 님의 전공이 안 정해진 영상이 ${others.length}개 더 있어요. 같이 ${MAJOR_LABELS[major as Major]}로 넣을까요?`)) {
      const supabase = createClient()
      const { data } = await supabase.from('submissions')
        .update({ major: value })
        .eq('user_id', sub.user_id).is('major', null).select('id')
      const done = new Set((data ?? []).map((r: { id: string }) => r.id))
      setSubs(prev => prev.map(x => done.has(x.id) ? { ...x, major: value } : x))
      setSuccess(`${done.size}개에 전공을 넣었어요`)
    }
    setBusyId('')
  }

  async function toggleHidden(sub: AdminSubmission) {
    setBusyId(sub.id)
    const next = sub.hidden_at ? null : new Date().toISOString()
    const ok = await applyUpdate('submissions', sub.id, { hidden_at: next })
    if (ok) {
      setSubs(prev => prev.map(x => x.id === sub.id ? { ...x, hidden_at: next } : x))
      setSuccess(next ? '영상을 내렸어요' : '영상을 다시 공개했어요')
      setTimeout(() => setSuccess(''), 2500)
    }
    setBusyId('')
  }

  async function toggleSuspend(m: Member) {
    if (!m.suspended_at && !confirm(`${m.name ?? '이 회원'}을 정지할까요? 업로드와 댓글이 막힙니다.`)) return
    setBusyId(m.id)
    const next = m.suspended_at ? null : new Date().toISOString()
    const ok = await applyUpdate('profiles', m.id, { suspended_at: next })
    if (ok) {
      setMembers(prev => prev.map(x => x.id === m.id ? { ...x, suspended_at: next } : x))
      setSuccess(next ? '정지했어요' : '정지를 풀었어요')
      setTimeout(() => setSuccess(''), 2500)
    }
    setBusyId('')
  }

  async function loadSubs() {
    if (subsLoaded) return
    const supabase = createClient()
    const { data } = await supabase.from('submissions')
      .select('id, user_id, challenge_id, caption, created_at, hidden_at, group_id, video_url, major')
      .order('created_at', { ascending: false }).limit(100)
    const rows = data ?? []
    const userIds = [...new Set(rows.map(r => r.user_id))]
    const chIds = [...new Set(rows.map(r => r.challenge_id))]
    const [{ data: profs }, { data: chs }] = await Promise.all([
      userIds.length ? supabase.from('profiles').select('id, name').in('id', userIds) : Promise.resolve({ data: [] }),
      chIds.length ? supabase.from('challenges').select('id, title').in('id', chIds) : Promise.resolve({ data: [] }),
    ])
    const nameOf: Record<string, string> = {}
    ;(profs ?? []).forEach((x: { id: string; name: string }) => { nameOf[x.id] = x.name })
    const titleOf: Record<string, string> = {}
    ;(chs ?? []).forEach((x: { id: string; title: string }) => { titleOf[x.id] = x.title })
    setSubs(rows.map(r => ({
      id: r.id, user_id: r.user_id, created_at: r.created_at, hidden_at: r.hidden_at,
      caption: r.caption, group_id: r.group_id, video_url: r.video_url,
      major: (r as { major?: string | null }).major ?? null,
      userName: nameOf[r.user_id] ?? '이름없음',
      challengeTitle: titleOf[r.challenge_id] ?? '(삭제된 챌린지)',
    })))
    setSubsLoaded(true)
  }

  async function loadBugs() {
    // 예전엔 한 번 읽고 말았다(bugsLoaded 가드). 그래서 탭을 다시 열어도
    // 새로 들어온 신고가 안 보였다 — 신고가 사라진 것처럼 보인다.
    const supabase = createClient()
    const { data } = await supabase.from('bug_reports')
      .select('id, user_id, message, page, created_at, resolved_at, admin_reply')
      .order('created_at', { ascending: false }).limit(100)
    const rows = data ?? []
    const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))]
    const { data: profs } = ids.length
      ? await supabase.from('profiles').select('id, name').in('id', ids)
      : { data: [] }
    const nameOf: Record<string, string> = {}
    ;(profs ?? []).forEach((x: { id: string; name: string }) => { nameOf[x.id] = x.name })
    setBugs(rows.map(r => ({
      id: r.id, message: r.message, page: r.page,
      created_at: r.created_at, resolved_at: r.resolved_at,
      userId: r.user_id as string | null,
      adminReply: (r as { admin_reply?: string | null }).admin_reply ?? null,
      userName: nameOf[r.user_id as string] ?? '(탈퇴/익명)',
    })))
    setBugsLoaded(true)
  }

  // 답장은 서비스 롤 라우트가 저장하고 신고자에게만 알림을 보낸다.
  // 알림 대상을 찾으려면 남의 push_subscriptions 를 읽어야 해서 클라이언트로는 못 한다.
  async function replyToBug(b: BugRow) {
    const reply = (bugDrafts[b.id] ?? '').trim()
    if (!reply) return
    setBusyId(b.id)
    try {
      const { data: sess } = await createClient().auth.getSession()
      const tok = sess.session?.access_token
      const res = await fetch('/api/bug-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
        body: JSON.stringify({ id: b.id, reply }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || '답장을 보내지 못했어요.'); setBusyId(''); return }
      const now = new Date().toISOString()
      setBugs(prev => prev.map(x => x.id === b.id ? { ...x, adminReply: reply, resolved_at: now } : x))
      setBugDrafts(d => ({ ...d, [b.id]: '' }))
      setError('')
      setSuccess(data.web + data.app > 0 ? '답장을 보냈어요' : '답장을 저장했어요 (알림 받을 기기가 없어요)')
    } catch {
      setError('답장을 보내지 못했어요.')
    }
    setBusyId('')
  }

  async function toggleResolved(b: BugRow) {
    setBusyId(b.id)
    const next = b.resolved_at ? null : new Date().toISOString()
    const ok = await applyUpdate('bug_reports', b.id, { resolved_at: next })
    if (ok) setBugs(prev => prev.map(x => x.id === b.id ? { ...x, resolved_at: next } : x))
    setBusyId('')
  }

  async function loadGroups() {
    if (groupsLoaded) return
    const supabase = createClient()
    const { data: gs } = await supabase.from('groups')
      .select('id, name, owner_id, created_at').order('created_at', { ascending: false })
    const rows = gs ?? []
    const ownerIds = [...new Set(rows.map(g => g.owner_id))]
    const [{ data: ms }, { data: gsubs }, { data: profs }] = await Promise.all([
      supabase.from('group_members').select('group_id'),
      supabase.from('submissions').select('group_id').not('group_id', 'is', null),
      ownerIds.length ? supabase.from('profiles').select('id, name').in('id', ownerIds) : Promise.resolve({ data: [] }),
    ])
    const memberCount: Record<string, number> = {}
    ;(ms ?? []).forEach((m: { group_id: string }) => { memberCount[m.group_id] = (memberCount[m.group_id] ?? 0) + 1 })
    const videoCount: Record<string, number> = {}
    ;(gsubs ?? []).forEach((v: { group_id: string }) => { videoCount[v.group_id] = (videoCount[v.group_id] ?? 0) + 1 })
    const nameOf: Record<string, string> = {}
    ;(profs ?? []).forEach((x: { id: string; name: string }) => { nameOf[x.id] = x.name })
    setAdminGroups(rows.map(g => ({
      id: g.id, name: g.name, created_at: g.created_at,
      ownerName: nameOf[g.owner_id] ?? '이름없음',
      memberCount: memberCount[g.id] ?? 0,
      videoCount: videoCount[g.id] ?? 0,
    })))
    setGroupsLoaded(true)
  }

  async function loadMembers() {
    if (membersLoaded) return
    const supabase = createClient()
    const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url, created_at, suspended_at').order('created_at', { ascending: false })
    const { data: subs } = await supabase.from('submissions').select('user_id, created_at').order('created_at', { ascending: false })
    const countMap: Record<string, number> = {}
    const lastMap: Record<string, string> = {}
    ;(subs ?? []).forEach(s => {
      countMap[s.user_id] = (countMap[s.user_id] ?? 0) + 1
      if (!lastMap[s.user_id]) lastMap[s.user_id] = s.created_at
    })
    setMembers((profiles ?? []).map(p => ({
      ...p,
      submissionCount: countMap[p.id] ?? 0,
      lastSubmission: lastMap[p.id] ?? null,
    })))
    setMembersLoaded(true)
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
      <div style={{ color: '#8286f5' }}>로딩 중...</div>
    </div>
  )

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#111118', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#eeeeff', outline: 'none',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#09090f' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(9,9,15,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 16px', height: 54, paddingTop: 'calc(env(safe-area-inset-top) + 24px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ color: '#818cf8', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          피드
        </Link>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#eeeeff' }}>관리자</span>
        <div style={{ width: 48 }} />
      </header>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 80px' }}>
        {/* 탭 */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4 }}>
          {(['challenges', 'videos', 'members', 'groups', 'bugs'] as const).map(tab => (
            <button key={tab} onClick={() => {
              setAdminTab(tab)
              if (tab === 'members') loadMembers()
              if (tab === 'videos') loadSubs()
              if (tab === 'groups') loadGroups()
              if (tab === 'bugs') loadBugs()
            }} style={{
              flex: 1, padding: '8px 4px', borderRadius: 9, border: 'none', cursor: 'pointer',
              background: adminTab === tab ? 'rgba(99,102,241,0.2)' : 'transparent',
              color: adminTab === tab ? '#a5b4fc' : '#8a8ab5',
              fontSize: 12.5, fontWeight: 800,
            }}>
              {tab === 'challenges' ? '챌린지' : tab === 'videos' ? '영상' : tab === 'members' ? '회원' : tab === 'groups' ? '그룹' : '신고'}
            </button>
          ))}
        </div>

        {/* ── 영상 관리 ── */}
        {adminTab === 'videos' && (
          <div>
            <div style={{ fontSize: 12, color: '#9a9ac8', fontWeight: 600, marginBottom: 14 }}>
              최근 {subs.length}개 · 내려간 영상 {subs.filter(x => x.hidden_at).length}개
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {subs.map(sub => (
                <div key={sub.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px', opacity: sub.hidden_at ? 0.55 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div onClick={() => setPlaying(sub)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#ccccee' }}>{sub.userName}</span>
                        {sub.hidden_at && (
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#e07060', background: 'rgba(224,112,96,0.15)', padding: '2px 6px', borderRadius: 5 }}>내려감</span>
                        )}
                        {sub.group_id && (
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#9a9ac8', background: 'rgba(255,255,255,0.07)', padding: '2px 6px', borderRadius: 5 }}>그룹</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#9a9ac8', lineHeight: 1.5, wordBreak: 'break-word' }}>
                        {sub.challengeTitle}{sub.caption ? ` · ${sub.caption}` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: '#8a8ab5', marginTop: 3 }}>
                        {new Date(sub.created_at).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                    <button disabled={busyId === sub.id} onClick={() => toggleHidden(sub)} style={{
                      flexShrink: 0, padding: '7px 11px', borderRadius: 9, cursor: 'pointer',
                      border: `1px solid ${sub.hidden_at ? 'rgba(165,180,252,0.35)' : 'rgba(224,112,96,0.4)'}`,
                      background: 'transparent', color: sub.hidden_at ? '#a5b4fc' : '#e07060',
                      fontSize: 12, fontWeight: 800,
                    }}>{sub.hidden_at ? '되돌리기' : '내리기'}</button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#8a8ab5' }}>전공</span>
                    <select
                      value={isMajor(sub.major) ? sub.major : ''}
                      disabled={busyId === sub.id}
                      onChange={e => setMajor(sub, e.target.value as Major | '')}
                      style={{
                        fontSize: 12, fontWeight: 700, padding: '6px 9px', borderRadius: 9,
                        background: 'rgba(13,13,12,0.6)', border: '1px solid rgba(255,255,255,0.14)',
                        color: sub.major ? '#ccccee' : '#8a8ab5', cursor: 'pointer',
                      }}>
                      <option value="">— 안 정함 —</option>
                      {MAJORS.map(m => <option key={m} value={m}>{MAJOR_LABELS[m]}</option>)}
                    </select>
                  </div>
                </div>
              ))}
              {subs.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#8a8ab5', fontSize: 14 }}>영상이 없어요</div>
              )}
            </div>

            {playing && (
              <div onClick={() => setPlaying(null)} style={{
                position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.82)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
              }}>
                <div onClick={e => e.stopPropagation()} style={{
                  width: 'min(520px, 100%)', maxHeight: '90vh', overflowY: 'auto',
                  background: '#141418', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 18, padding: 16,
                }}>
                  <video
                    src={playing.video_url.startsWith('http')
                      ? playing.video_url
                      : createClient().storage.from('videos').getPublicUrl(playing.video_url).data.publicUrl}
                    controls autoPlay playsInline
                    style={{ width: '100%', borderRadius: 12, background: '#000', maxHeight: '60vh' }} />
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#ccccee', marginTop: 12 }}>{playing.userName}</div>
                  <div style={{ fontSize: 12.5, color: '#9a9ac8', marginTop: 3 }}>{playing.challengeTitle}</div>
                  {playing.caption && (
                    <div style={{ fontSize: 13.5, color: '#e0e0f5', marginTop: 10, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {playing.caption}
                    </div>
                  )}
                  <div style={{ fontSize: 11.5, color: '#8a8ab5', marginTop: 8 }}>
                    {new Date(playing.created_at).toLocaleString('ko-KR')}
                  </div>
                  <button onClick={() => setPlaying(null)} style={{
                    width: '100%', marginTop: 14, padding: '11px', borderRadius: 11,
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#ccccee', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}>닫기</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 버그 신고 ── */}
        {adminTab === 'bugs' && (
          <div>
            <div style={{ fontSize: 12, color: '#9a9ac8', fontWeight: 600, marginBottom: 14 }}>
              미처리 {bugs.filter(b => !b.resolved_at).length}건 · 전체 {bugs.length}건
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bugs.map(b => (
                <div key={b.id} style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14, padding: '14px 16px', opacity: b.resolved_at ? 0.72 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#ccccee' }}>{b.userName}</span>
                        {b.page && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#9a9ac8', background: 'rgba(255,255,255,0.07)', padding: '2px 6px', borderRadius: 5 }}>{b.page}</span>
                        )}
                        {b.resolved_at && (
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#8fd08f', background: 'rgba(143,208,143,0.15)', padding: '2px 6px', borderRadius: 5 }}>처리됨</span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: '#ccccee', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{b.message}</div>
                      <div style={{ fontSize: 11, color: '#8a8ab5', marginTop: 6 }}>
                        {new Date(b.created_at).toLocaleString('ko-KR')}
                      </div>
                    </div>
                    <button disabled={busyId === b.id} onClick={() => toggleResolved(b)} style={{
                      flexShrink: 0, padding: '7px 11px', borderRadius: 9, cursor: 'pointer',
                      border: `1px solid ${b.resolved_at ? 'rgba(154,154,200,0.3)' : 'rgba(143,208,143,0.4)'}`,
                      background: 'transparent', color: b.resolved_at ? '#9a9ac8' : '#8fd08f',
                      fontSize: 12, fontWeight: 800,
                    }}>{b.resolved_at ? '되돌리기' : '처리'}</button>
                  </div>

                  {b.adminReply ? (
                    <div style={{ marginTop: 10, borderLeft: '2px solid #c8c4b0', paddingLeft: 10 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 800, color: '#c8c4b0', marginBottom: 3 }}>보낸 답장</div>
                      <div style={{ fontSize: 12.5, color: '#ccccee', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{b.adminReply}</div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 10 }}>
                      <textarea
                        value={bugDrafts[b.id] ?? ''}
                        onChange={e => setBugDrafts(d => ({ ...d, [b.id]: e.target.value }))}
                        rows={2} maxLength={1000}
                        placeholder="답장 (쓰면 신고한 분에게 알림이 갑니다)"
                        style={{
                          width: '100%', boxSizing: 'border-box', resize: 'vertical',
                          background: 'rgba(13,13,12,0.6)', border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 10, padding: '9px 11px', fontSize: 12.5, color: '#e8e8ff',
                          outline: 'none', lineHeight: 1.6, fontFamily: 'inherit',
                        }} />
                      <button
                        disabled={busyId === b.id || !(bugDrafts[b.id] ?? '').trim() || !b.userId}
                        onClick={() => replyToBug(b)}
                        style={{
                          marginTop: 8, padding: '8px 13px', borderRadius: 9, border: 'none',
                          fontSize: 12, fontWeight: 800,
                          cursor: (bugDrafts[b.id] ?? '').trim() && b.userId ? 'pointer' : 'default',
                          background: (bugDrafts[b.id] ?? '').trim() && b.userId
                            ? 'linear-gradient(135deg, #f8f4ec, #c8c4b0)' : 'rgba(255,255,255,0.1)',
                          color: (bugDrafts[b.id] ?? '').trim() && b.userId ? '#0a0a08' : '#9a9ac8',
                        }}>
                        {busyId === b.id ? '보내는 중...' : '답장 보내고 처리'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {bugs.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#8a8ab5', fontSize: 14 }}>신고가 없어요</div>
              )}
            </div>
          </div>
        )}

        {/* ── 그룹 현황 ── */}
        {adminTab === 'groups' && (
          <div>
            <div style={{ fontSize: 12, color: '#9a9ac8', fontWeight: 600, marginBottom: 14 }}>
              총 {adminGroups.length}개
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {adminGroups.map(g => (
                <div key={g.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#ccccee', marginBottom: 3 }}>{g.name}</div>
                      <div style={{ fontSize: 12, color: '#9a9ac8' }}>
                        방장 {g.ownerName} · {new Date(g.created_at).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#a5b4fc' }}>멤버 {g.memberCount}</div>
                      <div style={{ fontSize: 12, color: '#9a9ac8', marginTop: 2 }}>영상 {g.videoCount}</div>
                    </div>
                  </div>
                </div>
              ))}
              {adminGroups.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#8a8ab5', fontSize: 14 }}>그룹이 없어요</div>
              )}
            </div>
          </div>
        )}

        {/* ── 회원 명단 ── */}
        {adminTab === 'members' && (
          <div>
            <div style={{ fontSize: 12, color: '#9a9ac8', fontWeight: 600, marginBottom: 14 }}>
              총 {members.length}명
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {members.map(m => (
                <div key={m.id} style={{
                  background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 800, color: '#fff', overflow: 'hidden',
                  }}>
                    {m.avatar_url
                      ? <img src={m.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                      : (m.name ?? '?').slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#ccccee' }}>{m.name ?? '이름없음'}</span>
                      {m.suspended_at && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#e07060', background: 'rgba(224,112,96,0.15)', padding: '2px 6px', borderRadius: 5 }}>정지됨</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#9494c0' }}>
                      가입 {new Date(m.created_at).toLocaleDateString('ko-KR')}
                      {m.lastSubmission && (
                        <span style={{ marginLeft: 8 }}>
                          · 마지막 업로드 {new Date(m.lastSubmission).toLocaleDateString('ko-KR')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: m.submissionCount > 0 ? '#818cf8' : '#8a8ab5' }}>{m.submissionCount}</div>
                    <div style={{ fontSize: 10, color: '#8a8ab5', fontWeight: 600 }}>영상</div>
                  </div>
                  <button disabled={busyId === m.id} onClick={() => toggleSuspend(m)} style={{
                    flexShrink: 0, padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${m.suspended_at ? 'rgba(165,180,252,0.35)' : 'rgba(224,112,96,0.4)'}`,
                    background: 'transparent', color: m.suspended_at ? '#a5b4fc' : '#e07060',
                    fontSize: 11.5, fontWeight: 800,
                  }}>{m.suspended_at ? '해제' : '정지'}</button>
                </div>
              ))}
              {members.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#8a8ab5', fontSize: 14 }}>회원이 없어요</div>
              )}
            </div>
          </div>
        )}

        {adminTab === 'challenges' && !editingId && (
          <div style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#eeeeff', marginBottom: 10 }}>챌린지 날짜</div>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={inputStyle} />
            {draft && !editingId && challenges.some(c => c.date === selectedDate && (c.level || 'intermediate') === (draft.level || 'intermediate')) && (
              <p style={{ color: '#fbbf24', fontSize: 12, marginTop: 8 }}>⚠️ {selectedDate} {LEVEL_LABELS[draft.level || 'intermediate']} 챌린지가 이미 있어요.</p>
            )}
          </div>
        )}

        {adminTab === 'challenges' && <>
        {/* 챌린지 타입 선택 */}
        {!editingId && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4 }}>
            {(['chord', 'rhythm', 'melody'] as const).map(t => (
              <button key={t} onClick={() => { setChallengeTypeForNew(t); setDraft(null); setRhythmDraft(null); setMelodyDraft(null); setError(''); setSuccess('') }} style={{
                flex: 1, padding: '9px', borderRadius: 9, border: 'none', cursor: 'pointer',
                background: challengeTypeForNew === t ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: challengeTypeForNew === t ? '#a5b4fc' : '#9a9ac2',
                fontSize: 13, fontWeight: 800,
              }}>
                {t === 'chord' ? '🎵 코드챌린지' : t === 'rhythm' ? '🥁 리듬챌린지' : '🎼 멜로디챌린지'}
              </button>
            ))}
          </div>
        )}

        {challengeTypeForNew === 'rhythm' && !editingId && (
          <div>
            <button onClick={generateRhythm} disabled={generatingRhythm}
              style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: generatingRhythm ? '#1a1a2e' : 'linear-gradient(135deg, #4f46e5, #6366f1)', color: generatingRhythm ? '#444466' : '#fff', fontSize: 16, fontWeight: 700, cursor: generatingRhythm ? 'default' : 'pointer', marginBottom: 16 }}>
              {generatingRhythm ? '생성 중...' : 'AI로 리듬 패턴 생성'}
            </button>
            {error && <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{error}</p>}
            {success && <p style={{ color: '#34d399', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{success}</p>}
            {rhythmDraft && (
              <div style={{ background: '#0e0e1a', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 12, color: '#a5a5dd', fontWeight: 600, display: 'block', marginBottom: 6 }}>제목</label>
                  <input value={rhythmDraft.title} onChange={e => setRhythmDraft({ ...rhythmDraft, title: e.target.value })}
                    style={inputStyle} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: '#a5a5dd', fontWeight: 600, display: 'block', marginBottom: 6 }}>설명 (선택)</label>
                  <textarea value={rhythmDraft.description} onChange={e => setRhythmDraft({ ...rhythmDraft, description: e.target.value })}
                    rows={2} style={{ ...inputStyle, resize: 'none' }} />
                </div>
                {rhythmDraft.patterns.map((p, pi) => (
                  <div key={pi} style={{ marginBottom: 8, padding: 10, background: 'rgba(99,102,241,0.07)', borderRadius: 10 }}>
                    <div style={{ fontSize: 11, color: '#8286f5', fontWeight: 700, marginBottom: 6 }}>
                      {p.label || `패턴 ${pi + 1}`}
                    </div>
                    <textarea value={p.abc} onChange={e => setRhythmDraft({ ...rhythmDraft, patterns: rhythmDraft.patterns.map((pp, k) => k === pi ? { ...pp, abc: e.target.value } : pp) })}
                      rows={3} style={{ ...inputStyle, resize: 'vertical', fontSize: 11, fontFamily: 'monospace' }} />
                  </div>
                ))}
                <button onClick={saveRhythmChallenge} disabled={saving}
                  style={{ width: '100%', padding: '13px', borderRadius: 13, border: 'none', marginTop: 16, background: saving ? '#1a1a2e' : 'linear-gradient(135deg, #059669, #10b981)', color: saving ? '#444466' : '#fff', fontSize: 15, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
                  {saving ? '저장 중...' : '✓ 리듬 챌린지 저장하기'}
                </button>
              </div>
            )}
          </div>
        )}

        {challengeTypeForNew === 'melody' && !editingId && (
          <div>
            <button onClick={generateMelody} disabled={generatingMelody}
              style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: generatingMelody ? '#1a1a2e' : 'linear-gradient(135deg, #4f46e5, #6366f1)', color: generatingMelody ? '#444466' : '#fff', fontSize: 16, fontWeight: 700, cursor: generatingMelody ? 'default' : 'pointer', marginBottom: 16 }}>
              {generatingMelody ? '생성 중...' : 'AI로 멜로디 프레이즈 생성'}
            </button>
            {error && <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{error}</p>}
            {success && <p style={{ color: '#34d399', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{success}</p>}
            {melodyDraft && (
              <div style={{ background: '#0e0e1a', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 12, color: '#a5a5dd', fontWeight: 600, display: 'block', marginBottom: 6 }}>제목</label>
                  <input value={melodyDraft.title} onChange={e => setMelodyDraft({ ...melodyDraft, title: e.target.value })}
                    style={inputStyle} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: '#a5a5dd', fontWeight: 600, display: 'block', marginBottom: 6 }}>설명 (선택)</label>
                  <textarea value={melodyDraft.description} onChange={e => setMelodyDraft({ ...melodyDraft, description: e.target.value })}
                    rows={2} style={{ ...inputStyle, resize: 'none' }} />
                </div>
                {melodyDraft.patterns.map((p, pi) => (
                  <div key={pi} style={{ marginBottom: 8, padding: 10, background: 'rgba(99,102,241,0.07)', borderRadius: 10 }}>
                    <div style={{ fontSize: 11, color: '#8286f5', fontWeight: 700, marginBottom: 6 }}>
                      {p.label || `프레이즈 ${pi + 1}`}
                    </div>
                    <textarea value={p.abc} onChange={e => setMelodyDraft({ ...melodyDraft, patterns: melodyDraft.patterns.map((pp, k) => k === pi ? { ...pp, abc: e.target.value } : pp) })}
                      rows={3} style={{ ...inputStyle, resize: 'vertical', fontSize: 11, fontFamily: 'monospace' }} />
                  </div>
                ))}
                <button onClick={saveMelodyChallenge} disabled={saving}
                  style={{ width: '100%', padding: '13px', borderRadius: 13, border: 'none', marginTop: 16, background: saving ? '#1a1a2e' : 'linear-gradient(135deg, #059669, #10b981)', color: saving ? '#444466' : '#fff', fontSize: 15, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
                  {saving ? '저장 중...' : '✓ 멜로디 챌린지 저장하기'}
                </button>
              </div>
            )}
          </div>
        )}

        {challengeTypeForNew === 'chord' && <>
        <button onClick={generate} disabled={generating}
          style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: generating ? '#1a1a2e' : 'linear-gradient(135deg, #4f46e5, #6366f1)', color: generating ? '#444466' : '#fff', fontSize: 16, fontWeight: 700, cursor: generating ? 'default' : 'pointer', marginBottom: 16 }}>
          {generating ? '생성 중...' : 'AI로 코드진행 생성'}
        </button>

        {error && <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{error}</p>}
        {success && <p style={{ color: '#34d399', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{success}</p>}

        {draft && (
          <div style={{ background: '#0e0e1a', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#818cf8' }}>
                {editingId ? '챌린지 수정' : '생성된 챌린지 확인 · 수정'}
              </div>
              {editingId && (
                <button onClick={() => { setDraft(null); setEditingId(null); setError('') }}
                  style={{ background: 'none', border: 'none', color: '#9a9ac2', fontSize: 12, cursor: 'pointer' }}>취소</button>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#a5a5dd', fontWeight: 600, display: 'block', marginBottom: 6 }}>제목</label>
              <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })}
                placeholder="예: 재즈 스윙 코드 챌린지" style={inputStyle} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#a5a5dd', fontWeight: 600, display: 'block', marginBottom: 6 }}>설명 (선택)</label>
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

                {/* 마디 그리드 (2열) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {prog.chords.map((measure, mi) => (
                    <div key={mi} style={{
                      background: 'rgba(99,102,241,0.07)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      borderRadius: 10, padding: '8px 8px 6px',
                    }}>
                      {/* 마디 헤더 */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 10, color: '#9a9ac8', fontWeight: 700 }}>{mi + 1}마디</span>
                        {prog.chords.length > 1 && (
                          <button onClick={() => removeMeasure(pi, mi)}
                            style={{ background: 'none', border: 'none', color: '#9494c0', fontSize: 13, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
                        )}
                      </div>
                      {/* 코드 인풋 */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {measure.map((chord, ci) => (
                          <div key={ci} style={{ position: 'relative' }}>
                            <input
                              value={chord}
                              onChange={e => updateChord(pi, mi, ci, e.target.value)}
                              placeholder="코드"
                              style={{
                                width: 52, padding: '5px 3px', borderRadius: 7,
                                background: chord ? 'rgba(99,102,241,0.22)' : 'rgba(255,255,255,0.04)',
                                border: chord ? '1px solid rgba(99,102,241,0.45)' : '1px solid rgba(255,255,255,0.1)',
                                fontSize: 12, fontWeight: 800, color: '#c7d2fe',
                                fontFamily: 'monospace', textAlign: 'center', outline: 'none',
                              }}
                            />
                            {measure.length > 1 && (
                              <button onClick={() => removeChordFromMeasure(pi, mi, ci)}
                                style={{ position: 'absolute', top: -4, right: -4, width: 13, height: 13, borderRadius: '50%', background: '#f87171', border: 'none', color: '#fff', fontSize: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                            )}
                          </div>
                        ))}
                        {measure.length < 4 && (
                          <button onClick={() => addChordToMeasure(pi, mi)}
                            style={{ width: 26, padding: '5px 3px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)', fontSize: 13, color: '#8a8ab5', cursor: 'pointer' }}>+</button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* 마디 추가 카드 */}
                  <button onClick={() => addMeasure(pi)}
                    style={{ padding: '16px 8px', borderRadius: 10, border: '1px dashed rgba(99,102,241,0.2)', background: 'none', color: '#9494c0', fontSize: 20, cursor: 'pointer' }}>
                    +
                  </button>
                </div>
              </div>
            ))}

            <button onClick={addProgression}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px dashed rgba(99,102,241,0.3)', background: 'none', color: '#8286f5', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}>
              + 진행 추가
            </button>

            <button onClick={saveChallenge} disabled={saving}
              style={{ width: '100%', padding: '13px', borderRadius: 13, border: 'none', background: saving ? '#1a1a2e' : 'linear-gradient(135deg, #059669, #10b981)', color: saving ? '#444466' : '#fff', fontSize: 15, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? '저장 중...' : editingId ? '✓ 수정 저장' : '✓ 챌린지 저장하기'}
            </button>
          </div>
        )}

        </>}

        {challenges.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#ccccee', marginBottom: 12 }}>기존 챌린지</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {challenges.filter(ch => (ch.type ?? 'chord') === challengeTypeForNew).map(ch => (
                <div key={ch.id} style={{
                  background: '#0d0d1a',
                  border: editingId === ch.id ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#9a9ae0', fontWeight: 700, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {ch.date}
                      <span style={{ color: LEVEL_COLORS[ch.level || 'intermediate'], fontSize: 10 }}>
                        {LEVEL_LABELS[ch.level || 'intermediate']}
                      </span>
                      <span style={{ fontSize: 10, color: ch.type === 'rhythm' ? '#a78bfa' : ch.type === 'melody' ? '#34d399' : '#60a5fa' }}>
                        {ch.type === 'rhythm' ? '🥁' : ch.type === 'melody' ? '🎼' : '🎵'}
                      </span>
                    </div>
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
        </>}
      </main>
    </div>
  )
}
