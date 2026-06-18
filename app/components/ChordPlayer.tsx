'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { getChordNotes, getBassNote } from '@/lib/chords'

type Progression = { label: string; chords: string[]; style?: string; tempo?: number }
type StyleType = 'straight' | 'swing' | 'bossa' | 'funk'

const STYLE_LABELS: Record<StyleType, string> = {
  straight: '스트레이트', swing: '스윙', bossa: '보사노바', funk: '펑크',
}

// Beat offsets within a measure (0 = beat 1, 1 = beat 2, etc.)
const STYLE_BEATS: Record<StyleType, Array<{ beat: number; vel: number; bass: boolean }>> = {
  straight: [
    { beat: 0, vel: 0.8, bass: true },
    { beat: 1, vel: 0.5, bass: false },
    { beat: 2, vel: 0.65, bass: false },
    { beat: 3, vel: 0.5, bass: false },
  ],
  swing: [
    { beat: 0, vel: 0.8, bass: true },
    { beat: 0.75, vel: 0.35, bass: false },
    { beat: 2, vel: 0.65, bass: false },
    { beat: 2.75, vel: 0.35, bass: false },
  ],
  bossa: [
    { beat: 0, vel: 0.75, bass: true },
    { beat: 0.75, vel: 0.3, bass: false },
    { beat: 1.5, vel: 0.5, bass: false },
    { beat: 2, vel: 0.65, bass: true },
    { beat: 2.75, vel: 0.3, bass: false },
    { beat: 3.5, vel: 0.4, bass: false },
  ],
  funk: [
    { beat: 0, vel: 0.9, bass: true },
    { beat: 0.25, vel: 0.3, bass: false },
    { beat: 1.5, vel: 0.55, bass: false },
    { beat: 2, vel: 0.75, bass: true },
    { beat: 2.25, vel: 0.3, bass: false },
    { beat: 3, vel: 0.45, bass: false },
  ],
}

// ── Web Audio helpers ────────────────────────────────────────────────────────

function noteToFreq(noteName: string): number {
  const NOTE_MAP: Record<string, number> = {
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
    'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11,
  }
  const m = noteName.match(/^([A-G]#?)(-?\d+)$/)
  if (!m) return 440
  const semi = NOTE_MAP[m[1]] ?? 0
  const oct = parseInt(m[2])
  const midi = (oct + 1) * 12 + semi
  return 440 * Math.pow(2, (midi - 69) / 12)
}

function playNotes(
  ctx: AudioContext,
  dest: AudioNode,
  notes: string[],
  startTime: number,
  duration: number,
  gain: number,
) {
  notes.forEach(note => {
    const freq = noteToFreq(note)
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0, startTime)
    g.gain.linearRampToValueAtTime(gain * 0.15, startTime + 0.02)
    g.gain.exponentialRampToValueAtTime(gain * 0.06, startTime + duration * 0.7)
    g.gain.linearRampToValueAtTime(0, startTime + duration)
    osc.connect(g)
    g.connect(dest)
    osc.start(startTime)
    osc.stop(startTime + duration + 0.05)
  })
}

function playBass(
  ctx: AudioContext,
  dest: AudioNode,
  note: string,
  startTime: number,
  duration: number,
  gain: number,
) {
  const freq = noteToFreq(note)
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  g.gain.setValueAtTime(0, startTime)
  g.gain.linearRampToValueAtTime(gain * 0.25, startTime + 0.05)
  g.gain.exponentialRampToValueAtTime(gain * 0.08, startTime + duration * 0.6)
  g.gain.linearRampToValueAtTime(0, startTime + duration)
  osc.connect(g)
  g.connect(dest)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.05)
}

// ── Staff SVG display ────────────────────────────────────────────────────────

const LINE_GAP = 8
const STAFF_H = LINE_GAP * 4
const PAD_TOP = 32
const PAD_BOT = 14
const ROW_H = PAD_TOP + STAFF_H + PAD_BOT
const CLEF_W = 46
const MEASURE_W = 120

