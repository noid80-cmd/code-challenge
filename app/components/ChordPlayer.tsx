'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { getChordNotes, getBassNote, getGuideTonesVoicing, getWalkingBassNotes } from '@/lib/chords'

type Progression = { label: string; chords: string[]; style?: string; tempo?: number }
type StyleType = 'straight' | 'swing' | 'bossa' | 'funk'
type TrackName = 'drums' | 'bass' | 'guitar' | 'keyboard'
type DrumType = 'kick' | 'snare' | 'snare_ghost' | 'hihat_c' | 'hihat_o' | 'rim' | 'ride'
type DrumEvent = { beat: number; type: DrumType; vel: number }
type NoteEvent  = { beat: number; dur: number; vel: number; strum?: boolean }
type StylePattern = { drums: DrumEvent[]; bass: NoteEvent[]; guitar: NoteEvent[]; keyboard: NoteEvent[] }
type TrackState = { volume: number; muted: boolean }

const TRACK_LABELS: Record<TrackName, string> = { drums: '드럼', bass: '베이스', guitar: '기타', keyboard: '건반' }
const STYLE_LABELS: Record<StyleType, string> = { straight: '스트레이트', swing: '스윙', bossa: '보사노바', funk: '펑크' }

// ── Patterns ─────────────────────────────────────────────────────────────────

