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
    const url = URL.createObjectURL(f)
    setPreview(url)
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
    <div style={{ minHeight: '100vh', background: '#09090f', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
      <div>
        <div style={{
          width: 80, height: 80, borderRadius: 24,
          background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.1))',
          border: '1px solid rgba(16,185,129,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, margin: '0 auto 20px',
        }}>🎉</div>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: '#eeeeff', marginBottom: 8, letterSpacing: '-0.02em' }}>
          업로드 완료!
        </h2>
        <p style={{ color: '#6666aa', fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
          연주가 올라갔어요.<br />다른 분들의 연주도 확인해보세요!
        </p>
        <Link href="/" style={{
          padding: '13px 32px', borderRadius: 14,
          background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
          color: '#fff', fontSize: 15, fontWeight: 700,
          boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
        }}>
          피드 보러가기
        </Link>
      </div>
    </div>
  )

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#111120',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 14, padding: '13px 16px',
    fontSize: 14, color: '#eeeeff', outline: 'none',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#09090f' }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(9,9,15,0.96)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 16px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ color: '#818cf8', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
          ← 피드
        </Link>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#eeeeff', letterSpacing: '-0.01em' }}>연주 업로드</span>
        <div style={{ width: 48 }} />
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px 100px' }}>
        {/* Challenge preview */}
        {challenge && (
          <div style={{
            background: 'linear-gradient(145deg, #0d0d20, #0e0b28)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 18, padding: 18, marginBottom: 20,
          }}>
            <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 800, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              오늘의 챌린지
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#eeeeff', marginBottom: 12, letterSpacing: '-0.01em' }}>
              {challenge.title}
            </div>
            {challenge.chords?.progressions?.map((prog, i) => (
              <div key={i} style={{ marginBottom: i < challenge.chords.progressions.length - 1 ? 10 : 0 }}>
                <div style={{ fontSize: 11, color: '#818cf8', fontWeight: 700, marginBottom: 6 }}>{prog.label}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {prog.chords.map((chord, j) => (
                    <span key={j} style={{
                      padding: '5px 11px', borderRadius: 8,
                      background: 'rgba(99,102,241,0.12)',
                      border: '1px solid rgba(99,102,241,0.22)',
                      fontSize: 13, fontWeight: 800, color: '#c7d2fe', fontFamily: 'monospace',
                    }}>
                      {chord}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!challenge && (
          <div style={{
            background: '#0d0d1a',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 18, padding: 20, marginBottom: 20, textAlign: 'center',
          }}>
            <p style={{ color: '#555570', fontSize: 14 }}>오늘의 챌린지가 아직 없어요.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input ref={fileRef} type="file" accept="video/*" onChange={handleFileSelect} style={{ display: 'none' }} />

          {preview ? (
            <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              <video src={preview} controls playsInline style={{ width: '100%', display: 'block', background: '#000', maxHeight: 360, objectFit: 'contain' }} />
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{
                  width: '100%', padding: '11px',
                  background: '#0d0d1a', border: 'none',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  color: '#818cf8', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>
                영상 바꾸기
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()}
              style={{
                width: '100%', padding: '44px 20px', borderRadius: 18,
                border: '2px dashed rgba(99,102,241,0.3)',
                background: 'rgba(99,102,241,0.04)',
                color: '#818cf8', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              }}>
              <span style={{ fontSize: 36, opacity: 0.8 }}>🎬</span>
              영상 선택하기
              <span style={{ fontSize: 12, color: '#444466', fontWeight: 500 }}>MP4, MOV 등 · 최대 100MB</span>
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
            <div style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10, padding: '10px 14px',
            }}>
              <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>
            </div>
          )}

          <button type="submit" disabled={uploading || !file || !challenge}
            style={{
              width: '100%', padding: '15px', borderRadius: 14, border: 'none',
              background: uploading || !file || !challenge
                ? '#111120'
                : 'linear-gradient(135deg, #4f46e5, #6366f1)',
              color: uploading || !file || !challenge ? '#444466' : '#fff',
              fontSize: 16, fontWeight: 700,
              cursor: uploading || !file || !challenge ? 'default' : 'pointer',
              boxShadow: !uploading && file && challenge ? '0 4px 20px rgba(99,102,241,0.3)' : 'none',
            }}>
            {uploading ? '업로드 중...' : '연주 올리기'}
          </button>
        </form>
      </main>
    </div>
  )
}
