'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Progression = { label: string; chords: string[]; style?: string; tempo?: number }
type Challenge = {
  id: string
  title: string
  description?: string
  chords: { progressions: Progression[] }
}
type Group = { id: string; name: string }

export default function UploadPage() {
  const router = useRouter()
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [myGroups, setMyGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>('public')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase.from('challenges').select('*').eq('date', today).single()
      setChallenge(data)

      if (user) {
        const { data: memberships } = await supabase
          .from('group_members')
          .select('groups(id, name)')
          .eq('user_id', user.id)
        const groups = (memberships ?? []).map(m => m.groups as unknown as Group).filter(Boolean)
        setMyGroups(groups)
      }
    }
    load()
  }, [])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 100 * 1024 * 1024) { setError('파일 크기는 100MB 이하여야 해요.'); return }
    setFile(f)
    setError('')
    setPreview(URL.createObjectURL(f))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setError('영상을 선택해주세요.'); return }
    if (!challenge) { setError('오늘의 챌린지가 없어요.'); return }
    setError(''); setUploading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const ext = file.name.split('.').pop() || 'mp4'
    const path = `${user.id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(path, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      setError('업로드 실패: ' + uploadError.message)
      setUploading(false)
      return
    }

    const groupId = selectedGroupId === 'public' ? null : selectedGroupId

    const { error: dbError } = await supabase.from('submissions').insert({
      challenge_id: challenge.id,
      user_id: user.id,
      video_url: path,
      caption: caption.trim() || null,
      group_id: groupId,
    })

    if (dbError) {
      setError('저장 실패: ' + dbError.message)
      setUploading(false)
      return
    }

    setUploading(false)
    setDone(true)
  }

  if (done) {
    const isGroup = selectedGroupId !== 'public'
    const groupName = myGroups.find(g => g.id === selectedGroupId)?.name

    return (
      <div style={{ minHeight: '100vh', background: '#08080f', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
        <div>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 22px',
          }}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <path d="M5 13l6 6L21 7" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: '#e4e4f8', marginBottom: 8, letterSpacing: '-0.02em' }}>
            업로드 완료
          </h2>
          <p style={{ color: '#555588', fontSize: 14, marginBottom: 32, lineHeight: 1.7 }}>
            {isGroup ? `${groupName} 크루에 올라갔어요.` : '연주가 피드에 올라갔어요.'}<br />
            {isGroup ? '크루 피드에서 확인해보세요.' : '다른 분들의 연주도 확인해보세요.'}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {isGroup && (
              <Link href={`/groups/${selectedGroupId}`} style={{
                padding: '12px 24px', borderRadius: 12,
                background: '#4f46e5', color: '#fff', fontSize: 14, fontWeight: 700,
              }}>
                크루 피드 보기
              </Link>
            )}
            <Link href="/" style={{
              padding: '12px 24px', borderRadius: 12,
              background: isGroup ? 'rgba(99,102,241,0.1)' : '#4f46e5',
              border: isGroup ? '1px solid rgba(99,102,241,0.2)' : 'none',
              color: isGroup ? '#7777cc' : '#fff',
              fontSize: 14, fontWeight: 700,
            }}>
              피드 보러가기
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0e0e1e',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12, padding: '13px 16px',
    fontSize: 14, color: '#e4e4f8', outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#08080f' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,8,15,0.95)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '0 20px', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ color: '#6666aa', fontSize: 13, fontWeight: 700 }}>← 피드</Link>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#e0e0f8', letterSpacing: '-0.01em' }}>연주 업로드</span>
        <div style={{ width: 48 }} />
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '28px 16px 100px' }}>
        {challenge ? (
          <div style={{
            background: '#0d0d1e',
            border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: 16, padding: 18, marginBottom: 20,
          }}>
            <div style={{ fontSize: 10, color: '#4444aa', fontWeight: 800, marginBottom: 6, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              오늘의 챌린지
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#e4e4f8', marginBottom: 12, letterSpacing: '-0.01em' }}>
              {challenge.title}
            </div>
            {challenge.chords?.progressions?.map((prog, i) => (
              <div key={i} style={{ marginBottom: i < challenge.chords.progressions.length - 1 ? 10 : 0 }}>
                <div style={{ fontSize: 10, color: '#6666a0', fontWeight: 700, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{prog.label}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {prog.chords.map((chord, j) => (
                    <span key={j} style={{
                      padding: '5px 10px', borderRadius: 7,
                      background: 'rgba(99,102,241,0.1)',
                      border: '1px solid rgba(99,102,241,0.18)',
                      fontSize: 13, fontWeight: 800, color: '#a0a0d8', fontFamily: 'monospace',
                    }}>
                      {chord}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            background: '#0d0d1e', border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 16, padding: 20, marginBottom: 20, textAlign: 'center',
          }}>
            <p style={{ color: '#444466', fontSize: 14 }}>오늘의 챌린지가 아직 없어요.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input ref={fileRef} type="file" accept="video/*" onChange={handleFileSelect} style={{ display: 'none' }} />

          {preview ? (
            <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
              <video src={preview} controls playsInline style={{ width: '100%', display: 'block', background: '#000', maxHeight: 360, objectFit: 'contain' }} />
              <button type="button" onClick={() => fileRef.current?.click()} style={{
                width: '100%', padding: '11px',
                background: '#0d0d1e', border: 'none',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                color: '#6666aa', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>
                영상 바꾸기
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} style={{
              width: '100%', padding: '44px 20px', borderRadius: 16,
              border: '1px dashed rgba(99,102,241,0.25)',
              background: 'rgba(99,102,241,0.03)',
              color: '#6666aa', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 20V10M14 10L9 15M14 10L19 15" stroke="#5555aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6 24h16" stroke="#5555aa" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              영상 선택하기
              <span style={{ fontSize: 12, color: '#2e2e52', fontWeight: 500 }}>MP4, MOV 등 · 최대 100MB</span>
            </button>
          )}

          {/* Group selector */}
          {myGroups.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: '#4444aa', fontWeight: 800, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                어디에 올릴까요?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="target"
                    value="public"
                    checked={selectedGroupId === 'public'}
                    onChange={() => setSelectedGroupId('public')}
                    style={{ accentColor: '#6366f1' }}
                  />
                  <div style={{
                    flex: 1, padding: '10px 14px', borderRadius: 10,
                    background: selectedGroupId === 'public' ? 'rgba(99,102,241,0.08)' : '#0a0a18',
                    border: selectedGroupId === 'public' ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: selectedGroupId === 'public' ? '#9090d0' : '#555577' }}>
                      전체 공개 피드
                    </span>
                  </div>
                </label>
                {myGroups.map(g => (
                  <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="target"
                      value={g.id}
                      checked={selectedGroupId === g.id}
                      onChange={() => setSelectedGroupId(g.id)}
                      style={{ accentColor: '#6366f1' }}
                    />
                    <div style={{
                      flex: 1, padding: '10px 14px', borderRadius: 10,
                      background: selectedGroupId === g.id ? 'rgba(99,102,241,0.08)' : '#0a0a18',
                      border: selectedGroupId === g.id ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(255,255,255,0.05)',
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: selectedGroupId === g.id ? '#9090d0' : '#555577' }}>
                        {g.name}
                      </span>
                      <span style={{ fontSize: 11, color: '#333355', marginLeft: 8 }}>크루만 볼 수 있어요</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="한마디 남겨주세요 (선택)"
            rows={2}
            style={{ ...inputStyle, resize: 'none' }}
          />

          {error && <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>{error}</p>}

          <button type="submit" disabled={uploading || !file || !challenge} style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: uploading || !file || !challenge ? '#111128' : '#4f46e5',
            color: uploading || !file || !challenge ? '#333358' : '#fff',
            fontSize: 15, fontWeight: 700,
            cursor: uploading || !file || !challenge ? 'default' : 'pointer',
          }}>
            {uploading ? '업로드 중...' : '연주 올리기'}
          </button>
        </form>
      </main>
    </div>
  )
}