const PATTERNS: Record<StyleType, StylePattern> = {
  straight: {
    drums: [
      { beat: 0,   type: 'kick',    vel: 0.9  },
      { beat: 0,   type: 'hihat_c', vel: 0.5  },
      { beat: 0.5, type: 'hihat_c', vel: 0.3  },
      { beat: 1,   type: 'snare',   vel: 0.85 },
      { beat: 1,   type: 'hihat_c', vel: 0.5  },
      { beat: 1.5, type: 'hihat_c', vel: 0.3  },
      { beat: 2,   type: 'kick',    vel: 0.8  },
      { beat: 2,   type: 'hihat_c', vel: 0.5  },
      { beat: 2.5, type: 'hihat_c', vel: 0.3  },
      { beat: 3,   type: 'snare',   vel: 0.85 },
      { beat: 3,   type: 'hihat_c', vel: 0.5  },
      { beat: 3.5, type: 'hihat_c', vel: 0.3  },
    ],
    bass:     [{ beat: 0, dur: 1.9, vel: 0.85 }, { beat: 2, dur: 1.9, vel: 0.75 }],
    guitar:   [
      { beat: 0, dur: 0.85, vel: 0.7,  strum: true },
      { beat: 1, dur: 0.85, vel: 0.55, strum: true },
      { beat: 2, dur: 0.85, vel: 0.7,  strum: true },
      { beat: 3, dur: 0.85, vel: 0.55, strum: true },
    ],
    keyboard: [{ beat: 0, dur: 1.8, vel: 0.65 }, { beat: 2, dur: 1.8, vel: 0.6 }],
  },

  swing: {
    // 스윙 8분음표 = 3연음 2/3 위치 (0.667)
    drums: [
      { beat: 0,     type: 'kick',    vel: 0.7  },
      { beat: 0,     type: 'ride',    vel: 0.65 },
      { beat: 0.667, type: 'ride',    vel: 0.38 },
      { beat: 1,     type: 'snare',   vel: 0.75 },
      { beat: 1,     type: 'ride',    vel: 0.65 },
      { beat: 1,     type: 'hihat_c', vel: 0.5  },
      { beat: 1.667, type: 'ride',    vel: 0.38 },
      { beat: 2,     type: 'ride',    vel: 0.7  },
      { beat: 2.667, type: 'ride',    vel: 0.38 },
      { beat: 3,     type: 'snare',   vel: 0.75 },
      { beat: 3,     type: 'ride',    vel: 0.65 },
      { beat: 3,     type: 'hihat_c', vel: 0.5  },
      { beat: 3.667, type: 'ride',    vel: 0.38 },
    ],
    bass: [
      { beat: 0, dur: 0.85, vel: 0.8  },
      { beat: 1, dur: 0.85, vel: 0.7  },
      { beat: 2, dur: 0.85, vel: 0.78 },
      { beat: 3, dur: 0.85, vel: 0.7  },
    ],
    guitar:   [
      { beat: 1, dur: 0.4, vel: 0.5, strum: true },
      { beat: 3, dur: 0.4, vel: 0.5, strum: true },
    ],
    keyboard: [
      { beat: 0,     dur: 0.35, vel: 0.5  },
      { beat: 1.667, dur: 0.35, vel: 0.45 },
      { beat: 2,     dur: 0.35, vel: 0.55 },
      { beat: 3.667, dur: 0.35, vel: 0.45 },
    ],
  },

  bossa: {
    // 2-3 클라베 패턴 기반
    drums: [
      { beat: 0,    type: 'rim',     vel: 0.7  },
      { beat: 0.75, type: 'rim',     vel: 0.55 },
      { beat: 1.5,  type: 'rim',     vel: 0.65 },
      { beat: 2.5,  type: 'rim',     vel: 0.7  },
      { beat: 3,    type: 'rim',     vel: 0.6  },
      { beat: 0,    type: 'hihat_c', vel: 0.22 },
      { beat: 1,    type: 'hihat_c', vel: 0.18 },
      { beat: 2,    type: 'hihat_c', vel: 0.22 },
      { beat: 3,    type: 'hihat_c', vel: 0.18 },
    ],
    bass: [
      { beat: 0,   dur: 0.65, vel: 0.82 },
      { beat: 0.5, dur: 0.9,  vel: 0.62 },
      { beat: 1.5, dur: 0.65, vel: 0.75 },
      { beat: 2,   dur: 0.45, vel: 0.7  },
      { beat: 2.5, dur: 0.4,  vel: 0.6  },
      { beat: 3.5, dur: 0.4,  vel: 0.55 },
    ],
    guitar: [
      { beat: 0,    dur: 0.6,  vel: 0.65, strum: true },
      { beat: 0.75, dur: 0.5,  vel: 0.5,  strum: true },
      { beat: 1.5,  dur: 0.55, vel: 0.6,  strum: true },
      { beat: 2,    dur: 0.5,  vel: 0.55, strum: true },
      { beat: 2.75, dur: 0.45, vel: 0.5,  strum: true },
      { beat: 3.5,  dur: 0.4,  vel: 0.45, strum: true },
    ],
    keyboard: [
      { beat: 0,   dur: 1.4, vel: 0.5  },
      { beat: 1.5, dur: 0.9, vel: 0.45 },
      { beat: 2.5, dur: 0.9, vel: 0.5  },
    ],
  },

  funk: {
    // 16분음표 그리드
    drums: [
      { beat: 0,    type: 'kick',        vel: 0.95 },
      { beat: 0.75, type: 'kick',        vel: 0.7  },
      { beat: 1,    type: 'snare',       vel: 0.9  },
      { beat: 2,    type: 'kick',        vel: 0.85 },
      { beat: 2.5,  type: 'kick',        vel: 0.65 },
      { beat: 3,    type: 'snare',       vel: 0.9  },
      { beat: 0.5,  type: 'snare_ghost', vel: 0.22 },
      { beat: 1.75, type: 'snare_ghost', vel: 0.18 },
      { beat: 2.75, type: 'snare_ghost', vel: 0.18 },
      { beat: 3.5,  type: 'snare_ghost', vel: 0.22 },
      { beat: 0,    type: 'hihat_c', vel: 0.5  },
      { beat: 0.25, type: 'hihat_c', vel: 0.32 },
      { beat: 0.5,  type: 'hihat_c', vel: 0.4  },
      { beat: 0.75, type: 'hihat_c', vel: 0.32 },
      { beat: 1,    type: 'hihat_c', vel: 0.5  },
      { beat: 1.25, type: 'hihat_c', vel: 0.32 },
      { beat: 1.5,  type: 'hihat_o', vel: 0.45 },
      { beat: 1.75, type: 'hihat_c', vel: 0.32 },
      { beat: 2,    type: 'hihat_c', vel: 0.5  },
      { beat: 2.25, type: 'hihat_c', vel: 0.32 },
      { beat: 2.5,  type: 'hihat_c', vel: 0.4  },
      { beat: 2.75, type: 'hihat_c', vel: 0.32 },
      { beat: 3,    type: 'hihat_c', vel: 0.5  },
      { beat: 3.25, type: 'hihat_c', vel: 0.32 },
      { beat: 3.5,  type: 'hihat_o', vel: 0.45 },
      { beat: 3.75, type: 'hihat_c', vel: 0.32 },
    ],
    bass: [
      { beat: 0,    dur: 0.45, vel: 0.9  },
      { beat: 0.5,  dur: 0.22, vel: 0.65 },
      { beat: 1.5,  dur: 0.45, vel: 0.75 },
      { beat: 2,    dur: 0.45, vel: 0.85 },
      { beat: 2.75, dur: 0.22, vel: 0.6  },
      { beat: 3.5,  dur: 0.4,  vel: 0.65 },
    ],
    guitar: [
      { beat: 0,    dur: 0.22, vel: 0.7,  strum: false },
      { beat: 0.5,  dur: 0.18, vel: 0.4,  strum: false },
      { beat: 0.75, dur: 0.22, vel: 0.6,  strum: true  },
      { beat: 1.5,  dur: 0.22, vel: 0.65, strum: true  },
      { beat: 2,    dur: 0.22, vel: 0.7,  strum: false },
      { beat: 2.25, dur: 0.18, vel: 0.4,  strum: false },
      { beat: 2.75, dur: 0.22, vel: 0.6,  strum: true  },
      { beat: 3.5,  dur: 0.22, vel: 0.6,  strum: true  },
    ],
    keyboard: [
      { beat: 0,   dur: 0.35, vel: 0.75 },
      { beat: 1.5, dur: 0.28, vel: 0.65 },
      { beat: 2,   dur: 0.35, vel: 0.7  },
      { beat: 3.5, dur: 0.28, vel: 0.6  },
    ],
  },
}

