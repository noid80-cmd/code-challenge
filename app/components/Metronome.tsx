'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// 녹화 화면 구석에 두는 메트로놈. 평소에는 아이콘만 작게 떠 있고,
// 누르면 템포와 볼륨만 나온다 — 연주 직전에 만질 것은 그 둘뿐이다.
//
// 소리는 Web Audio로 직접 만든다. 오디오 파일을 받아오면 첫 클릭이
// 늦게 울리고, 그 한 박이 어긋나면 메트로놈은 쓸모가 없다.
//
// 네 박을 똑같이 친다. 첫 박에 액센트를 주면 마디는 읽히지만 폰
// 스피커에서는 약박이 묻혀 박을 놓친다 — 여기서는 안 들리는 게 더 나쁘다.

const LS_BPM = 'metronome-bpm'
const LS_VOL = 'metronome-volume'
const MIN_BPM = 40
const MAX_BPM = 208

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
  const [volume, setVolume] = useState(1)
  // 볼륨을 0으로 내려도 박은 보여야 한다 — 이어폰이 없으면 눈으로 센다.
  const [pulse, setPulse] = useState(false)

  const ctxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextNoteRef = useRef(0)
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
      const v = localStorage.getItem(LS_VOL)
      if (v !== null && Number(v) >= 0 && Number(v) <= 1) setVolume(Number(v))
    } catch { /* 저장소가 막힌 브라우저 */ }
  }, [])

  function remember(key: string, value: number) {
    try { localStorage.setItem(key, String(value)) } catch { /* 저장소가 막힌 브라우저 */ }
  }

  // 한 박. 폰 스피커는 낮은 소리를 못 내보내므로 높은 쪽에서 딸깍 하게
  // 만든다. 사인파는 같은 세기로도 작게 들려서 사각파를 쓰고, 너무
  // 날카로운 배음만 5.2kHz 위에서 깎는다. 짧게 끊어야 딸깍으로 들린다.
  function click(ctx: AudioContext, at: number) {
    const vol = volRef.current
    if (vol <= 0) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const lp = ctx.createBiquadFilter()
    osc.type = 'square'
    osc.frequency.value = 1320
    lp.type = 'lowpass'
    lp.frequency.value = 5200
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(Math.min(1, vol), at + 0.001)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.055)
    osc.connect(lp); lp.connect(gain); gain.connect(ctx.destination)
    osc.start(at); osc.stop(at + 0.07)
  }

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    setRunning(false)
    setPulse(false)
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
    setRunning(true)
    // 시작하면 패널을 접는다 — 연주하는 동안 악보를 가리면 안 된다.
    setOpen(false)
    // 25ms마다 앞으로 0.15초치를 미리 예약한다. setInterval 자체는
    // 몇 십 ms씩 흔들리지만, 소리 시각은 오디오 시계로 박아두므로
    // 흔들림이 박에 닿지 않는다.
    timerRef.current = setInterval(() => {
      const c = ctxRef.current
      if (!c) return
      while (nextNoteRef.current < c.currentTime + 0.15) {
        const at = nextNoteRef.current
        click(c, at)
        // 박마다 짧게 번쩍인다. 한 박 내내 켜두면 깜빡임이 아니라 그냥 켜진 것이 된다.
        const delay = Math.max(0, (at - c.currentTime) * 1000)
        setTimeout(() => setPulse(true), delay)
        setTimeout(() => setPulse(false), delay + 90)
        nextNoteRef.current += 60 / bpmRef.current
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
      {/* 패널 밖 아무 데나 누르면 닫힌다. 화면 전체를 덮지만 z-index가
          패널·아이콘보다 뒤라서 그 둘은 그대로 눌린다. */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: -1 }}
        />
      )}

      {open && (
        <div style={{
          background: 'rgba(12,12,11,0.94)', border: '1px solid rgba(255,255,255,0.16)',
          borderRadius: 14, padding: '12px 14px', width: 190,
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

          <DragBar
            value={bpm} min={MIN_BPM} max={MAX_BPM} step={1}
            onChange={v => { setBpm(v); remember(LS_BPM, v) }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, marginBottom: 6 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M7 3L4 5.5H2v5h2L7 13V3z" stroke="rgba(240,236,224,0.6)" strokeWidth="1.4" strokeLinejoin="round" />
              {volume > 0 && <path d="M10 6a2.6 2.6 0 010 4" stroke="rgba(240,236,224,0.6)" strokeWidth="1.4" strokeLinecap="round" />}
              {volume > 0.55 && <path d="M12 4a5.4 5.4 0 010 8" stroke="rgba(240,236,224,0.6)" strokeWidth="1.4" strokeLinecap="round" />}
              {volume === 0 && <path d="M10.5 6.5l3 3M13.5 6.5l-3 3" stroke="rgba(240,236,224,0.6)" strokeWidth="1.4" strokeLinecap="round" />}
            </svg>
            <div style={{ flex: 1 }}>
              <DragBar
                value={volume} min={0} max={1} step={0.05}
                onChange={v => { setVolume(v); remember(LS_VOL, v) }}
              />
            </div>
          </div>

          {/* 시작·정지는 패널 안에 둔다. 밖에 띄우면 안내 문구나 녹화
              버튼과 자리를 다툰다. */}
          <button
            type="button"
            onClick={() => running ? stop() : start()}
            style={{
              width: '100%', padding: '10px', borderRadius: 11, cursor: 'pointer', border: 'none',
              background: running ? '#ff4444' : 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
              color: running ? '#fff' : '#0a0a08', fontSize: 13.5, fontWeight: 900,
            }}
          >
            {running ? '정지' : '시작'}
          </button>

          <div style={{ fontSize: 10, color: 'rgba(240,236,224,0.38)', lineHeight: 1.5, marginTop: 9, wordBreak: 'keep-all' }}>
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
          boxShadow: pulse ? '0 0 0 5px rgba(240,236,224,0.45)' : 'none',
          transition: 'box-shadow 0.07s',
        }}
      >
        <MetronomeIcon color={running ? '#0a0a08' : '#f0ece0'} />
      </button>
    </div>
  )
}

// 손으로 끄는 막대. <input type="range">를 쓰면 아이폰에서는 동그라미를
// 정확히 짚어야만 움직인다 — 막대를 왼쪽 오른쪽으로 쓸어도 안 바뀌고,
// 아무 데나 눌러도 그 자리로 안 간다. 그래서 직접 만든다.
//
// 누른 자리로 곧장 가고, 누른 채 움직이면 따라온다. 짚을 곳을 넓히려고
// 보이는 막대(5px)보다 손이 닿는 자리(38px)를 훨씬 크게 뒀다.
function DragBar({
  value, min, max, step, onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const pct = ((value - min) / (max - min)) * 100

  function setFrom(clientX: number) {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width === 0) return
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    const raw = min + t * (max - min)
    const snapped = Math.round(raw / step) * step
    // 0.05씩 움직이는 볼륨에서 0.30000000000000004 같은 값이 나오지 않게 한다.
    onChange(Math.min(max, Math.max(min, Number(snapped.toFixed(4)))))
  }

  return (
    <div
      ref={ref}
      onPointerDown={e => {
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        setFrom(e.clientX)
      }}
      onPointerMove={e => { if (dragging.current) setFrom(e.clientX) }}
      onPointerUp={() => { dragging.current = false }}
      onPointerCancel={() => { dragging.current = false }}
      style={{
        position: 'relative', height: 38, display: 'flex', alignItems: 'center',
        cursor: 'pointer',
        // 끄는 동안 화면이 따라 움직이거나 확대되지 않게 한다.
        touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: 5, borderRadius: 3, background: 'rgba(240,236,224,0.16)' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, borderRadius: 3, background: '#f0ece0' }} />
        <div style={{
          position: 'absolute', top: '50%', left: `${pct}%`,
          width: 18, height: 18, borderRadius: '50%', background: '#f8f4ec',
          transform: 'translate(-50%, -50%)', boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }} />
      </div>
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
