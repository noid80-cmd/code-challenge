'use client'

import { useState } from 'react'
import { buildIRealUrl } from '@/lib/chords'

type Progression = { label: string; chords: string[]; style?: string; tempo?: number }
type StyleType = 'straight' | 'swing' | 'bossa' | 'funk'

const STYLE_LABELS: Record<StyleType, string> = {
  straight: '스트레이트', swing: '스윙', bossa: '보사노바', funk: '펑크',
}

// ── Staff SVG ─────────────────────────────────────────────────────────────────

const LINE_GAP = 8, STAFF_H = LINE_GAP * 4, PAD_TOP = 32, PAD_BOT = 14
const ROW_H = PAD_TOP + STAFF_H + PAD_BOT, CLEF_W = 46, MEASURE_W = 120

function StaffRow({ chords, isFirstRow, isLast }: {
  chords: string[]; isFirstRow: boolean; isLast: boolean
}) {
  const filled = [...chords]; while (filled.length < 4) filled.push('')
  const startX = isFirstRow ? CLEF_W : 16
  const totalW = startX + 4 * MEASURE_W + 16
  return (
    <svg width={totalW} height={ROW_H} style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}>
      {[0,1,2,3,4].map(i => (
        <line key={i} x1={isFirstRow ? 8 : 0} y1={PAD_TOP + i * LINE_GAP} x2={totalW - 8} y2={PAD_TOP + i * LINE_GAP} stroke="#3a3a5c" strokeWidth={0.8} />
      ))}
      {isFirstRow && (
        <text x={10} y={PAD_TOP + STAFF_H + 4} fontSize={STAFF_H * 1.8} fill="#6060a0" fontFamily="'Georgia','Times New Roman',serif" style={{ userSelect: 'none' }}>𝄞</text>
      )}
      {filled.map((chord, col) => {
        const x = startX + col * MEASURE_W
        return (
          <g key={col}>
            <line x1={x} y1={PAD_TOP} x2={x} y2={PAD_TOP + STAFF_H} stroke="#3a3a5c" strokeWidth={0.9} />
            {chord && <text x={x + 8} y={PAD_TOP - 6} fontSize={11} fontWeight={700} fill="#8888bb" fontFamily="'Courier New',monospace">{chord}</text>}
            {chord && <rect x={x + MEASURE_W / 2 - 11} y={PAD_TOP + LINE_GAP * 2 - 5} width={22} height={6} rx={1} fill="#444466" />}
          </g>
        )
      })}
      <line x1={startX + 4 * MEASURE_W} y1={PAD_TOP} x2={startX + 4 * MEASURE_W} y2={PAD_TOP + STAFF_H} stroke="#3a3a5c" strokeWidth={isLast ? 2.5 : 0.9} />
      {isLast && <line x1={startX + 4 * MEASURE_W - 4} y1={PAD_TOP} x2={startX + 4 * MEASURE_W - 4} y2={PAD_TOP + STAFF_H} stroke="#3a3a5c" strokeWidth={0.9} />}
    </svg>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ChordPlayer({ progressions, title }: {
  progressions: Progression[]
  title: string
}) {
  const defaultStyle = progressions[0]?.style?.toLowerCase() as StyleType
  const [style, setStyle] = useState<StyleType>(
    Object.keys(STYLE_LABELS).includes(defaultStyle) ? defaultStyle : 'swing'
  )

  const allChords = progressions.flatMap(p => p.chords.filter(c => c.trim()))
  const iRealUrl = buildIRealUrl(title, allChords, style)

  const rows: { chords: string[]; label: string }[] = []
  progressions.forEach(prog => {
    const valid = prog.chords.filter(c => c.trim())
    for (let i = 0; i < valid.length; i += 4)
      rows.push({ chords: valid.slice(i, i + 4), label: i === 0 ? prog.label : '' })
  })

  return (
    <div>
      {/* Staff */}
      <div style={{ background: '#0a0a18', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: '20px 16px 10px', marginBottom: 14, overflowX: 'auto' }}>
        {rows.map((row, ri) => (
          <div key={ri}>
            {row.label && (
              <div style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', marginBottom: 4, marginTop: ri > 0 ? 12 : 0, letterSpacing: '0.05em' }}>
                {row.label}
              </div>
            )}
            <StaffRow chords={row.chords} isFirstRow={ri === 0 || !!row.label} isLast={ri === rows.length - 1} />
          </div>
        ))}
      </div>

      {/* Style + iReal Pro */}
      <div style={{ background: '#0c0c1a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 16 }}>
        <div style={{ display: 'flex', gap: 5, marginBottom: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 11, padding: 4 }}>
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

        <a href={iRealUrl} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          padding: '11px', borderRadius: 12,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.09)',
          color: '#888899', fontSize: 13, fontWeight: 700,
          textDecoration: 'none',
        }}>
          <span style={{ fontSize: 15 }}>🎷</span>
          iReal Pro로 열기
          <span style={{ fontSize: 11, color: '#555570', fontWeight: 500 }}>(앱 필요)</span>
        </a>
      </div>
    </div>
  )
}