// ── Drum synthesis ────────────────────────────────────────────────────────────

function playKick(ctx: AudioContext, time: number, g: number) {
  const osc = ctx.createOscillator(); const gn = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(140, time)
  osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.45)
  gn.gain.setValueAtTime(g, time); gn.gain.exponentialRampToValueAtTime(0.001, time + 0.45)
  osc.connect(gn); gn.connect(ctx.destination); osc.start(time); osc.stop(time + 0.45)
}

function playSnare(ctx: AudioContext, time: number, g: number, ghost = false) {
  const dur = ghost ? 0.06 : 0.13
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate)
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource(); src.buffer = buf
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3500; f.Q.value = 0.6
  const gn = ctx.createGain(); gn.gain.setValueAtTime(g * 0.65, time); gn.gain.exponentialRampToValueAtTime(0.001, time + dur)
  src.connect(f); f.connect(gn); gn.connect(ctx.destination); src.start(time); src.stop(time + dur)
  if (!ghost) {
    const o = ctx.createOscillator(); const og = ctx.createGain()
    o.type = 'triangle'; o.frequency.value = 185
    og.gain.setValueAtTime(g * 0.35, time); og.gain.exponentialRampToValueAtTime(0.001, time + 0.08)
    o.connect(og); og.connect(ctx.destination); o.start(time); o.stop(time + 0.08)
  }
}

function playHihat(ctx: AudioContext, time: number, g: number, open = false) {
  const dur = open ? 0.32 : 0.05
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * (open ? 0.38 : 0.07)), ctx.sampleRate)
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource(); src.buffer = buf
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 9000
  const gn = ctx.createGain(); gn.gain.setValueAtTime(g * 0.35, time); gn.gain.exponentialRampToValueAtTime(0.001, time + dur)
  src.connect(f); f.connect(gn); gn.connect(ctx.destination); src.start(time); src.stop(time + dur + 0.02)
}

function playRim(ctx: AudioContext, time: number, g: number) {
  const o = ctx.createOscillator(); const og = ctx.createGain()
  o.type = 'square'; o.frequency.value = 900
  og.gain.setValueAtTime(g * 0.28, time); og.gain.exponentialRampToValueAtTime(0.001, time + 0.04)
  o.connect(og); og.connect(ctx.destination); o.start(time); o.stop(time + 0.04)
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.03), ctx.sampleRate)
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource(); src.buffer = buf
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 5000
  const gn = ctx.createGain(); gn.gain.setValueAtTime(g * 0.18, time); gn.gain.exponentialRampToValueAtTime(0.001, time + 0.03)
  src.connect(f); f.connect(gn); gn.connect(ctx.destination); src.start(time); src.stop(time + 0.03)
}

