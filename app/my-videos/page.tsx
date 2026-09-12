'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { localDate } from '@/lib/date'
import { thumbUrl } from '@/lib/thumbUrl'
import AcademyCard from '@/app/components/AcademyCard'
import BugReport from '@/app/components/BugReport'
import { PushSettingRow } from '@/app/components/PushBanner'
import MajorSettingRow from '@/app/components/MajorSettingRow'

type Submission = {
  id: string; video_url: string; caption: string | null
  likes_count: number; created_at: string; is_private: boolean
  thumbnail_url: string | null
  challenges: { title: string; date: string } | null
}

// 날짜는 "언제 올렸나"가 아니라 "어느 문제를 풀었나"로 센다.
//
// 챌린지는 오전 10~11시에 새로 만들어진다. 아침 9시에 앱을 열면 아직 어제
// 문제가 떠 있고, 거기에 올린 영상은 피드에선 어제 챌린지에 붙는데 날짜는
// 오늘로 찍혔다 — 한 영상이 두 날짜를 가졌다. 연속 기록의 뜻도 "며칠 연속
// 파일을 올렸나"가 아니라 "며칠 연속 문제를 풀었나"다.
//
// 챌린지가 지워진 옛 영상만 올린 시각으로 돌아간다.
function challengeDay(s: { challenges: { date: string } | null; created_at: string }) {
  return s.challenges?.date ?? localDate(new Date(s.created_at))
}

function calcStreak(dates: string[]) {
  const uniq = [...new Set(dates)].sort().reverse()
  if (uniq.length === 0) return 0
  const today = localDate()
  const yesterday = localDate(new Date(Date.now() - 86400000))
  if (uniq[0] !== today && uniq[0] !== yesterday) return 0
  let streak = 0, checkDate = uniq[0]
  for (const d of uniq) {
    if (d === checkDate) {
      streak++
      const dt = new Date(checkDate); dt.setDate(dt.getDate() - 1)
      checkDate = localDate(dt)
    } else break
  }
  return streak
}

