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

export default function UploadPage() {
  const router = useRouter()
  const [challenge, setChallenge] = useState<Challenge | null>(null)
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
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase
        .from('challenges')
        .select('*')
        .eq('date', today)
        .single()
      setChallenge(data)
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

    const { error: dbError } = await supabase.from('submissions').insert({
      challenge_id: challenge.id,
      user_id: user.id,
      video_url: path,
      caption: caption.trim() || null,
    })

    if (dbError) {
      setError('저장 실패: ' + dbError.message)
      setUploading(false)
      return
    }

    setUploading(false)
    setDone(true)
  }

  if (done) return (
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
          연주가 올라갔어요.<br />다른 분들의 연주도 확인해보세요.
        </p>
        <Link href="/" style={{
          padding: '12px 30px', borderRadius: 12,
          background: '#4f46e5',
          color: '#fff', fontSize: 14, fontWeight: 700,
        }}>
          피드 보러가기
        </Link>
      </div>
    </div>
  )

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0e0e1e',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12, padding: '13px 16px',
    fontSize: 14, color: '#e4e4f8', outline: 'none',
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
            background: '#0d0d1e',
            border: '1px solid rgba(255,255,255,0.05)',
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
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{
                  width: '100%', padding: '11px',
                  background: '#0d0d1e', border: 'none',
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  color: '#6666aa', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>
                영상 바꾸기
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()}
              style={{
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

          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="한마디 남겨주세요 (선택)"
            rows={2}
            style={{ ...inputStyle, resize: 'none' }}
          />

          {error && (
            <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>{error}</p>
          )}

          <button type="submit" disabled={uploading || !file || !challenge}
            style={{
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