function StaffRow({
  chords, isFirstRow, activeSet, globalOffset, isLast,
}: {
  chords: string[]; isFirstRow: boolean; activeSet: Set<number>
  globalOffset: number; isLast: boolean
}) {
  const filled = [...chords]
  while (filled.length < 4) filled.push('')
  const startX = isFirstRow ? CLEF_W : 16
  const totalW = startX + 4 * MEASURE_W + 16

  return (
    <svg width={totalW} height={ROW_H} style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}>
      {[0, 1, 2, 3, 4].map(i => (
        <line key={i} x1={isFirstRow ? 8 : 0} y1={PAD_TOP + i * LINE_GAP}
          x2={totalW - 8} y2={PAD_TOP + i * LINE_GAP} stroke="#3a3a5c" strokeWidth={0.8} />
      ))}
      {isFirstRow && (
        <text x={10} y={PAD_TOP + STAFF_H + 4}
          fontSize={STAFF_H * 1.8} fill="#6060a0"
          fontFamily="'Georgia','Times New Roman',serif"
          style={{ userSelect: 'none' }}>
          𝄞
        </text>
      )}
      {filled.map((chord, col) => {
        const gIdx = globalOffset + col
        const active = activeSet.has(gIdx) && !!chord
        const x = startX + col * MEASURE_W
        return (
          <g key={col}>
            {active && (
              <rect x={x} y={PAD_TOP} width={MEASURE_W} height={STAFF_H}
                fill="rgba(99,102,241,0.12)" />
            )}
            <line x1={x} y1={PAD_TOP} x2={x} y2={PAD_TOP + STAFF_H}
              stroke={active ? '#818cf8' : '#3a3a5c'} strokeWidth={active ? 1.5 : 0.9} />
            {chord && (
              <text x={x + 8} y={PAD_TOP - 6} fontSize={11}
                fontWeight={active ? 900 : 700}
                fill={active ? '#c7d2fe' : '#8888bb'}
                fontFamily="'Courier New',monospace">
                {chord}
              </text>
            )}
            {chord && (
              <rect
                x={x + MEASURE_W / 2 - 11} y={PAD_TOP + LINE_GAP * 2 - 5}
                width={22} height={6} rx={1}
                fill={active ? '#818cf8' : '#444466'}
              />
            )}
          </g>
        )
      })}
      <line x1={startX + 4 * MEASURE_W} y1={PAD_TOP}
        x2={startX + 4 * MEASURE_W} y2={PAD_TOP + STAFF_H}
        stroke="#3a3a5c" strokeWidth={isLast ? 2.5 : 0.9} />
      {isLast && (
        <line x1={startX + 4 * MEASURE_W - 4} y1={PAD_TOP}
          x2={startX + 4 * MEASURE_W - 4} y2={PAD_TOP + STAFF_H}
          stroke="#3a3a5c" strokeWidth={0.9} />
      )}
    </svg>
  )
}

// ── Slider ───────────────────────────────────────────────────────────────────