function playRide(ctx: AudioContext, time: number, g: number) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.5), ctx.sampleRate)
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource(); src.buffer = buf
  const f1 = ctx.createBiquadFilter(); f1.type = 'highpass'; f1.frequency.value = 5500
  const f2 = ctx.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = 8000; f2.gain.value = 7
  const gn = ctx.createGain(); gn.gain.setValueAtTime(g * 0.28, time); gn.gain.exponentialRampToValueAtTime(0.001, time + 0.5)
  src.connect(f1); f1.connect(f2); f2.connect(gn); gn.connect(ctx.destination); src.start(time); src.stop(time + 0.5)
}

function hitDrum(ctx: AudioContext, type: DrumType, time: number, g: number) {
  if (type === 'kick')        playKick(ctx, time, g)
  else if (type === 'snare')       playSnare(ctx, time, g)
  else if (type === 'snare_ghost') playSnare(ctx, time, g, true)
  else if (type === 'hihat_c')     playHihat(ctx, time, g)
  else if (type === 'hihat_o')     playHihat(ctx, time, g, true)
  else if (type === 'rim')         playRim(ctx, time, g)
  else if (type === 'ride')        playRide(ctx, time, g)
}

// ── Staff SVG ─────────────────────────────────────────────────────────────────

const LINE_GAP = 8, STAFF_H = LINE_GAP * 4, PAD_TOP = 32, PAD_BOT = 14
const ROW_H = PAD_TOP + STAFF_H + PAD_BOT, CLEF_W = 46, MEASURE_W = 120

function StaffRow({ chords, isFirstRow, activeSet, globalOffset, isLast }: {
  chords: string[]; isFirstRow: boolean; activeSet: Set<number>; globalOffset: number; isLast: boolean
}) {
  const filled = [...chords]; while (filled.length < 4) filled.push('')
  const startX = isFirstRow ? CLEF_W : 16
  const totalW = startX + 4 * MEASURE_W + 16
  return (
    <svg width={totalW} height={ROW_H} style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}>
      {[0,1,2,3,4].map(i => <line key={i} x1={isFirstRow ? 8 : 0} y1={PAD_TOP + i * LINE_GAP} x2={totalW - 8} y2={PAD_TOP + i * LINE_GAP} stroke="#3a3a5c" strokeWidth={0.8} />)}
      {isFirstRow && <text x={10} y={PAD_TOP + STAFF_H + 4} fontSize={STAFF_H * 1.8} fill="#6060a0" fontFamily="'Georgia','Times New Roman',serif" style={{ userSelect: 'none' }}>𝄞</text>}
      {filled.map((chord, col) => {
        const gIdx = globalOffset + col; const active = activeSet.has(gIdx) && !!chord; const x = startX + col * MEASURE_W
        return (
          <g key={col}>
            {active && <rect x={x} y={PAD_TOP} width={MEASURE_W} height={STAFF_H} fill="rgba(99,102,241,0.12)" />}
            <line x1={x} y1={PAD_TOP} x2={x} y2={PAD_TOP + STAFF_H} stroke={active ? '#818cf8' : '#3a3a5c'} strokeWidth={active ? 1.5 : 0.9} />
            {chord && <text x={x + 8} y={PAD_TOP - 6} fontSize={11} fontWeight={active ? 900 : 700} fill={active ? '#c7d2fe' : '#8888bb'} fontFamily="'Courier New',monospace">{chord}</text>}
            {chord && <rect x={x + MEASURE_W / 2 - 11} y={PAD_TOP + LINE_GAP * 2 - 5} width={22} height={6} rx={1} fill={active ? '#818cf8' : '#444466'} />}
          </g>
        )
      })}
      <line x1={startX + 4 * MEASURE_W} y1={PAD_TOP} x2={startX + 4 * MEASURE_W} y2={PAD_TOP + STAFF_H} stroke="#3a3a5c" strokeWidth={isLast ? 2.5 : 0.9} />
      {isLast && <line x1={startX + 4 * MEASURE_W - 4} y1={PAD_TOP} x2={startX + 4 * MEASURE_W - 4} y2={PAD_TOP + STAFF_H} stroke="#3a3a5c" strokeWidth={0.9} />}
    </svg>
  )
}

