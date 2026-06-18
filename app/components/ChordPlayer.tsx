'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { getChordNotes, getBassNote } from '@/lib/chords'

type Progression = { label: string; chords: string[]; style?: string; tempo?: number }
type StyleType = 'straight' | 'swing' | 'bossa' | 'funk'

const STYLE_LABELS: Record<StyleType, string> = {
  straight: '스트레이트', swing: '스윙', bossa: '보사노바', funk: '펑크',
}

// Beat positions within a measure (quarter note = 1.0)
const STYLE_BEATS: Record<StyleType, Array<{ beat: number; vel: number }>> = {
  straight: [
    { beat: 0, vel: 0.8 }, { beat: 1, vel: 0.5 }, { beat: 2, vel: 0.65 }, { beat: 3, vel: 0.5 },
  ],
  swing: [
    { beat: 0, vel: 0.8 }, { beat: 0.75, vel: 0.35 }, { beat: 2, vel: 0.65 }, { beat: 2.75, vel: 0.35 },
  ],
  bossa: [
    { beat: 0, vel: 0.75 }, { beat: 0.75, vel: 0.3 }, { beat: 1.5, vel: 0.5 },
    { beat: 2, vel: 0.65 }, { beat: 2.75, vel: 0.3 }, { beat: 3.5, vel: 0.4 },
  ],
  funk: [
    { beat: 0, vel: 0.9 }, { beat: 0.25, vel: 0.3 }, { beat: 1.5, vel: 0.55 },
    { beat: 2, vel: 0.75 }, { beat: 2.25, vel: 0.3 }, { beat: 3, vel: 0.45 },
  ],
}

// ── Staff SVG display ────────────────────────────────────────────────────────

const LINE_GAP = 8
const STAFF_H = LINE_GAP * 4
const PAD_TOP = 32   // room for chord name above staff
const PAD_BOT = 14
const ROW_H = PAD_TOP + STAFF_H + PAD_BOT
const CLEF_W = 46
const MEASURE_W = 120

interface StaffRowProps {
  chords: string[]
  isFirstRow: boolean
  activeSet: Set<number>
  globalOffset: number
  isLast: boolean
}