function CalendarView({ submittedDates }: { submittedDates: Set<string> }) {
  const [viewDate, setViewDate] = useState(() => new Date())
  const today = localDate()
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  function prevMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)) }
  function nextMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)) }

  return (
    <div>
      {/* 월 네비게이션 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: '#a0988c', fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}>‹</button>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#f0ece0' }}>{year}년 {month + 1}월</span>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: '#a0988c', fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}>›</button>
      </div>

      {/* 요일 헤더 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
        {DAY_LABELS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#b0a493', padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {/* 날짜 셀 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const submitted = submittedDates.has(dateStr)
          const isToday = dateStr === today
          return (
            <div key={i} style={{
              aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '50%', position: 'relative',
              background: submitted ? 'rgba(240,236,224,0.15)' : 'transparent',
              border: isToday ? '1.5px solid rgba(240,236,224,0.4)' : 'none',
            }}>
              <span style={{ fontSize: 12, fontWeight: submitted ? 800 : 500, color: submitted ? '#f0ece0' : '#b0a493' }}>
                {day}
              </span>
              {submitted && (
                <div style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#f0ece0' }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function MyVideosPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [submittedDates, setSubmittedDates] = useState<Set<string>>(new Set())
  const [streak, setStreak] = useState(0)
  const [totalLikes, setTotalLikes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<{ name: string; avatar_url: string | null } | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  // 이름은 가입할 때 구글/카카오 계정 이름이 그대로 들어온다. 바꿀 방법이
  // 없어서 실명이 공개 피드에 그대로 걸렸다 — 닉네임으로 바꾸게 해달라는
  // 신고가 실제로 들어왔다(2026-09-11).
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [deletingAccount, setDeletingAccount] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login?from=/my-videos'; return }
      setUserId(user.id)
      const { data: prof } = await supabase.from('profiles').select('name, avatar_url').eq('id', user.id).single()
      setProfile(prof)
      const { data } = await supabase
        .from('submissions').select('*, challenges(title, date)')
        .eq('user_id', user.id).order('created_at', { ascending: false })
      const subs = (data ?? []) as Submission[]
      const seen = new Set<string>()
      const deduped = subs.filter(s => { if (seen.has(s.video_url)) return false; seen.add(s.video_url); return true })
      // 목록도 문제 날짜 순으로 놓는다. 올린 시각으로 세워두면, 아침에 어제
      // 문제를 푼 영상이 어제 밤에 오늘 문제를 푼 영상보다 위에 온다.
      // 같은 날 문제끼리는 먼저 올린 것이 위다.
      deduped.sort((a, b) => {
        const d = challengeDay(b).localeCompare(challengeDay(a))
        return d !== 0 ? d : a.created_at.localeCompare(b.created_at)
      })
      setSubmissions(deduped)
      const dates = subs.map(challengeDay)
      setSubmittedDates(new Set(dates))
      setStreak(calcStreak(dates))
      setTotalLikes(subs.reduce((sum, s) => sum + s.likes_count, 0))
      setLoading(false)
    }
    load()
  }, [])

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setAvatarUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${userId}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) {
      alert('사진 업로드 실패: ' + uploadError.message)
    } else {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = `${publicUrl}?t=${Date.now()}`
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
      setProfile(p => p ? { ...p, avatar_url: url } : p)
    }
    setAvatarUploading(false)
  }

  async function handleSaveName() {
    const next = nameDraft.trim().replace(/s+/g, ' ')
    if (!next) { alert('이름을 입력해주세요.'); return }
    if (next.length > 12) { alert('12자까지 쓸 수 있어요.'); return }
    if (!userId) return
    if (next === profile?.name) { setEditingName(false); return }
    setSavingName(true)
    const supabase = createClient()
    // RLS가 막으면 Supabase는 에러 없이 0행을 갱신하고 끝난다. 반영된 행을
    // 확인하지 않으면 바뀐 것처럼 보이다가 새로고침하면 옛 이름이 돌아온다.
    const { data, error } = await supabase.from('profiles')
      .update({ name: next }).eq('id', userId).select('id')
    setSavingName(false)
    if (error || !data?.length) { alert('이름을 바꾸지 못했어요. 잠시 후 다시 시도해주세요.'); return }
    setProfile(pr => pr ? { ...pr, name: next } : pr)
    setEditingName(false)
  }

  function handleDeleteState(subId: string) {
    const newSubs = submissions.filter(s => s.id !== subId)
    setSubmissions(newSubs)
    const dates = newSubs.map(challengeDay)
    setSubmittedDates(new Set(dates))
    setStreak(calcStreak(dates))
    setTotalLikes(newSubs.reduce((sum, s) => sum + s.likes_count, 0))
  }

  function handleTogglePrivacy(subId: string, isPrivate: boolean) {
    setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, is_private: isPrivate } : s))
  }

  async function handleDeleteAccount() {
    if (!confirm('정말 계정을 삭제할까요? 업로드한 영상, 좋아요, 활동 기록이 모두 삭제되며 되돌릴 수 없습니다.')) return
    if (!confirm('마지막 확인입니다. 계정을 삭제하시겠습니까?')) return
    setDeletingAccount(true)
    try {
      const res = await fetch('/api/delete-account', { method: 'POST' })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: '' }))
        alert('계정 삭제에 실패했습니다. ' + (error ?? ''))
        setDeletingAccount(false)
        return
      }
      const supabase = createClient()
      await supabase.auth.signOut()
      window.location.href = '/'
    } catch {
      alert('계정 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.')
      setDeletingAccount(false)
    }
  }

  const byMonth: Record<string, Submission[]> = {}
  submissions.forEach(s => {
    const [y, m] = challengeDay(s).split('-')
    const key = `${y}년 ${Number(m)}월`
    if (!byMonth[key]) byMonth[key] = []
    byMonth[key].push(s)
  })
  const uploadsToday = submittedDates.has(localDate())

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #080808 0%, #0a0a0a 60%, #090909 100%)' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,8,8,0.88)', backdropFilter: 'blur(24px)',
        padding: '0 20px', height: 54, paddingTop: 'calc(env(safe-area-inset-top) + 24px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ color: '#a0988c', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          피드
        </Link>
        <span style={{ fontWeight: 800, fontSize: 16, color: '#f0ece0', letterSpacing: '-0.02em' }}>내 성장 기록</span>
        <button onClick={async () => {
          const supabase = createClient()
          await supabase.auth.signOut()
          window.location.href = '/'
        }} style={{ background: 'none', border: 'none', color: '#b0a89c', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
          로그아웃
        </button>
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '28px 16px max(120px, calc(100px + env(safe-area-inset-bottom)))' }}>
        {!loading && (
          <>
            {/* 프로필 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <label style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', overflow: 'hidden',
                  background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 800, color: '#0a0a08',
                  boxShadow: '0 4px 16px rgba(240,236,224,0.25)',
                  opacity: avatarUploading ? 0.5 : 1,
                }}>
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    : (profile?.name ?? '?').slice(0, 1).toUpperCase()}
                </div>
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 22, height: 22, borderRadius: '50%',
                  background: '#f0ece0', border: '2px solid #0a0a08',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11,
                }}>
                  {avatarUploading ? '…' : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" stroke="#0a0a08" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </label>
              <div style={{ minWidth: 0, flex: 1 }}>
                {editingName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input value={nameDraft} onChange={e => setNameDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }}
                      maxLength={12} autoFocus placeholder="닉네임" style={{
                        flex: 1, minWidth: 0, background: 'rgba(240,236,224,0.06)',
                        border: '1px solid rgba(240,236,224,0.2)', borderRadius: 10,
                        padding: '7px 10px', color: '#f0ece0', fontSize: 15, fontWeight: 800,
                      }} />
                    <button type="button" onClick={handleSaveName} disabled={savingName} style={{
                      background: '#f0ece0', border: 'none', borderRadius: 10, padding: '7px 12px',
                      color: '#0a0a08', fontSize: 12, fontWeight: 800, cursor: savingName ? 'default' : 'pointer',
                    }}>{savingName ? '...' : '저장'}</button>
                    <button type="button" onClick={() => setEditingName(false)} style={{
                      background: 'none', border: 'none', color: '#b0a493', fontSize: 12,
                      fontWeight: 700, cursor: 'pointer', padding: '7px 2px',
                    }}>취소</button>
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => { setNameDraft(profile?.name ?? ''); setEditingName(true) }} style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 17, fontWeight: 900, color: '#f0ece0', letterSpacing: '-0.02em',
                    }}>
                      {profile?.name ?? ''}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.55 }}>
                        <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <div style={{ fontSize: 12, color: '#b0a493', marginTop: 3 }}>이름과 사진을 탭하면 바꿀 수 있어요</div>
                  </>
                )}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div style={{
                flex: 1,
                background: streak > 0
                  ? 'linear-gradient(145deg, rgba(240,236,224,0.12), rgba(200,196,176,0.06))'
                  : 'linear-gradient(145deg, #111110, #0d0d0c)',
                border: streak > 0 ? '1px solid rgba(240,236,224,0.3)' : '1px solid rgba(240,236,224,0.08)',
                borderRadius: 18, padding: '18px',
                boxShadow: streak > 0 ? '0 8px 32px rgba(240,236,224,0.1)' : 'none',
              }}>
                <div style={{ fontSize: 10, color: '#a0988c', fontWeight: 800, marginBottom: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>연속 참여</div>
                <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em', color: streak > 0 ? '#f8f4ec' : '#b0a493' }}>
                  {streak}
                </div>
                <div style={{ fontSize: 11, color: streak > 0 ? '#a0988c' : '#b0a493', marginTop: 5 }}>일 연속</div>
              </div>

              <div style={{ flex: 1, background: 'linear-gradient(145deg, #111110, #0d0d0c)', border: '1px solid rgba(240,236,224,0.08)', borderRadius: 18, padding: '18px' }}>
                <div style={{ fontSize: 10, color: '#a0988c', fontWeight: 800, marginBottom: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>총 참여</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#e0dcd0', lineHeight: 1, letterSpacing: '-0.04em' }}>{submissions.length}</div>
                <div style={{ fontSize: 11, color: '#b0a493', marginTop: 5 }}>회 업로드</div>
              </div>

              <div style={{ flex: 1, background: 'linear-gradient(145deg, #111110, #0d0d0c)', border: '1px solid rgba(240,236,224,0.08)', borderRadius: 18, padding: '18px' }}>
                <div style={{ fontSize: 10, color: '#a0988c', fontWeight: 800, marginBottom: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>받은 좋아요</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#f0ece0', lineHeight: 1, letterSpacing: '-0.04em' }}>{totalLikes}</div>
                <div style={{ fontSize: 11, color: '#b0a493', marginTop: 5 }}>개</div>
              </div>
            </div>

            {streak > 0 && (
              <div style={{
                background: 'rgba(240,236,224,0.06)', border: '1px solid rgba(240,236,224,0.15)',
                borderRadius: 14, padding: '12px 16px', marginBottom: 16,
                fontSize: 13, color: '#a0988c', fontWeight: 600, lineHeight: 1.6,
              }}>
                🔥 {streak}일 연속 참여 중이에요.{' '}
                {uploadsToday ? '내일도 올려보세요!' : `오늘 올리면 ${streak + 1}일이 돼요!`}
              </div>
            )}

            {/* 전공 — 부전공을 시작하거나 전향하면 여기서 바꾼다 */}
            <MajorSettingRow userId={userId} />

            {/* 알림 설정 — 늘 같은 자리에 있어야 찾을 수 있다 */}
            <PushSettingRow user={userId ? { id: userId } : null} />

            {/* 달력 */}
            <div style={{
              background: 'linear-gradient(145deg, #111110, #0d0d0c)',
              border: '1px solid rgba(240,236,224,0.1)',
              borderRadius: 18, padding: '18px 16px', marginBottom: 28,
            }}>
              <CalendarView submittedDates={submittedDates} />
            </div>
          </>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#a8a296', fontSize: 14 }}>불러오는 중</div>
        ) : submissions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '52px 0' }}>
            <p style={{ color: '#b0a493', fontSize: 14, fontWeight: 700, marginBottom: 5 }}>아직 업로드한 영상이 없어요</p>
            <Link href="/upload" style={{
              display: 'inline-block', marginTop: 16, padding: '11px 24px', borderRadius: 12,
              background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
              color: '#0a0a08', fontSize: 14, fontWeight: 700,
              boxShadow: '0 6px 20px rgba(240,236,224,0.35)',
            }}>첫 영상 올리기</Link>
          </div>
        ) : (
          Object.entries(byMonth).map(([month, subs]) => (
            <div key={month} style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', marginBottom: 14, color: '#a0988c' }}>
                {month}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {subs.map(sub => (
                  <VideoCard key={sub.id} sub={sub} userId={userId ?? ''}
                    onDelete={() => handleDeleteState(sub.id)}
                    onTogglePrivacy={(v) => handleTogglePrivacy(sub.id, v)}
                  />
                ))}
              </div>
            </div>
          ))
        )}

        {!loading && (
          <div style={{ marginTop: 32 }}>
            <AcademyCard compact />
          </div>
        )}

        {!loading && (
          <div style={{ marginTop: 40, textAlign: 'center' }}>
            <BugReport />
            <span style={{ color: '#8f8a7e', fontSize: 11, padding: '0 4px' }}>·</span>
            <button onClick={handleDeleteAccount} disabled={deletingAccount} style={{
              background: 'none', border: 'none', color: '#b0a89c', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', padding: 8, textDecoration: 'underline',
            }}>
              {deletingAccount ? '삭제 중...' : '계정 삭제'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

function VideoCard({ sub, userId, onDelete, onTogglePrivacy }: {
  sub: Submission; userId: string; onDelete: () => void; onTogglePrivacy: (isPrivate: boolean) => void
}) {
  const supabase = createClient()
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [localPoster, setLocalPoster] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem(`thumb_${sub.id}`) : null
  )
  const expandedVideoRef = useRef<HTMLVideoElement>(null)

  const videoUrl = sub.video_url.startsWith('http')
    ? sub.video_url
    : supabase.storage.from('videos').getPublicUrl(sub.video_url).data.publicUrl
  const posterUrl = thumbUrl(supabase, sub.thumbnail_url)
  const displayPoster = posterUrl ?? localPoster ?? undefined
  const [, cm, cd] = challengeDay(sub).split('-')

  function captureFrame() {
    if (localPoster || posterUrl) return
    const vid = expandedVideoRef.current
    if (!vid || !vid.videoWidth) return
    try {
      const canvas = document.createElement('canvas')
      const max = 220
      const ratio = Math.min(max / vid.videoWidth, max / vid.videoHeight)
      canvas.width = Math.round(vid.videoWidth * ratio)
      canvas.height = Math.round(vid.videoHeight * ratio)
      canvas.getContext('2d')?.drawImage(vid, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6)
      if (dataUrl && dataUrl.length > 100) {
        localStorage.setItem(`thumb_${sub.id}`, dataUrl)
        setLocalPoster(dataUrl)
      }
    } catch {}
  }

  async function handleDelete() {
    if (!confirm('이 영상을 삭제할까요?')) return
    setDeleting(true)
    await supabase.from('submissions').delete().eq('video_url', sub.video_url).eq('user_id', userId)
    if (!sub.video_url.startsWith('http')) {
      await supabase.storage.from('videos').remove([sub.video_url])
    }
    onDelete()
  }

  async function handleToggle() {
    const next = !sub.is_private
    // 숨기는 쪽만 되묻는다. 잘못 누르면 피드에서 즉시 사라지는데 본인은
    // 사라진 걸 알 방법이 없다 — 다시 공개하는 건 언제든 되돌릴 수 있으니
    // 그쪽은 묻지 않는다.
    if (next && !confirm('이 영상을 나만 보기로 바꿀까요? 피드에서 안 보이게 돼요.')) return
    setToggling(true)
    // RLS가 막으면 Supabase는 에러 없이 0행을 처리하고 끝난다. 반영된 행을
    // 확인하지 않으면 자물쇠는 잠긴 것처럼 보이는데 서버는 그대로다 —
    // 새로고침하면 다시 공개로 보여서 "비공이 자꾸 풀린다"가 된다.
    const { data, error } = await supabase.from('submissions')
      .update({ is_private: next }).eq('id', sub.id).select('id')
    setToggling(false)
    if (error || !data?.length) {
      alert('공개 설정을 바꾸지 못했어요. 잠시 후 다시 시도해주세요.')
      return
    }
    onTogglePrivacy(next)
  }

  return (
    <div style={{
      background: 'linear-gradient(145deg, #111110, #0d0d0c)',
      border: sub.is_private ? '1px solid rgba(240,236,224,0.18)' : '1px solid rgba(240,236,224,0.08)',
      borderRadius: 18, overflow: 'hidden',
      opacity: deleting ? 0.5 : 1, transition: 'opacity 0.2s',
    }}>
      {expanded ? (
        <>
          <video ref={expandedVideoRef} src={videoUrl} poster={displayPoster} controls autoPlay playsInline
            onTimeUpdate={captureFrame}
            style={{ width: '100%', display: 'block', background: '#000', maxHeight: 400, objectFit: 'contain' }} />
          <button type="button" onClick={() => setExpanded(false)} style={{
            width: '100%', padding: '9px', background: 'rgba(240,236,224,0.05)',
            border: 'none', borderTop: '1px solid rgba(240,236,224,0.08)',
            color: '#b0a493', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>접기 ▲</button>
        </>
      ) : (
        <div style={{ display: 'flex', cursor: 'pointer', height: 90 }} onClick={() => setExpanded(true)}>
          <div style={{ width: 110, flexShrink: 0, background: '#111', position: 'relative', overflow: 'hidden' }}>
            {displayPoster ? (
              <img src={displayPoster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(145deg, #1a1a18, #111)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M9 18V6l13-3v12" stroke="rgba(240,236,224,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="6" cy="18" r="3" stroke="rgba(240,236,224,0.2)" strokeWidth="1.5"/><circle cx="19" cy="15" r="3" stroke="rgba(240,236,224,0.2)" strokeWidth="1.5"/></svg>
              </div>
            )}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.2)',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(255,255,255,0.85)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ width: 0, height: 0, borderStyle: 'solid', borderWidth: '5px 0 5px 9px', borderColor: 'transparent transparent transparent #0a0a08', marginLeft: 2 }} />
              </div>
            </div>
            {sub.is_private && (
              <div style={{
                position: 'absolute', top: 5, left: 5,
                background: 'rgba(0,0,0,0.7)', borderRadius: 5,
                padding: '2px 5px', fontSize: 9, color: '#a0988c', fontWeight: 700,
              }}>비공개</div>
            )}
          </div>
          <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, minWidth: 0 }}>
            {sub.caption && (
              <div style={{ fontSize: 13, fontWeight: 800, color: '#f0ece0', lineHeight: 1.3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {sub.caption}
              </div>
            )}
            {sub.challenges?.title && (
              <div style={{ fontSize: 11, color: sub.caption ? '#b0a493' : '#e0dcd0', fontWeight: sub.caption ? 600 : 800, lineHeight: 1.3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {sub.challenges.title}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: '#b0a493' }}>{Number(cm)}/{Number(cd)}</span>
              <button type="button" onClick={e => { e.stopPropagation(); handleToggle() }} disabled={toggling} style={{
                background: 'none', border: 'none', cursor: toggling ? 'default' : 'pointer',
                fontSize: 11, fontWeight: 700, padding: 0, display: 'flex', alignItems: 'center', gap: 4,
                color: sub.is_private ? '#a0988c' : '#b0a493',
              }}>
                {/* 자물쇠 그림만 두면 열린 자물쇠를 "눌러서 공개"로 읽고 눌러서
                    멀쩡한 영상을 숨긴다. 지금 상태를 글자로 같이 밝힌다. */}
                {toggling ? '...' : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                      <rect x="4" y="11" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
                      <path d={sub.is_private ? 'M8 11V7a4 4 0 0 1 8 0v4' : 'M8 11V7a4 4 0 0 1 7.6-1.8'}
                        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    {sub.is_private ? '나만 보기' : '공개중'}
                  </>
                )}
              </button>
              <span style={{ fontSize: 12, color: '#a0988c', fontWeight: 700 }}>♥ {sub.likes_count}</span>
              <button type="button" onClick={e => { e.stopPropagation(); handleDelete() }} disabled={deleting} style={{
                background: 'none', border: 'none', color: '#c08a8a', fontSize: 12, fontWeight: 700,
                cursor: deleting ? 'default' : 'pointer', padding: 0, marginLeft: 'auto',
              }}>
                {deleting ? '...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
