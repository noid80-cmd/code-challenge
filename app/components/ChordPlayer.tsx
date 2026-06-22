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

// ── Salamander Grand Piano (Web Audio API, Tone.js 없음) ─────────────────────

const SAL_BASE = 'https://tonejs.github.io/audio/salamander/'
// MIDI → Salamander 파일명 (C2~A5 범위, 가이드 톤 + 워킹 베이스 커버)
const SAL_SAMPLES: [number, string][] = [
  [36,'C2'],[39,'Ds2'],[42,'Fs2'],
  [45,'A2'],[48,'C3'],[51,'Ds3'],[54,'Fs3'],
  [57,'A3'],[60,'C4'],[63,'Ds4'],[66,'Fs4'],
  [69,'A4'],[72,'C5'],[75,'Ds5'],[78,'Fs5'],
  [81,'A5'],
]

function noteToMidi(note: string): number {
  const m = note.match(/^([A-G]#?)(\d+)$/)
  if (!m) return 60
  const s: Record<string, number> = { C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11 }
  return (parseInt(m[2]) + 1) * 12 + (s[m[1]] ?? 0)
}

class SalamanderPiano {
  private ctx: AudioContext
  private buffers = new Map<number, AudioBuffer>()
  private output: GainNode

  constructor(ctx: AudioContext) {
    this.ctx = ctx

    // 합성 임펄스 리버브
    const convolver = ctx.createConvolver()
    const len = Math.floor(ctx.sampleRate * 1.8)
    const ir = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5)
    }
    convolver.buffer = ir

    const wet = ctx.createGain(); wet.gain.value = 0.18
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18; comp.ratio.value = 3

    this.output = ctx.createGain()
    this.output.connect(comp)
    comp.connect(ctx.destination)
    comp.connect(convolver)
    convolver.connect(wet)
    wet.connect(ctx.destination)
  }

  async load(onProgress: (n: number, total: number) => void) {
    const total = SAL_SAMPLES.length
    await Promise.all(SAL_SAMPLES.map(async ([midi, name]) => {
      try {
        const res = await fetch(`${SAL_BASE}${name}.mp3`)
        const ab = await res.arrayBuffer()
        this.buffers.set(midi, await this.ctx.decodeAudioData(ab))
      } catch { /* 네트워크 실패 시 스킵 */ }
      onProgress(this.buffers.size, total)
    }))
  }

  triggerAttackRelease(notes: string | string[], duration: number, time: number, velocity = 0.7) {
    const arr = Array.isArray(notes) ? notes : [notes]
    for (const note of arr) {
      const midi = noteToMidi(note)
      let bestMidi = -1, bestDist = Infinity
      for (const [m] of this.buffers) { const d = Math.abs(m - midi); if (d < bestDist) { bestDist = d; bestMidi = m } }
      const buf = this.buffers.get(bestMidi)
      if (!buf) continue

      const src = this.ctx.createBufferSource()
      src.buffer = buf
      src.playbackRate.value = Math.pow(2, (midi - bestMidi) / 12)

      const gn = this.ctx.createGain()
      gn.gain.setValueAtTime(velocity * 0.75, time)
      gn.gain.setTargetAtTime(0.001, time + duration, 0.35)
      src.connect(gn); gn.connect(this.output)
      src.start(time); src.stop(time + duration + 2.5)
    }
  }

  releaseAll() { /* 샘플 소스가 자동 종료됨 */ }
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
          for (const e of pat.keyboard) {
            const t = t0 + e.beat * secPerBeat
            pianoRef.current.triggerAttackRelease(voicing, e.dur * secPerBeat, t, e.vel * vel)
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
    if (!ctxRef.current)
      ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const ctx = ctxRef.current
    if (ctx.state === 'suspended') await ctx.resume()

    try {
      if (!pianoRef.current) {
        const piano = new SalamanderPiano(ctx)
        setLoadingText('피아노 로딩 중... 0%')
        await piano.load((n, total) => setLoadingText(`피아노 로딩 중... ${Math.round(n / total * 100)}%`))
        pianoRef.current = piano
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