function StaffRow({ chords, isFirstRow, activeSet, globalOffset, isLast }: StaffRowProps) {
  const filled = [...chords]
  while (filled.length < 4) filled.push('')
  const startX = isFirstRow ? CLEF_W : 16
  const totalW = startX + 4 * MEASURE_W + 16

  return (
    <svg width={totalW} height={ROW_H} style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}>
      {/* 5 staff lines */}
      {[0, 1, 2, 3, 4].map(i => (
        <line key={i}
          x1={isFirstRow ? 8 : 0} y1={PAD_TOP + i * LINE_GAP}
          x2={totalW - 8} y2={PAD_TOP + i * LINE_GAP}
          stroke="#3a3a5c" strokeWidth={0.8}
        />
      ))}

      {/* Treble clef (first row only) */}
      {isFirstRow && (
        <text x={10} y={PAD_TOP + STAFF_H + 4}
          fontSize={STAFF_H * 1.8} fill="#6060a0" fontFamily="'Georgia','Times New Roman',serif"
          style={{ userSelect: 'none' }}>
          𝄞
        </text>
      )}

      {/* Measures */}
      {filled.map((chord, col) => {
        const gIdx = globalOffset + col
        const active = activeSet.has(gIdx) && !!chord
        const x = startX + col * MEASURE_W

        return (
          <g key={col}>
            {/* Active highlight */}
            {active && (
              <rect x={x} y={PAD_TOP} width={MEASURE_W} height={STAFF_H}
                fill="rgba(99,102,241,0.12)" stroke="none" />
            )}

            {/* Bar line */}
            <line x1={x} y1={PAD_TOP} x2={x} y2={PAD_TOP + STAFF_H}
              stroke={active ? '#818cf8' : '#3a3a5c'} strokeWidth={active ? 1.5 : 0.9} />

            {/* Chord name */}
            {chord && (
              <text x={x + 8} y={PAD_TOP - 6}
                fontSize={11} fontWeight={active ? 900 : 700}
                fill={active ? '#c7d2fe' : '#8888bb'}
                fontFamily="'Courier New',monospace">
                {chord}
              </text>
            )}

            {/* Half rest: filled rect on top of 3rd line */}
            {chord && (
              <rect
                x={x + MEASURE_W / 2 - 11}
                y={PAD_TOP + LINE_GAP * 2 - 5}
                width={22} height={6} rx={1}
                fill={active ? '#818cf8' : '#444466'}
              />
            )}
          </g>
        )
      })}

      {/* Closing bar line */}
      <line
        x1={startX + 4 * MEASURE_W} y1={PAD_TOP}
        x2={startX + 4 * MEASURE_W} y2={PAD_TOP + STAFF_H}
        stroke="#3a3a5c" strokeWidth={isLast ? 2.5 : 0.9}
      />
      {/* Double bar for last row */}
      {isLast && (
        <line
          x1={startX + 4 * MEASURE_W - 4} y1={PAD_TOP}
          x2={startX + 4 * MEASURE_W - 4} y2={PAD_TOP + STAFF_H}
          stroke="#3a3a5c" strokeWidth={0.9}
        />
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
      <span style={{ fontSize: 12, color: '#8888bb', width: 38, textAlign: 'right', flexShrink: 0 }}>
        {value}{unit}
      </span>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

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

  const toneRef = useRef<typeof import('tone') | null>(null)
  const partRef = useRef<any>(null)
  const chordSynthRef = useRef<any>(null)
  const bassSynthRef = useRef<any>(null)
  const activeIdxRef = useRef(-1)

  const allChords = progressions.flatMap(p => p.chords.filter(c => c.trim()))

  const cleanup = useCallback(async () => {
    const T = toneRef.current
    if (!T) return
    try {
      if (partRef.current) { partRef.current.stop(0); partRef.current.dispose(); partRef.current = null }
      T.getTransport().stop()
      T.getTransport().cancel()
    } catch { /* ignore */ }
    setIsPlaying(false)
    setActiveIdx(-1)
    activeIdxRef.current = -1
  }, [])

  const play = useCallback(async () => {
    if (!toneRef.current) toneRef.current = await import('tone')
    const T = toneRef.current
    await T.start()
    await cleanup()

    // Dispose old synths
    try { chordSynthRef.current?.dispose() } catch { /* ignore */ }
    try { bassSynthRef.current?.dispose() } catch { /* ignore */ }

    const dbFromPct = (pct: number) => 20 * Math.log10(Math.max(pct, 1) / 100)

    const chordSynth = new T.PolySynth(T.Synth, {
      oscillator: { type: 'triangle4' },
      envelope: { attack: 0.02, decay: 0.4, sustain: 0.5, release: 1.5 },
    })
    const chordGain = new T.Volume(dbFromPct(chordVol))
    const chordRev = new T.Reverb({ decay: 1.2, wet: 0.25 })
    chordSynth.chain(chordRev, chordGain, T.getDestination())
    chordSynthRef.current = chordSynth

    const bassSynth = new T.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.6, release: 0.8 },
    })
    const bassGain = new T.Volume(dbFromPct(bassVol))
    bassSynth.connect(bassGain)
    bassGain.toDestination()
    bassSynthRef.current = bassSynth

    T.getTransport().bpm.value = tempo

    const beats = STYLE_BEATS[style]
    const events: any[] = []

    allChords.forEach((chord, ci) => {
      const notes = getChordNotes(chord)
      const bass = getBassNote(chord)
      beats.forEach(({ beat, vel }, bi) => {
        const total = ci * 4 + beat
        const bar = Math.floor(total / 4)
        const beatInBar = Math.floor(total % 4)
        const sixteenth = Math.round((total % 1) * 4)
        events.push({ time: `${bar}:${beatInBar}:${sixteenth}`, notes, bass, ci, bi, vel })
      })
    })

    const part = new T.Part((time: number, ev: any) => {
      chordSynth.triggerAttackRelease(ev.notes, '8n', time, ev.vel)
      if (ev.bi === 0) bassSynth.triggerAttackRelease(ev.bass, '4n', time, 0.85)
      T.getDraw().schedule(() => {
        if (activeIdxRef.current !== ev.ci) {
          activeIdxRef.current = ev.ci
          setActiveIdx(ev.ci)
        }
      }, time)
    }, events)

    part.loop = true
    part.loopEnd = `${allChords.length}:0:0`
    partRef.current = part

    T.getTransport().position = 0
    part.start(0)
    T.getTransport().start()
    setIsPlaying(true)
  }, [allChords, style, tempo, chordVol, bassVol, cleanup])

  // Live tempo update
  useEffect(() => {
    if (isPlaying && toneRef.current) {
      toneRef.current.getTransport().bpm.value = tempo
    }
  }, [tempo, isPlaying])

  useEffect(() => () => { cleanup() }, [cleanup])

  // Build per-progression row data
  const rows: { chords: string[]; globalOffset: number; label: string }[] = []
  let offset = 0
  progressions.forEach(prog => {
    const validChords = prog.chords.filter(c => c.trim())
    for (let i = 0; i < validChords.length; i += 4) {
      rows.push({ chords: validChords.slice(i, i + 4), globalOffset: offset + i, label: i === 0 ? prog.label : '' })
    }
    offset += validChords.length
  })

  const activeSet = new Set(activeIdx >= 0 ? [activeIdx] : [])

  return (
    <div>
      {/* Lead sheet staff display */}
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
              isFirstRow={ri === 0 || (ri > 0 && !!row.label)}
              activeSet={activeSet}
              globalOffset={row.globalOffset}
              isLast={ri === rows.length - 1}
            />
          </div>
        ))}
      </div>

      {/* Playback controls */}
      <div style={{
        background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16, padding: 16,
      }}>
        {/* Style selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {(Object.keys(STYLE_LABELS) as StyleType[]).map(s => (
            <button key={s} onClick={() => setStyle(s)}
              style={{
                flex: 1, padding: '7px 4px', borderRadius: 9, fontSize: 11, fontWeight: 700,
                cursor: 'pointer',
                background: style === s ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                color: style === s ? '#a5b4fc' : '#555570',
                border: style === s ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.06)',
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

        {/* Play / Stop */}
        <button
          onClick={isPlaying ? cleanup : play}
          style={{
            width: '100%', padding: '12px', borderRadius: 12,
            background: isPlaying
              ? 'rgba(239,68,68,0.15)'
              : 'linear-gradient(135deg, #4f46e5, #6366f1)',
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