// ── Track row ─────────────────────────────────────────────────────────────────

function TrackRow({ label, track, onChange }: { label: string; track: TrackState; onChange: (t: TrackState) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        onClick={() => onChange({ ...track, muted: !track.muted })}
        style={{
          width: 26, height: 26, borderRadius: 7, flexShrink: 0, cursor: 'pointer',
          background: track.muted ? 'rgba(255,255,255,0.03)' : 'rgba(99,102,241,0.18)',
          border: track.muted ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(99,102,241,0.35)',
          color: track.muted ? '#333352' : '#818cf8', fontSize: 12, fontWeight: 800,
        }}>
        {track.muted ? '✕' : '♪'}
      </button>
      <span style={{ fontSize: 11, fontWeight: 600, color: track.muted ? '#333352' : '#666688', width: 38, flexShrink: 0 }}>
        {label}
      </span>
      <input type="range" min={0} max={100} value={track.volume}
        disabled={track.muted}
        onChange={e => onChange({ ...track, volume: Number(e.target.value) })}
        style={{ flex: 1, cursor: track.muted ? 'default' : 'pointer', opacity: track.muted ? 0.25 : 1 }} />
      <span style={{ fontSize: 11, color: track.muted ? '#333352' : '#555578', width: 24, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {track.volume}
      </span>
    </div>
  )
}

// ── Tempo slider ──────────────────────────────────────────────────────────────

function TempoSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#666688', width: 38, flexShrink: 0 }}>템포</span>
      <input type="range" min={40} max={240} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, cursor: 'pointer' }} />
      <span style={{ fontSize: 11, color: '#555578', width: 52, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {value} BPM
      </span>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ChordPlayer({ progressions, defaultTempo = 120 }: {
  progressions: Progression[]; defaultTempo?: number
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [loadingText, setLoadingText] = useState('')
  const [style, setStyle] = useState<StyleType>('swing')
  const [tempo, setTempo] = useState(defaultTempo)
  const [tracks, setTracks] = useState<Record<TrackName, TrackState>>({
    drums:    { volume: 80, muted: false },
    bass:     { volume: 70, muted: false },
    guitar:   { volume: 65, muted: false },
    keyboard: { volume: 75, muted: false },
  })
  const [activeIdx, setActiveIdx] = useState(-1)

  const ctxRef      = useRef<AudioContext | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pianoRef    = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bassInstRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const guitarRef   = useRef<any>(null)
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRef = useRef<(() => void) | null>(null)
  const stateRef    = useRef({
    chordIdx: 0, nextMeasureTime: 0,
    allChords: [] as string[],
    style: 'swing' as StyleType,
    tempo: 120,
    tracks: {} as Record<TrackName, TrackState>,
  })

  const allChords = progressions.flatMap(p => p.chords.filter(c => c.trim()))

  useEffect(() => {
    stateRef.current.allChords = allChords
    stateRef.current.style  = style
    stateRef.current.tempo  = tempo
    stateRef.current.tracks = tracks
  })

  const stopPlayback = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    pianoRef.current?.releaseAll?.()
    setIsPlaying(false); setActiveIdx(-1)
  }, [])

  useEffect(() => {
    scheduleRef.current = function tick() {
      const s   = stateRef.current
      const ctx = ctxRef.current
      if (!ctx || !s.allChords.length) return

      const secPerBeat  = 60 / s.tempo
      const measureDur  = 4 * secPerBeat
      const LOOKAHEAD   = 0.3

      while (s.nextMeasureTime < ctx.currentTime + LOOKAHEAD) {
        const chord       = s.allChords[s.chordIdx]
        const notes       = getChordNotes(chord)
        const bass        = getBassNote(chord)
        const pat         = PATTERNS[s.style]
        const t0          = s.nextMeasureTime
        const tr          = s.tracks

        // Guitar notes shifted down one octave
        const guitarNotes = notes.map(n => {
          const m = n.match(/^([A-G]#?)(\d+)$/); if (!m) return n
          return `${m[1]}${Math.max(2, parseInt(m[2]) - 1)}`
        })

        if (!tr.drums.muted) {
          for (const e of pat.drums)
            hitDrum(ctx, e.type, t0 + e.beat * secPerBeat, e.vel * (tr.drums.volume / 100))
        }

        if (!tr.bass.muted && bassInstRef.current) {
          if (s.style === 'swing') {
            const nextChord = s.allChords[(s.chordIdx + 1) % s.allChords.length]
            const walkNotes = getWalkingBassNotes(chord, nextChord)
            const walkVels = [0.85, 0.70, 0.78, 0.68]
            walkNotes.forEach((note, i) => {
              bassInstRef.current!.play(note, t0 + i * secPerBeat, {
                duration: secPerBeat * 0.82,
                gain: walkVels[i] * (tr.bass.volume / 100),
              })
            })
          } else {
            for (const e of pat.bass)
              bassInstRef.current.play(bass, t0 + e.beat * secPerBeat, { duration: e.dur * secPerBeat, gain: e.vel * (tr.bass.volume / 100) })
          }
        }

        if (!tr.guitar.muted && guitarRef.current) {
          for (const e of pat.guitar) {
            const t = t0 + e.beat * secPerBeat
            guitarNotes.forEach((note, i) => {
              guitarRef.current!.play(note, t + (e.strum ? i * 0.015 : 0), {
                duration: e.dur * secPerBeat,
                gain: e.vel * (tr.guitar.volume / 100) * (e.strum ? 1 - i * 0.08 : 1),
              })
            })
          }
        }

        if (!tr.keyboard.muted && pianoRef.current) {
          const voicing = getGuideTonesVoicing(chord)
          const vel = tr.keyboard.volume / 100
          const now = ctx.currentTime
          for (const e of pat.keyboard) {
            const t = t0 + e.beat * secPerBeat
            pianoRef.current.triggerAttackRelease(voicing, e.dur * secPerBeat, `+${Math.max(0, t - now)}`, e.vel * vel)
          }
        }

        const capturedIdx = s.chordIdx
        const delay = (t0 - ctx.currentTime) * 1000
        setTimeout(() => setActiveIdx(capturedIdx), Math.max(0, delay))

        s.chordIdx = (s.chordIdx + 1) % s.allChords.length
        s.nextMeasureTime += measureDur
      }

      timerRef.current = setTimeout(() => scheduleRef.current?.(), 25)
    }
  })

  const startPlayback = useCallback(async () => {
    const Tone = await import('tone')
    await Tone.start()
    const ctx = Tone.getContext().rawContext as AudioContext
    if (ctx.state === 'suspended') await ctx.resume()
    ctxRef.current = ctx

    setLoadingText('피아노 로딩 중...')
    try {
      if (!pianoRef.current) {
        const reverb = new Tone.Reverb({ decay: 1.8, preDelay: 0.02, wet: 0.20 })
        await reverb.generate()
        const comp = new Tone.Compressor(-14, 3)
        comp.connect(reverb)
        reverb.toDestination()
        const sampler = new Tone.Sampler({
          urls: {
            A0: 'A0.mp3',  C1: 'C1.mp3',  'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
            A1: 'A1.mp3',  C2: 'C2.mp3',  'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
            A2: 'A2.mp3',  C3: 'C3.mp3',  'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
            A3: 'A3.mp3',  C4: 'C4.mp3',  'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
            A4: 'A4.mp3',  C5: 'C5.mp3',  'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
            A5: 'A5.mp3',  C6: 'C6.mp3',  'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
            A6: 'A6.mp3',  C7: 'C7.mp3',  'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
            A7: 'A7.mp3',  C8: 'C8.mp3',
          },
          baseUrl: 'https://tonejs.github.io/audio/salamander/',
          release: 1.0,
        }).connect(comp)
        await Tone.loaded()
        pianoRef.current = sampler
      }

      setLoadingText('베이스/기타 로딩 중...')
      const Soundfont = (await import('soundfont-player')).default
      await Promise.all([
        !bassInstRef.current && Soundfont.instrument(ctx, 'electric_bass_finger',  { soundfont: 'MusyngKite' }).then(i => { bassInstRef.current = i }),
        !guitarRef.current   && Soundfont.instrument(ctx, 'electric_guitar_clean', { soundfont: 'MusyngKite' }).then(i => { guitarRef.current   = i }),
      ].filter(Boolean))
    } finally {
      setLoadingText('')
    }

    stateRef.current.chordIdx        = 0
    stateRef.current.nextMeasureTime = ctx.currentTime + 0.2

    setIsPlaying(true)
    scheduleRef.current?.()
  }, [])

  useEffect(() => () => stopPlayback(), [stopPlayback])

  // Build staff rows
  const rows: { chords: string[]; globalOffset: number; label: string }[] = []
  let offset = 0
  progressions.forEach(prog => {
    const valid = prog.chords.filter(c => c.trim())
    for (let i = 0; i < valid.length; i += 4)
      rows.push({ chords: valid.slice(i, i + 4), globalOffset: offset + i, label: i === 0 ? prog.label : '' })
    offset += valid.length
  })
  const activeSet = new Set(activeIdx >= 0 ? [activeIdx] : [])
  const isLoading = loadingText !== ''

  const updateTrack = (name: TrackName) => (t: TrackState) =>
    setTracks(prev => ({ ...prev, [name]: t }))

  return (
    <div>
      {/* Staff */}
      <div style={{ background: '#0a0a18', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: '20px 16px 10px', marginBottom: 14, overflowX: 'auto' }}>
        {rows.map((row, ri) => (
          <div key={ri}>
            {row.label && <div style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', marginBottom: 4, marginTop: ri > 0 ? 12 : 0, letterSpacing: '0.05em' }}>{row.label}</div>}
            <StaffRow chords={row.chords} isFirstRow={ri === 0 || !!row.label} activeSet={activeSet} globalOffset={row.globalOffset} isLast={ri === rows.length - 1} />
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ background: '#0c0c1a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 16 }}>
        {/* Style tabs */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 11, padding: 4 }}>
          {(Object.keys(STYLE_LABELS) as StyleType[]).map(s => (
            <button key={s} onClick={() => setStyle(s)} style={{
              flex: 1, padding: '7px 2px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              background: style === s ? 'rgba(99,102,241,0.3)' : 'transparent',
              color: style === s ? '#c7d2fe' : '#44445a',
              border: style === s ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
              boxShadow: style === s ? '0 2px 8px rgba(99,102,241,0.2)' : 'none',
            }}>
              {STYLE_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Track mixer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14, padding: '12px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
          {(Object.keys(TRACK_LABELS) as TrackName[]).map(name => (
            <TrackRow key={name} label={TRACK_LABELS[name]} track={tracks[name]} onChange={updateTrack(name)} />
          ))}
        </div>

        {/* Tempo */}
        <div style={{ marginBottom: 14 }}>
          <TempoSlider value={tempo} onChange={setTempo} />
        </div>

        {/* Play/Stop */}
        <button onClick={isPlaying ? stopPlayback : startPlayback} disabled={isLoading} style={{
          width: '100%', padding: '13px', borderRadius: 14,
          background: isLoading ? 'rgba(255,255,255,0.04)' : isPlaying ? 'rgba(239,68,68,0.12)' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
          color: isLoading ? '#444466' : isPlaying ? '#f87171' : '#fff',
          fontSize: 14, fontWeight: 800, cursor: isLoading ? 'not-allowed' : 'pointer',
          border: isLoading ? '1px solid rgba(255,255,255,0.06)' : isPlaying ? '1px solid rgba(239,68,68,0.25)' : 'none',
          boxShadow: !isLoading && !isPlaying ? '0 4px 20px rgba(99,102,241,0.3)' : 'none',
          letterSpacing: '-0.01em',
        }}>
          {isLoading ? loadingText : isPlaying ? '■  정지' : '▶  반주 재생'}
        </button>
      </div>
    </div>
  )
}
