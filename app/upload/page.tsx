'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Progression = { label: string; chords: string[]; style?: string; tempo?: number }
type Challenge = {
  id: string; title: string; description?: string
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
      if (!user) { router.push('/login'); return }

      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase.from('challenges').select('*').eq('date', today).single()
      setChallenge(data)

      const { data: memberships } = await supabase
        .from('group_members').select('groups(id, name)').eq('user_id', user.id)
      const groups = (memberships ?? []).map(m => m.groups as unknown as Group).filter(Boolean)
      setMyGroups(groups)
    }
    load()
  }, [router])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 100 * 1024 * 1024) { setError('파일 크기는 100MB 이하여야 해요.'); return }
    setFile(f); setError('')
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
      .from('videos').upload(path, file, { contentType: file.type, upsert: false })

    if (uploadError) { setError('업로드 실패: ' + uploadError.message); setUploading(false); return }

    const { error: dbError } = await supabase.from('submissions').insert({
      challenge_id: challenge.id,
      user_id: user.id,
      video_url: path,
      caption: caption.trim() || null,
      group_id: selectedGroupId === 'public' ? null : selectedGroupId,
    })

    if (dbError) { setError('저장 실패: ' + dbError.message); setUploading(false); return }

    setUploading(false); setDone(true)
  }

  if (done) {
    const isGroup = selectedGroupId !== 'public'
    const groupName = myGroups.find(g => g.id === selectedGroupId)?.name
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0a0012 0%, #050008 60%, #080010 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
        <div>
          <div style={{
            width: 72, height: 72, borderRadius: 22,
            background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(236,72,153,0.15))',
            border: '1px solid rgba(124,58,237,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 12px 40px rgba(124,58,237,0.2)',
          }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M5 14l7 7L23 7" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 style={{
            fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 10,
            background: 'linear-gradient(135deg, #e8d8ff, #f472b6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            업로드 완료!
          </h2>
          <p style={{ color: '#5a3f80', fontSize: 14, marginBottom: 36, lineHeight: 1.8 }}>
            {isGroup ? `${groupName} 크루에 올라갔어요.` : '연주가 피드에 올라갔어요.'}<br />
            {isGroup ? '크루 피드에서 확인해보세요.' : '다른 분들의 연주도 확인해보세요.'}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {isGroup && (
              <Link href={`/groups/${selectedGroupId}`} style={{
                padding: '12px 24px', borderRadius: 12,
                background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                color: '#fff', fontSize: 14, fontWeight: 700,
                boxShadow: '0 6px 20px rgba(236,72,153,0.3)',
              }}>
                크루 피드 보기
              </Link>
            )}
            <Link href="/" style={{
              padding: '12px 24px', borderRadius: 12,
              background: isGroup ? 'rgba(124,58,237,0.08)' : 'linear-gradient(135deg, #7c3aed, #ec4899)',
              border: isGroup ? '1px solid rgba(124,58,237,0.2)' : 'none',
              color: isGroup ? '#7c5abf' : '#fff',
              fontSize: 14, fontWeight: 700,
              boxShadow: isGroup ? 'none' : '0 6px 20px rgba(236,72,153,0.3)',
            }}>
              피드 보러가기
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(15,0,30,0.8)',
    border: '1px solid rgba(124,58,237,0.18)',
    borderRadius: 12, padding: '13px 16px',
    fontSize: 14, color: '#f0e6ff', outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0a0012 0%, #050008 60%, #080010 100%)' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(7,0,15,0.85)', backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(124,58,237,0.12)',
        padding: '0 20px', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ color: '#5a3f80', fontSize: 13, fontWeight: 700 }}>← 피드</Link>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#f0e6ff', letterSpacing: '-0.01em' }}>연주 업로드</span>
        <div style={{ width: 48 }} />
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '28px 16px 100px' }}>

        {/* Challenge preview */}
        {challenge ? (
          <div style={{
            background: 'linear-gradient(145deg, #0f001e, #0b0016)',
            border: '1px solid rgba(124,58,237,0.2)',
            borderRadius: 18, padding: 18, marginBottom: 20,
            boxShadow: '0 8px 32px rgba(124,58,237,0.08)',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', marginBottom: 8,
              background: 'linear-gradient(135deg, #a78bfa, #f472b6)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              오늘의 챌린지
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#f0e6ff', marginBottom: 14, letterSpacing: '-0.02em' }}>
              {challenge.title}
            </div>
            {challenge.chords?.progressions?.map((prog, i) => (
              <div key={i} style={{ marginBottom: i < challenge.chords.progressions.length - 1 ? 12 : 0 }}>
                {challenge.chords.progressions.length > 1 && (
                  <div style={{ fontSize: 10, color: '#5a3f80', fontWeight: 700, marginBottom: 6, letterSpacing: '0.06em' }}>{prog.label}</div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {prog.chords.map((chord, j) => (
                    <span key={j} style={{
                      padding: '5px 11px', borderRadius: 8,
                      background: 'rgba(124,58,237,0.1)',
                      border: '1px solid rgba(124,58,237,0.2)',
                      fontSize: 13, fontWeight: 800, color: '#c4a8ff',
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
            background: 'linear-gradient(145deg, #0f001e, #0b0016)',
            border: '1px solid rgba(124,58,237,0.1)',
            borderRadius: 18, padding: 20, marginBottom: 20, textAlign: 'center',
          }}>
            <p style={{ color: '#3d2a5a', fontSize: 14 }}>오늘의 챌린지가 아직 없어요.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input ref={fileRef} type="file" accept="video/*" onChange={handleFileSelect} style={{ display: 'none' }} />

          {/* Video picker */}
          {preview ? (
            <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(124,58,237,0.15)' }}>
              <video src={preview} controls playsInline
                style={{ width: '100%', display: 'block', background: '#000', maxHeight: 360, objectFit: 'contain' }} />
              <button type="button" onClick={() => fileRef.current?.click()} style={{
                width: '100%', padding: '11px',
                background: 'rgba(15,0,30,0.9)', border: 'none',
                borderTop: '1px solid rgba(124,58,237,0.1)',
                color: '#5a3f80', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>
                영상 바꾸기
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} style={{
              width: '100%', padding: '48px 20px', borderRadius: 18,
              border: '1px dashed rgba(124,58,237,0.3)',
              background: 'rgba(124,58,237,0.04)',
              color: '#5a3f80', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 16,
                background: 'rgba(124,58,237,0.1)',
                border: '1px solid rgba(124,58,237,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path d="M11 16V8M11 8L7 12M11 8L15 12" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 19h14" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              영상 선택하기
              <span style={{ fontSize: 12, color: '#2a1840', fontWeight: 500 }}>MP4, MOV 등 · 최대 100MB</span>
            </button>
          )}

          {/* Group selector */}
          {myGroups.length > 0 && (
            <div>
              <div style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', marginBottom: 10,
                background: 'linear-gradient(135deg, #a78bfa, #f472b6)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                어디에 올릴까요?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[{ id: 'public', name: '전체 공개 피드' }, ...myGroups].map(g => (
                  <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input
                      type="radio" name="target" value={g.id}
                      checked={selectedGroupId === g.id}
                      onChange={() => setSelectedGroupId(g.id)}
                      style={{ accentColor: '#7c3aed' }}
                    />
                    <div style={{
                      flex: 1, padding: '10px 14px', borderRadius: 11,
                      background: selectedGroupId === g.id
                        ? 'rgba(124,58,237,0.1)'
                        : 'rgba(15,0,30,0.6)',
                      border: selectedGroupId === g.id
                        ? '1px solid rgba(124,58,237,0.3)'
                        : '1px solid rgba(124,58,237,0.08)',
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: selectedGroupId === g.id ? '#c4a8ff' : '#4a3565' }}>
                        {g.name}
                      </span>
                      {g.id !== 'public' && (
                        <span style={{ fontSize: 11, color: '#2a1840', marginLeft: 8 }}>크루만 볼 수 있어요</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <textarea value={caption} onChange={e => setCaption(e.target.value)}
            placeholder="한마디 남겨주세요 (선택)" rows={2}
            style={{ ...inputStyle, resize: 'none' }} />

          {error && <p style={{ color: '#f472b6', fontSize: 13, textAlign: 'center' }}>{error}</p>}

          <button type="submit" disabled={uploading || !file || !challenge} style={{
            width: '100%', padding: '15px', borderRadius: 13, border: 'none',
            background: uploading || !file || !challenge
              ? 'rgba(124,58,237,0.1)'
              : 'linear-gradient(135deg, #7c3aed, #ec4899)',
            color: uploading || !file || !challenge ? '#3d2a5a' : '#fff',
            fontSize: 15, fontWeight: 800,
            cursor: uploading || !file || !challenge ? 'default' : 'pointer',
            boxShadow: uploading || !file || !challenge ? 'none' : '0 6px 24px rgba(236,72,153,0.35)',
          }}>
            {uploading ? '업로드 중...' : '연주 올리기'}
          </button>
        </form>
      </main>
    </div>
  )
}
