'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// 녹화 화면 구석에 두는 메트로놈. 평소에는 아이콘만 작게 떠 있고,
// 누르면 템포와 볼륨만 나온다 — 연주 직전에 만질 것은 그 둘뿐이다.
//
// 소리는 Web Audio로 직접 만든다. 오디오 파일을 받아오면 첫 클릭이
// 늦게 울리고, 그 한 박이 어긋나면 메트로놈은 쓸모가 없다.

const LS_BPM = 'metronome-bpm'
const LS_VOL = 'metronome-volume'
const MIN_BPM = 40
const MAX_BPM = 208
const BEATS_PER_BAR = 4

export default function Metronome({
  defaultTempo,
  style,
}: {
  defaultTempo?: number
  style?: React.CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [bpm, setBpm] = useState(defaultTempo && defaultTempo >= MIN_BPM && defaultTempo <= MAX_BPM ? defaultTempo : 90)
  const [volume, setVolume] = useState(0.6)
  // 볼륨을 0으로 내려도 박은 보여야 한다 — 이어폰이 없으면 눈으로 센다.
  const [beat, setBeat] = useState(-1)

  const ctxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextNoteRef = useRef(0)
  const beatRef = useRef(0)
  // 스케줄러는 setInterval 안에서 돌기 때문에 최신 값을 ref로 읽어야 한다.
  const bpmRef = useRef(bpm)
  const volRef = useRef(volume)

  useEffect(() => { bpmRef.current = bpm }, [bpm])
  useEffect(() => { volRef.current = volume }, [volume])

  // 지난번에 맞춰둔 값을 기억한다. 챌린지에 템포가 적혀 있어도
  // 본인이 고른 것이 있으면 그쪽을 쓴다.
  useEffect(() => {
    try {
      const b = Number(localStorage.getItem(LS_BPM))
      if (b >= MIN_BPM && b <= MAX_BPM) setBpm(b)
      const v = Number(localStorage.getItem(LS_VOL))
      if (v >= 0 && v <= 1) setVolume(v)
    } catch { /* 저장소가 막힌 브라우저 */ }
  }, [])

  function remember(key: string, value: number) {
    try { localStorage.setItem(key, String(value)) } catch { /* 저장소가 막힌 브라우저 */ }
  }

  // 한 박. 첫 박만 높게 쳐서 마디가 어디서 시작하는지 들린다.
  function click(ctx: AudioContext, at: number, accent: boolean) {
    const vol = volRef.current
    if (vol <= 0) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = accent ? 1600 : 1000
    // 툭 끊어야 딸깍으로 들린다. 서서히 줄이면 삑 소리가 된다.
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(vol * (accent ? 0.9 : 0.55), at + 0.001)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.04)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(at); osc.stop(at + 0.05)
  }

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    setRunning(false)
    setBeat(-1)
  }, [])

  const start = useCallback(() => {
    let ctx = ctxRef.current
    if (!ctx) {
      ctx = new AudioContext()
      ctxRef.current = ctx
    }
    // 아이폰은 화면을 끄거나 다른 앱을 다녀오면 잠들어 있다.
    ctx.resume().catch(() => {})
    nextNoteRef.current = ctx.currentTime + 0.1
    beatRef.current = 0
    setRunning(true)
    // 25ms마다 앞으로 0.15초치를 미리 예약한다. setInterval 자체는
    // 몇 십 ms씩 흔들리지만, 소리 시각은 오디오 시계로 박아두므로
    // 흔들림이 박에 닿지 않는다.
    timerRef.current = setInterval(() => {
      const c = ctxRef.current
      if (!c) return
      while (nextNoteRef.current < c.currentTime + 0.15) {
        const b = beatRef.current
        click(c, nextNoteRef.current, b % BEATS_PER_BAR === 0)
        const at = nextNoteRef.current
        const delay = Math.max(0, (at - c.currentTime) * 1000)
        // 박마다 짧게 번쩍인다. 한 박 내내 켜두면 깜빡임이 아니라 그냥 켜진 것이 된다.
        setTimeout(() => setBeat(b % BEATS_PER_BAR), delay)
        setTimeout(() => setBeat(-1), delay + 90)
        nextNoteRef.current += 60 / bpmRef.current
        beatRef.current = b + 1
      }
    }, 25)
  }, [])

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const adjust = (d: number) => setBpm(b => {
    const next = Math.min(MAX_BPM, Math.max(MIN_BPM, b + d))
    remember(LS_BPM, next)
    return next
  })

  return (
    <div style={{ position: 'absolute', display: 'flex', alignItems: 'flex-end', gap: 8, ...style }}>
      {open && (
        <div style={{
          background: 'rgba(12,12,11,0.94)', border: '1px solid rgba(255,255,255,0.16)',
          borderRadius: 14, padding: '12px 14px', width: 186,
          backdropFilter: 'blur(12px)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" onClick={() => adjust(-5)} style={stepStyle}>−</button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#f0ece0', lineHeight: 1 }}>{bpm}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(240,236,224,0.4)', letterSpacing: '0.1em', marginTop: 3 }}>BPM</div>
            </div>
            <button type="button" onClick={() => adjust(5)} style={stepStyle}>+</button>
          </div>

          <input
            type="range" min={MIN_BPM} max={MAX_BPM} step={1} value={bpm}
            onChange={e => { const v = Number(e.target.value); setBpm(v); remember(LS_BPM, v) }}
            style={{ width: '100%', accentColor: '#f0ece0', marginBottom: 12 }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M7 3L4 5.5H2v5h2L7 13V3z" stroke="rgba(240,236,224,0.6)" strokeWidth="1.4" strokeLinejoin="round" />
              {volume > 0 && <path d="M10 6a2.6 2.6 0 010 4" stroke="rgba(240,236,224,0.6)" strokeWidth="1.4" strokeLinecap="round" />}
              {volume > 0.55 && <path d="M12 4a5.4 5.4 0 010 8" stroke="rgba(240,236,224,0.6)" strokeWidth="1.4" strokeLinecap="round" />}
              {volume === 0 && <path d="M10.5 6.5l3 3M13.5 6.5l-3 3" stroke="rgba(240,236,224,0.6)" strokeWidth="1.4" strokeLinecap="round" />}
            </svg>
            <input
              type="range" min={0} max={1} step={0.05} value={volume}
              onChange={e => { const v = Number(e.target.value); setVolume(v); remember(LS_VOL, v) }}
              style={{ flex: 1, accentColor: '#f0ece0' }}
            />
          </div>

          <div style={{ fontSize: 10, color: 'rgba(240,236,224,0.38)', lineHeight: 1.5, marginTop: 10, wordBreak: 'keep-all' }}>
            {volume === 0
              ? '소리 없이 박만 깜빡여요'
              : '클릭 소리가 영상에도 담겨요 — 이어폰을 쓰면 연주만 남아요'}
          </div>
        </div>
      )}

      <button
        type="button"
        // 아이콘은 패널만 여닫는다 — 접어도 박은 계속 간다.
        onClick={() => setOpen(o => !o)}
        style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
          background: running ? 'rgba(240,236,224,0.92)' : 'rgba(0,0,0,0.5)',
          border: `1px solid ${running ? 'transparent' : 'rgba(255,255,255,0.28)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)',
          // 첫 박마다 한 번 밝아진다. 소리를 꺼도 박이 보인다.
          boxShadow: beat === 0 ? '0 0 0 5px rgba(240,236,224,0.45)'
            : beat > 0 ? '0 0 0 3px rgba(240,236,224,0.2)' : 'none',
          transition: 'box-shadow 0.07s',
        }}
      >
        <MetronomeIcon color={running ? '#0a0a08' : '#f0ece0'} />
      </button>

      {open && (
        <button
          type="button"
          onClick={() => running ? stop() : start()}
          style={{
            position: 'absolute', right: 0, bottom: 52,
            padding: '7px 12px', borderRadius: 999, cursor: 'pointer',
            background: running ? '#ff4444' : 'rgba(240,236,224,0.92)',
            border: 'none', color: running ? '#fff' : '#0a0a08',
            fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap',
          }}
        >
          {running ? '정지' : '시작'}
        </button>
      )}
    </div>
  )
}

const stepStyle: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 9, cursor: 'pointer',
  background: 'rgba(240,236,224,0.1)', border: '1px solid rgba(240,236,224,0.18)',
  color: '#f0ece0', fontSize: 16, fontWeight: 900, lineHeight: 1,
}

function MetronomeIcon({ color }: { color: string }) {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
      {/* 메트로놈 몸통 — 아래가 넓은 사다리꼴 */}
      <path d="M7.6 2.5h4.8l3.1 15H4.5l3.1-15z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4.9 14.6h10.2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* 흔들리는 추 */}
      <path d="M12.6 5.4L8.2 13.6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <rect x="9.1" y="8.3" width="3.4" height="2" rx="0.6" fill={color} transform="rotate(-28 10.8 9.3)" />
    </svg>
  )
}
