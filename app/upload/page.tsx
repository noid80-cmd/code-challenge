'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ChordPlayer from '@/app/components/ChordPlayer'
import { normalizeMeasures } from '@/lib/chords'
import { challengeDate } from '@/lib/date'

type Progression = { label: string; chords: string[]; style?: string; tempo?: number }
type Challenge = { id: string; title: string; description?: string; level: string; chords: { progressions: Progression[] } }

type Group = { id: string; name: string }

export default function UploadPage() {
  const router = useRouter()
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [myGroups, setMyGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>('public')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [selectedProgression, setSelectedProgression] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // 카메라 녹화 상태
  const [recordMode, setRecordMode] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordSecs, setRecordSecs] = useState(0)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const cameraRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { date: today } = challengeDate()
      const { data } = await supabase.from('challenges').select('*').eq('date', today).order('created_at', { ascending: false }).limit(1).single()
      setChallenge(data)
      const { data: memberships } = await supabase
        .from('group_members').select('groups(id, name)').eq('user_id', user.id)
      const groups = (memberships ?? []).map(m => m.groups as unknown as Group).filter(Boolean)
      setMyGroups(groups)
      const groupParam = new URLSearchParams(window.location.search).get('group')
      if (groupParam && groups.some(g => g.id === groupParam)) {
        setSelectedGroupId(groupParam)
      }
    }
    load()
  }, [router])


  // 카메라 시작 — 오버레이는 항상 DOM에 있으므로 stream을 바로 연결
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      })
      streamRef.current = stream
      if (cameraRef.current) {
        cameraRef.current.srcObject = stream
        cameraRef.current.play().catch(() => {})
      }
      setFacingMode('environment')
      setRecordMode(true)
    } catch {
      setError('카메라 접근 권한이 필요해요. 브라우저 설정에서 허용해주세요.')
    }
  }, [])

  // 카메라 종료
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setRecordMode(false)
    setRecording(false)
    setRecordSecs(0)
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  // 녹화 시작
  function startRecording() {
    if (!streamRef.current) return
    chunksRef.current = []
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : ''
    const recorder = new MediaRecorder(streamRef.current, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 1_800_000,
      audioBitsPerSecond: 192_000,
    })
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' })
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
      const f = new File([blob], `recording.${ext}`, { type: blob.type })
      setFile(f)
      setPreview(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob) })
      stopCamera()
    }
    recorder.start()
    recorderRef.current = recorder
    setRecording(true)
    setRecordSecs(0)
    timerRef.current = setInterval(() => {
      setRecordSecs(s => {
        if (s + 1 >= 180) { recorderRef.current?.stop(); if (timerRef.current) clearInterval(timerRef.current) }
        return s + 1
      })
    }, 1000)
  }

  // 녹화 중지
  function stopRecording() {
    recorderRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 50 * 1024 * 1024) { setError('파일이 너무 커요. 앱에서 직접 촬영하면 자동으로 최적화돼요.'); return }
    const url = URL.createObjectURL(f)
    const duration = await new Promise<number>(resolve => {
      const v = document.createElement('video')
      v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration) }
      v.onerror = () => { URL.revokeObjectURL(url); resolve(0) }
      v.preload = 'metadata'; v.src = url
    })
    if (duration > 300) {
      setError(`영상이 너무 길어요 (${Math.round(duration)}초). 5분 이하로 잘라서 올려주세요.`)
      return
    }
    setPreview(URL.createObjectURL(f))
    setFile(f); setError('')
  }

  async function generateThumbnail(f: File): Promise<Blob | null> {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      const url = URL.createObjectURL(f)
      let done = false

      video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;'
      document.body.appendChild(video)

      function finish(blob: Blob | null) {
        if (done) return
        done = true
        clearTimeout(timer)
        URL.revokeObjectURL(url)
        try { document.body.removeChild(video) } catch {}
        resolve(blob)
      }

      function capture() {
        try {
          const w = video.videoWidth, h = video.videoHeight
          if (!w || !h) { finish(null); return }
          const canvas = document.createElement('canvas')
          const max = 720
          const ratio = Math.min(max / w, max / h, 1)
          canvas.width = Math.round(w * ratio)
          canvas.height = Math.round(h * ratio)
          const ctx = canvas.getContext('2d')
          if (!ctx) { finish(null); return }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          canvas.toBlob(b => finish(b), 'image/jpeg', 0.75)
        } catch { finish(null) }
      }

      video.onloadeddata = () => {
        // Muted videos can play() without user gesture on iOS Safari
        // This is the only reliable way to get onseeked/frames on iOS
        video.play().then(() => {
          video.ontimeupdate = () => {
            if (video.currentTime > 0) {
              video.ontimeupdate = null
              video.pause()
              setTimeout(capture, 50)
            }
          }
        }).catch(() => {
          // Non-iOS fallback: seek directly
          video.onseeked = capture
          video.currentTime = 0.1
        })
      }

      video.onerror = () => finish(null)
      const timer = setTimeout(() => finish(null), 10000)

      video.muted = true
      video.playsInline = true
      video.preload = 'auto'
      video.src = url
      video.load()
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setError('영상을 선택해주세요.'); return }
    if (!challenge) { setError('오늘의 챌린지가 없어요.'); return }
    setError(''); setUploading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const ts = Date.now()
    const ext = file.name.split('.').pop() || 'webm'
    const path = `${user.id}/${ts}.${ext}`
    const { error: uploadError } = await supabase.storage.from('videos').upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) { setError('업로드 실패: ' + uploadError.message); setUploading(false); return }
    const thumbBlob = await generateThumbnail(file)
    let thumbnailUrl: string | null = null
    if (thumbBlob) {
      const thumbPath = `${user.id}/thumb_${ts}.jpg`
      const { error: thumbErr } = await supabase.storage.from('avatars').upload(thumbPath, thumbBlob, { contentType: 'image/jpeg', upsert: true })
      if (!thumbErr) thumbnailUrl = supabase.storage.from('avatars').getPublicUrl(thumbPath).data.publicUrl
    }
    const { error: dbError } = await supabase.from('submissions').insert({
      challenge_id: challenge.id, user_id: user.id, video_url: path,
      caption: caption.trim() || null,
      group_id: selectedGroupId === 'public' ? null : selectedGroupId,
      progression_index: selectedProgression,
      is_private: false,
      thumbnail_url: thumbnailUrl,
    })
    if (dbError) { setError('저장 실패: ' + dbError.message); setUploading(false); return }
    setUploading(false); setDone(true)
  }

  // 완료 화면
  if (done) {
    const isGroup = selectedGroupId !== 'public'
    const groupName = myGroups.find(g => g.id === selectedGroupId)?.name
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #080808 0%, #0a0a0a 60%, #090909 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
        <div>
          <div style={{
            width: 72, height: 72, borderRadius: 22,
            background: 'rgba(240,236,224,0.12)', border: '1px solid rgba(240,236,224,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', boxShadow: '0 12px 40px rgba(240,236,224,0.15)',
          }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M5 14l7 7L23 7" stroke="#f0ece0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 10, color: '#f0ece0' }}>업로드 완료!</h2>
          <p style={{ color: '#605850', fontSize: 14, marginBottom: 36, lineHeight: 1.8 }}>
            {isGroup ? `${groupName} 그룹에 올라갔어요.` : '연주가 피드에 올라갔어요.'}<br />
            {isGroup ? '그룹 피드에서 확인해보세요.' : '다른 분들의 연주도 확인해보세요.'}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {isGroup && (
              <a href={`/groups/${selectedGroupId}`} style={{
                padding: '12px 24px', borderRadius: 12,
                background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                color: '#0a0a08', fontSize: 14, fontWeight: 700,
                boxShadow: '0 6px 20px rgba(240,236,224,0.35)',
                textDecoration: 'none', display: 'inline-block',
              }}>그룹 피드 보기</a>
            )}
            <Link href="/" style={{
              padding: '12px 24px', borderRadius: 12,
              background: isGroup ? 'rgba(240,236,224,0.08)' : 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
              border: isGroup ? '1px solid rgba(240,236,224,0.2)' : 'none',
              color: isGroup ? '#a0988c' : '#0a0a08',
              fontSize: 14, fontWeight: 700,
              boxShadow: isGroup ? 'none' : '0 6px 20px rgba(240,236,224,0.35)',
            }}>피드 보러가기</Link>
          </div>
        </div>
      </div>
    )
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(13,13,12,0.8)',
    border: '1px solid rgba(240,236,224,0.15)',
    borderRadius: 12, padding: '13px 16px',
    fontSize: 14, color: '#f0ece0', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #080808 0%, #0a0a0a 60%, #090909 100%)' }}>

      {/* 카메라 오버레이 — 항상 DOM에 마운트, CSS로만 표시/숨김 */}
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 100, display: recordMode ? 'flex' : 'none', flexDirection: 'column' }}>
        {/* 코드 오버레이 */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0) 100%)',
          padding: '52px 16px 32px',
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(240,236,224,0.4)', letterSpacing: '0.12em', marginBottom: 12 }}>
            {challenge?.title}
          </div>
          {(() => {
            const progressions = challenge?.chords?.progressions ?? []
            const prog = progressions[selectedProgression]
            if (!prog) return null
            const measures = normalizeMeasures(prog.chords)
            const rows: string[][][] = []
            for (let i = 0; i < measures.length; i += 4) rows.push(measures.slice(i, i + 4))
            return (
              <div>
                {progressions.length > 1 && (
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(240,236,224,0.4)', letterSpacing: '0.1em', marginBottom: 6 }}>
                    {prog.label}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rows.map((row, ri) => (
                    <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                      {row.map((measure, mi) => (
                        <div key={mi} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {mi > 0 && (
                            <div style={{ width: 1.5, height: 28, background: 'rgba(240,236,224,0.35)', margin: '0 3px', borderRadius: 1 }} />
                          )}
                          {measure.map((chord, ci) => (
                            <span key={ci} style={{
                              padding: '5px 10px', borderRadius: 7,
                              background: 'rgba(240,236,224,0.13)',
                              border: '1px solid rgba(240,236,224,0.28)',
                              backdropFilter: 'blur(8px)',
                              fontSize: 14, fontWeight: 900, color: '#f8f4ec',
                              letterSpacing: '-0.01em',
                            }}>{chord}</span>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>

        {/* 카메라 프리뷰 */}
        <video
          ref={cameraRef}
          autoPlay
          playsInline
          muted
          style={{ flex: 1, width: '100%', objectFit: 'cover', transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
        />

        {/* 하단 컨트롤 */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)',
          padding: '28px 24px 48px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button onClick={stopCamera} style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>✕</button>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            {recording && (
              <div style={{ fontSize: 13, fontWeight: 800, color: recordSecs >= 150 ? '#ff4444' : 'rgba(255,255,255,0.7)', letterSpacing: '0.05em', textAlign: 'center' }}>
                ● {fmt(recordSecs)}
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 4 }}>/ 3:00</span>
                {recordSecs >= 150 && <div style={{ fontSize: 10, marginTop: 2 }}>곧 자동 종료돼요</div>}
              </div>
            )}
            <button
              onClick={recording ? stopRecording : startRecording}
              style={{
                width: 72, height: 72, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: recording ? '#ff4444' : '#fff',
                boxShadow: recording ? '0 0 0 4px rgba(255,68,68,0.4)' : '0 0 0 4px rgba(255,255,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              {recording ? (
                <div style={{ width: 22, height: 22, borderRadius: 4, background: '#fff' }} />
              ) : (
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#ff4444' }} />
              )}
            </button>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
              {recording ? '탭하면 중지' : '탭하면 녹화'}
            </div>
          </div>

          <button onClick={async () => {
            const nextFacing = facingMode === 'environment' ? 'user' : 'environment'
            streamRef.current?.getTracks().forEach(t => t.stop())
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: nextFacing }, audio: true,
            })
            streamRef.current = stream
            if (cameraRef.current) {
              cameraRef.current.srcObject = stream
              cameraRef.current.play().catch(() => {})
            }
            setFacingMode(nextFacing)
          }} style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff', fontSize: 18, cursor: 'pointer',
          }}>⟳</button>
        </div>
      </div>

      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,8,8,0.88)', backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(240,236,224,0.12)',
        padding: '0 20px', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ color: '#605850', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          피드
        </Link>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#f0ece0', letterSpacing: '-0.01em' }}>연주 업로드</span>
        <div style={{ width: 48 }} />
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '28px 16px max(120px, calc(100px + env(safe-area-inset-bottom)))' }}>
        {/* 오늘의 챌린지 */}
        {challenge ? (
          <div style={{
            background: 'linear-gradient(145deg, #111110, #0d0d0c)',
            border: '1px solid rgba(240,236,224,0.18)', borderRadius: 18, padding: 18, marginBottom: 20,
            boxShadow: '0 8px 32px rgba(240,236,224,0.06)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: '#a0988c', marginBottom: 8 }}>오늘의 챌린지</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#f0ece0', marginBottom: 16, letterSpacing: '-0.02em' }}>{challenge.title}</div>
            <div style={{ overflowX: 'auto' }}>
              <ChordPlayer progressions={challenge.chords.progressions} title={challenge.title} />
            </div>
          </div>
        ) : (
          <div style={{ background: 'linear-gradient(145deg, #111110, #0d0d0c)', border: '1px solid rgba(240,236,224,0.08)', borderRadius: 18, padding: 20, marginBottom: 20, textAlign: 'center' }}>
            <p style={{ color: '#303028', fontSize: 14 }}>오늘의 챌린지가 아직 없어요.</p>
          </div>
        )}

        {/* 진행 선택 */}
        {challenge && (challenge.chords?.progressions?.length ?? 0) > 1 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', marginBottom: 8, color: '#a0988c' }}>
              어느 진행을 연주할까요?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {challenge.chords.progressions.map((prog, i) => (
                <button key={i} type="button" onClick={() => setSelectedProgression(i)} style={{
                  padding: '11px 14px', borderRadius: 12,
                  background: selectedProgression === i ? 'rgba(240,236,224,0.1)' : 'rgba(240,236,224,0.03)',
                  border: selectedProgression === i ? '1px solid rgba(240,236,224,0.35)' : '1px solid rgba(240,236,224,0.08)',
                  color: selectedProgression === i ? '#f0ece0' : '#605850',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    background: selectedProgression === i ? 'rgba(240,236,224,0.9)' : 'rgba(240,236,224,0.12)',
                    border: selectedProgression === i ? 'none' : '1px solid rgba(240,236,224,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selectedProgression === i && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0a0a08' }} />
                    )}
                  </div>
                  {prog.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input ref={fileRef} type="file" accept="video/*" onChange={handleFileSelect} style={{ display: 'none' }} />

          {preview ? (
            <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(240,236,224,0.12)' }}>
              <video src={preview} controls playsInline
                style={{ width: '100%', display: 'block', background: '#000', maxHeight: 360, objectFit: 'contain' }} />
              <div style={{ display: 'flex', borderTop: '1px solid rgba(240,236,224,0.08)' }}>
                <button type="button" onClick={startCamera} style={{
                  flex: 1, padding: '11px', background: 'transparent', border: 'none',
                  borderRight: '1px solid rgba(240,236,224,0.08)',
                  color: '#605850', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>다시 촬영</button>
                <button type="button" onClick={() => fileRef.current?.click()} style={{
                  flex: 1, padding: '11px', background: 'transparent', border: 'none',
                  borderRight: '1px solid rgba(240,236,224,0.08)',
                  color: '#605850', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>파일 선택</button>
                <button type="button" onClick={() => { setFile(null); setPreview(prev => { if (prev) URL.revokeObjectURL(prev); return null }) }} style={{
                  flex: 1, padding: '11px', background: 'transparent', border: 'none',
                  color: '#604040', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>취소</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              {/* 촬영하기 */}
              <button type="button" onClick={startCamera} style={{
                flex: 1, padding: '32px 12px', borderRadius: 18,
                border: '1px solid rgba(240,236,224,0.2)',
                background: 'rgba(240,236,224,0.04)',
                color: '#f0ece0', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: 'rgba(240,236,224,0.1)', border: '1px solid rgba(240,236,224,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="4" fill="#f0ece0"/>
                    <circle cx="10" cy="10" r="8" stroke="#f0ece0" strokeWidth="1.5"/>
                  </svg>
                </div>
                지금 촬영하기
                <span style={{ fontSize: 10, color: '#605850', fontWeight: 600 }}>코드 보면서 녹화</span>
              </button>

              {/* 파일 선택 */}
              <button type="button" onClick={() => fileRef.current?.click()} style={{
                flex: 1, padding: '32px 12px', borderRadius: 18,
                border: '1px dashed rgba(240,236,224,0.15)',
                background: 'transparent',
                color: '#605850', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: 'rgba(240,236,224,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 14V6M10 6L6 10M10 6L14 10" stroke="#605850" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M3 17h14" stroke="#605850" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                </div>
                파일 선택
                <span style={{ fontSize: 10, color: '#303028', fontWeight: 600 }}>갤러리에서 올리기</span>
              </button>
            </div>
          )}

          {myGroups.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', marginBottom: 10, color: '#a0988c' }}>어디에 올릴까요?</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[{ id: 'public', name: '전체 공개 피드' }, ...myGroups].map(g => (
                  <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input type="radio" name="target" value={g.id}
                      checked={selectedGroupId === g.id}
                      onChange={() => setSelectedGroupId(g.id)}
                      style={{ accentColor: '#f0ece0' }} />
                    <div style={{
                      flex: 1, padding: '10px 14px', borderRadius: 11,
                      background: selectedGroupId === g.id ? 'rgba(240,236,224,0.08)' : 'rgba(8,12,0,0.6)',
                      border: selectedGroupId === g.id ? '1px solid rgba(240,236,224,0.3)' : '1px solid rgba(240,236,224,0.06)',
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: selectedGroupId === g.id ? '#f8f4ec' : '#303028' }}>
                        {g.name}
                      </span>
                      {g.id !== 'public' && (
                        <span style={{ fontSize: 11, color: '#1a1a18', marginLeft: 8 }}>그룹만 볼 수 있어요</span>
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

{error && <p style={{ color: '#f0ece0', fontSize: 13, textAlign: 'center' }}>{error}</p>}

          <button type="submit" disabled={uploading || !file || !challenge} style={{
            width: '100%', padding: '15px', borderRadius: 13, border: 'none',
            background: uploading || !file || !challenge ? 'rgba(240,236,224,0.08)' : 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
            color: uploading || !file || !challenge ? '#303028' : '#0a0a08',
            fontSize: 15, fontWeight: 800,
            cursor: uploading || !file || !challenge ? 'default' : 'pointer',
            boxShadow: uploading || !file || !challenge ? 'none' : '0 6px 24px rgba(240,236,224,0.4)',
          }}>
            {uploading ? '업로드 중...' : '연주 올리기'}
          </button>
        </form>
      </main>
    </div>
  )
}