function Slider({ label, value, min, max, onChange, unit = '' }: {
  label: string; value: number; min: number; max: number
  onChange: (v: number) => void; unit?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: '#6666aa', width: 44, flexShrink: 0 }}>{label}</span>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: '#6366f1', cursor: 'pointer' }} />
      <span style={{ fontSize: 12, color: '#8888bb', width: 42, textAlign: 'right', flexShrink: 0 }}>
        {value}{unit}
      </span>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function ChordPlayer({ progressions, defaultTempo = 120 }: {
  progressions: Progression[]
  defaultTempo?: number
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [style, setStyle] = useState<StyleType>('swing')
  const [tempo, setTempo] = useState(defaultTempo)
  const [chordVol, setChordVol] = useState(75)
  const [bassVol, setBassVol] = useState(55)
  const [activeIdx, setActiveIdx] = useState(-1)

  const ctxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRef = useRef<(() => void) | null>(null)
  const stateRef = useRef({
    chordIdx: 0, beatIdx: 0, nextTime: 0,
    allChords: [] as string[],
    style: 'swing' as StyleType,
    tempo: 120,
    chordVol: 75,
    bassVol: 55,
  })

  const allChords = progressions.flatMap(p => p.chords.filter(c => c.trim()))

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current.allChords = allChords
    stateRef.current.style = style
    stateRef.current.tempo = tempo
    stateRef.current.chordVol = chordVol
    stateRef.current.bassVol = bassVol
  })

  const stopPlayback = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    setIsPlaying(false)
    setActiveIdx(-1)
  }, [])

  // Assign scheduleRef after defining the function to avoid circular reference
  useEffect(() => {
    scheduleRef.current = function tick() {
      const s = stateRef.current
      const ctx = ctxRef.current
      if (!ctx || !s.allChords.length) return

      const secPerBeat = 60 / s.tempo
      const LOOKAHEAD = 0.1

      while (s.nextTime < ctx.currentTime + LOOKAHEAD) {
        const chord = s.allChords[s.chordIdx]
        const beats = STYLE_BEATS[s.style]
        const beat = beats[s.beatIdx]
        const notes = getChordNotes(chord)
        const bass = getBassNote(chord)
        const noteDur = secPerBeat * 0.9

        playNotes(ctx, ctx.destination, notes, s.nextTime, noteDur, s.chordVol / 100)
        if (beat.bass) {
          playBass(ctx, ctx.destination, bass, s.nextTime, noteDur * 1.5, s.bassVol / 100)
        }

        const capturedIdx = s.chordIdx
        const delay = (s.nextTime - ctx.currentTime) * 1000
        setTimeout(() => setActiveIdx(capturedIdx), Math.max(0, delay))

        const prevBeat = beat
        s.beatIdx++
        if (s.beatIdx >= beats.length) {
          s.beatIdx = 0
          s.chordIdx = (s.chordIdx + 1) % s.allChords.length
        }
        const nextBeat = beats[s.beatIdx]

        if (s.beatIdx === 0) {
          s.nextTime += (4 - prevBeat.beat) * secPerBeat
        } else {
          s.nextTime += (nextBeat.beat - prevBeat.beat) * secPerBeat
        }
      }

      timerRef.current = setTimeout(() => scheduleRef.current?.(), 25)
    }
  })

  const startPlayback = useCallback(async () => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    const ctx = ctxRef.current
    if (ctx.state === 'suspended') await ctx.resume()

    stateRef.current.chordIdx = 0
    stateRef.current.beatIdx = 0
    stateRef.current.nextTime = ctx.currentTime + 0.1

    setIsPlaying(true)
    scheduleRef.current?.()
  }, [])

  useEffect(() => () => stopPlayback(), [stopPlayback])

  // Build display rows
  const rows: { chords: string[]; globalOffset: number; label: string }[] = []
  let offset = 0
  progressions.forEach(prog => {
    const valid = prog.chords.filter(c => c.trim())
    for (let i = 0; i < valid.length; i += 4) {
      rows.push({ chords: valid.slice(i, i + 4), globalOffset: offset + i, label: i === 0 ? prog.label : '' })
    }
    offset += valid.length
  })

  const activeSet = new Set(activeIdx >= 0 ? [activeIdx] : [])

  return (
    <div>
      {/* Staff */}
      <div style={{
        background: '#0a0a18', border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: 16, padding: '20px 16px 10px', marginBottom: 16,
        overflowX: 'auto',
      }}>
        {rows.map((row, ri) => (
          <div key={ri}>
            {row.label && (
              <div style={{
                fontSize: 11, fontWeight: 800, color: '#6366f1',
                marginBottom: 4, marginTop: ri > 0 ? 12 : 0,
                letterSpacing: '0.05em',
              }}>
                {row.label}
              </div>
            )}
            <StaffRow
              chords={row.chords}
              isFirstRow={ri === 0 || !!row.label}
              activeSet={activeSet}
              globalOffset={row.globalOffset}
              isLast={ri === rows.length - 1}
            />
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{
        background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16, padding: 16,
      }}>
        {/* Style selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {(Object.keys(STYLE_LABELS) as StyleType[]).map(s => (
            <button key={s} onClick={() => setStyle(s)}
              style={{
                flex: 1, padding: '7px 4px', borderRadius: 9,
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: style === s ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                color: style === s ? '#a5b4fc' : '#555570',
                border: style === s
                  ? '1px solid rgba(99,102,241,0.5)'
                  : '1px solid rgba(255,255,255,0.06)',
              }}>
              {STYLE_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Sliders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          <Slider label="템포" value={tempo} min={40} max={240} onChange={setTempo} unit=" BPM" />
          <Slider label="코드" value={chordVol} min={0} max={100} onChange={setChordVol} unit="%" />
          <Slider label="베이스" value={bassVol} min={0} max={100} onChange={setBassVol} unit="%" />
        </div>

        {/* Play/Stop */}
        <button
          onClick={isPlaying ? stopPlayback : startPlayback}
          style={{
            width: '100%', padding: '12px', borderRadius: 12,
            background: isPlaying ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
            color: isPlaying ? '#f87171' : '#fff',
            fontSize: 15, fontWeight: 800, cursor: 'pointer',
            border: isPlaying ? '1px solid rgba(239,68,68,0.3)' : 'none',
          }}>
          {isPlaying ? '■ 정지' : '▶ 반주 재생'}
        </button>
      </div>
    </div>
  )
}
