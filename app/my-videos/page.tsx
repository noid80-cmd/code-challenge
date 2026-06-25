'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Submission = {
  id: string; video_url: string; caption: string | null
  likes_count: number; created_at: string; is_private: boolean
  challenges: { title: string; date: string } | null
}

function calcStreak(dates: string[]) {
  const uniq = [...new Set(dates)].sort().reverse()
  if (uniq.length === 0) return 0
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (uniq[0] !== today && uniq[0] !== yesterday) return 0
  let streak = 0, checkDate = uniq[0]
  for (const d of uniq) {
    if (d === checkDate) {
      streak++
      const dt = new Date(checkDate); dt.setDate(dt.getDate() - 1)
      checkDate = dt.toISOString().slice(0, 10)
    } else break
  }
  return streak
}

function CalendarView({ submittedDates }: { submittedDates: Set<string> }) {
  const [viewDate, setViewDate] = useState(() => new Date())
  const today = new Date().toISOString().slice(0, 10)
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
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: '#605850', fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}>‹</button>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#f0ece0' }}>{year}년 {month + 1}월</span>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: '#605850', fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}>›</button>
      </div>

      {/* 요일 헤더 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
        {DAY_LABELS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#303028', padding: '4px 0' }}>{d}</div>
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
              <span style={{ fontSize: 12, fontWeight: submitted ? 800 : 500, color: submitted ? '#f0ece0' : '#303028' }}>
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
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUserId(user.id)
      const { data: prof } = await supabase.from('profiles').select('name, avatar_url').eq('id', user.id).single()
      setProfile(prof)
      const { data } = await supabase
        .from('submissions').select('*, challenges(title, date)')
        .eq('user_id', user.id).order('created_at', { ascending: false })
      const subs = (data ?? []) as Submission[]
      setSubmissions(subs)
      const dates = subs.map(s => s.created_at.slice(0, 10))
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

  function handleDeleteState(subId: string) {
    const newSubs = submissions.filter(s => s.id !== subId)
    setSubmissions(newSubs)
    const dates = newSubs.map(s => s.created_at.slice(0, 10))
    setSubmittedDates(new Set(dates))
    setStreak(calcStreak(dates))
    setTotalLikes(newSubs.reduce((sum, s) => sum + s.likes_count, 0))
  }

  function handleTogglePrivacy(subId: string, isPrivate: boolean) {
    setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, is_private: isPrivate } : s))
  }

  const byMonth: Record<string, Submission[]> = {}
  submissions.forEach(s => {
    const d = new Date(s.created_at)
    const key = `${d.getFullYear()}년 ${d.getMonth() + 1}월`
    if (!byMonth[key]) byMonth[key] = []
    byMonth[key].push(s)
  })
  const uploadsToday = submissions[0]?.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10)

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #080808 0%, #0a0a0a 60%, #090909 100%)' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,8,8,0.88)', backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(240,236,224,0.12)',
        padding: '0 20px', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ color: '#605850', fontSize: 13, fontWeight: 700 }}>← 피드</Link>
        <span style={{ fontWeight: 800, fontSize: 16, color: '#f0ece0', letterSpacing: '-0.02em' }}>내 성장 기록</span>
        <button onClick={async () => {
          const supabase = createClient()
          await supabase.auth.signOut()
          window.location.href = '/'
        }} style={{ background: 'none', border: 'none', color: '#403830', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
          로그아웃
        </button>
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '28px 16px 100px' }}>
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
                  {avatarUploading ? '…' : '✎'}
                </div>
              </label>
              <div>
                <div style={{ fontSize: 17, fontWeight: 900, color: '#f0ece0', letterSpacing: '-0.02em' }}>
                  {profile?.name ?? ''}
                </div>
                <div style={{ fontSize: 12, color: '#484640', marginTop: 3 }}>사진을 탭하면 변경할 수 있어요</div>
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
                <div style={{ fontSize: 10, color: streak > 0 ? '#a0988c' : '#605850', fontWeight: 800, marginBottom: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>연속 참여</div>
                <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em', color: streak > 0 ? '#f8f4ec' : '#484640' }}>
                  {streak}
                </div>
                <div style={{ fontSize: 11, color: streak > 0 ? '#605850' : '#484640', marginTop: 5 }}>일 연속</div>
              </div>

              <div style={{ flex: 1, background: 'linear-gradient(145deg, #111110, #0d0d0c)', border: '1px solid rgba(240,236,224,0.08)', borderRadius: 18, padding: '18px' }}>
                <div style={{ fontSize: 10, color: '#605850', fontWeight: 800, marginBottom: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>총 참여</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#e0dcd0', lineHeight: 1, letterSpacing: '-0.04em' }}>{submissions.length}</div>
                <div style={{ fontSize: 11, color: '#484640', marginTop: 5 }}>회 업로드</div>
              </div>

              <div style={{ flex: 1, background: 'linear-gradient(145deg, #111110, #0d0d0c)', border: '1px solid rgba(240,236,224,0.08)', borderRadius: 18, padding: '18px' }}>
                <div style={{ fontSize: 10, color: '#605850', fontWeight: 800, marginBottom: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>받은 좋아요</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#f0ece0', lineHeight: 1, letterSpacing: '-0.04em' }}>{totalLikes}</div>
                <div style={{ fontSize: 11, color: '#484640', marginTop: 5 }}>개</div>
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
          <div style={{ textAlign: 'center', padding: 60, color: '#1a1a18', fontSize: 14 }}>불러오는 중</div>
        ) : submissions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '52px 0' }}>
            <p style={{ color: '#303028', fontSize: 14, fontWeight: 700, marginBottom: 5 }}>아직 업로드한 영상이 없어요</p>
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
                  <VideoCard key={sub.id} sub={sub}
                    onDelete={() => handleDeleteState(sub.id)}
                    onTogglePrivacy={(v) => handleTogglePrivacy(sub.id, v)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  )
}

function VideoCard({ sub, onDelete, onTogglePrivacy }: {
  sub: Submission; onDelete: () => void; onTogglePrivacy: (isPrivate: boolean) => void
}) {
  const supabase = createClient()
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)
  const videoUrl = sub.video_url.startsWith('http')
    ? sub.video_url
    : supabase.storage.from('videos').getPublicUrl(sub.video_url).data.publicUrl
  const date = new Date(sub.created_at)

  async function handleDelete() {
    if (!confirm('이 영상을 삭제할까요?')) return
    setDeleting(true)
    if (!sub.video_url.startsWith('http')) {
      await supabase.storage.from('videos').remove([sub.video_url])
    }
    await supabase.from('submissions').delete().eq('id', sub.id)
    onDelete()
  }

  async function handleToggle() {
    setToggling(true)
    const next = !sub.is_private
    await supabase.from('submissions').update({ is_private: next }).eq('id', sub.id)
    onTogglePrivacy(next)
    setToggling(false)
  }

  return (
    <div style={{
      background: 'linear-gradient(145deg, #111110, #0d0d0c)',
      border: sub.is_private ? '1px solid rgba(240,236,224,0.18)' : '1px solid rgba(240,236,224,0.08)',
      borderRadius: 18, overflow: 'hidden', display: 'flex',
      opacity: deleting ? 0.5 : 1, transition: 'opacity 0.2s',
    }}>
      <div style={{ width: 120, flexShrink: 0, background: '#000', position: 'relative' }}>
        <video src={videoUrl} preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 80 }} />
        {sub.is_private && (
          <div style={{
            position: 'absolute', top: 6, left: 6,
            background: 'rgba(0,0,0,0.65)', borderRadius: 6,
            padding: '2px 6px', fontSize: 10, color: '#a0988c', fontWeight: 700,
          }}>비공개</div>
        )}
      </div>
      <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {sub.challenges?.title && (
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e0dcd0', marginBottom: 4, lineHeight: 1.3 }}>
              {sub.challenges.title}
            </div>
          )}
          {sub.caption && <div style={{ fontSize: 12, color: '#303028', lineHeight: 1.5 }}>{sub.caption}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <span style={{ fontSize: 11, color: '#1a1a18' }}>{date.getMonth() + 1}/{date.getDate()}</span>
          <button type="button" onClick={handleToggle} disabled={toggling} style={{
            background: 'none', border: 'none', cursor: toggling ? 'default' : 'pointer',
            fontSize: 13, padding: 0, color: sub.is_private ? '#a0988c' : '#303028',
          }}>
            {toggling ? '...' : sub.is_private ? '🔒' : '🔓'}
          </button>
          <span style={{ fontSize: 13, color: '#f0ece0', fontWeight: 800 }}>♥ {sub.likes_count}</span>
          <button type="button" onClick={handleDelete} disabled={deleting} style={{
            background: 'none', border: 'none', color: '#604040', fontSize: 12, fontWeight: 700,
            cursor: deleting ? 'default' : 'pointer', padding: 0,
          }}>
            {deleting ? '...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  )
}
