'use client'

import { useState } from 'react'
import { buildIRealUrl } from '@/lib/chords'

type Progression = { label: string; chords: string[]; style?: string; tempo?: number }

const STYLE_OPTIONS = [
  { group: '재즈',   value: 'slow-swing', label: '슬로우 스윙' },
  { group: '재즈',   value: 'swing',      label: '미디엄 스윙' },
  { group: '재즈',   value: 'fast-swing', label: '패스트 스윙' },
  { group: '재즈',   value: 'ballad',     label: '발라드' },
  { group: '재즈',   value: 'jazz-waltz', label: '재즈 왈츠' },
  { group: '라틴',   value: 'bossa',      label: '보사노바' },
  { group: '라틴',   value: 'samba',      label: '삼바' },
  { group: '라틴',   value: 'afro-cuban', label: '아프로 쿠반' },
  { group: '라틴',   value: 'mambo',      label: '맘보' },
  { group: '라틴',   value: 'cha-cha',    label: '차차' },
  { group: '라틴',   value: 'tango',      label: '탱고' },
  { group: '팝/록',  value: 'straight',   label: '스트레이트' },
  { group: '팝/록',  value: 'pop',        label: '팝' },
  { group: '팝/록',  value: 'rock',       label: '록' },
  { group: '팝/록',  value: 'funk',       label: '펑크' },
  { group: '팝/록',  value: 'shuffle',    label: '셔플' },
  { group: '팝/록',  value: 'rnb',        label: 'R&B' },
  { group: '팝/록',  value: 'reggae',     label: '레게' },
]
const STYLE_VALUES = STYLE_OPTIONS.map(o => o.value)

// ── Staff ─────────────────────────────────────────────────────────────────────

const LG = 9, STAFF_H = LG * 4, PAD_T = 28, PAD_B = 12
const ROW_H = PAD_T + STAFF_H + PAD_B, PAD_L = 10, MW = 72

function StaffRow({ chords, isLast }: { chords: string[]; isLast: boolean }) {
  const filled = [...chords]; while (filled.length < 4) filled.push('')
  const W = PAD_L + 4 * MW + 12
  return (
    <svg width={W} height={ROW_H} style={{ display: 'block', overflow: 'visible' }}>
      {[0,1,2,3,4].map(i => (
        <line key={i} x1={0} y1={PAD_T + i * LG} x2={W - 4} y2={PAD_T + i * LG}
          stroke="#182400" strokeWidth={1} />
      ))}
      {filled.map((chord, col) => {
        const x = PAD_L + col * MW
        return (
          <g key={col}>
            <line x1={x} y1={PAD_T} x2={x} y2={PAD_T + STAFF_H} stroke="#182400" strokeWidth={1} />
            {chord && (
              <text x={x + 6} y={PAD_T - 7} fontSize={12} fontWeight={700}
                fill="#7acc00" fontFamily="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif">
                {chord}
              </text>
            )}
          </g>
        )
      })}
      <line x1={PAD_L + 4 * MW} y1={PAD_T} x2={PAD_L + 4 * MW} y2={PAD_T + STAFF_H}
        stroke="#182400" strokeWidth={isLast ? 3 : 1} />
      {isLast && (
        <line x1={PAD_L + 4 * MW - 5} y1={PAD_T} x2={PAD_L + 4 * MW - 5} y2={PAD_T + STAFF_H}
          stroke="#182400" strokeWidth={1} />
      )}
    </svg>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ChordPlayer({ progressions, title }: {
  progressions: Progression[]
  title: string
}) {
  const defaultStyle = progressions[0]?.style?.toLowerCase() ?? ''
  const [style, setStyle] = useState(
    STYLE_VALUES.includes(defaultStyle) ? defaultStyle : 'swing'
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ borderRadius: 12, paddingBottom: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {row.label && rows.length > 1 && (
              <div style={{
                display: 'inline-block',
                fontSize: 11, fontWeight: 700, color: '#7aaa18',
                background: 'rgba(170,255,0,0.08)',
                border: '1px solid rgba(170,255,0,0.15)',
                borderRadius: 6, padding: '2px 9px',
                marginBottom: 8, marginTop: ri > 0 ? 14 : 0,
              }}>
                {row.label}
              </div>
            )}
            <StaffRow chords={row.chords} isLast={ri === rows.length - 1} />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <select
            value={style}
            onChange={e => setStyle(e.target.value)}
            style={{
              width: '100%', height: '100%',
              background: 'rgba(8,12,0,0.8)', border: '1px solid rgba(170,255,0,0.15)',
              borderRadius: 10, padding: '10px 36px 10px 13px',
              fontSize: 13, fontWeight: 600, color: '#7aaa18',
              outline: 'none', cursor: 'pointer',
              appearance: 'none',
            }}
          >
            {['재즈', '라틴', '팝/록'].map(group => (
              <optgroup key={group} label={group}>
                {STYLE_OPTIONS.filter(o => o.group === group).map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <svg width="10" height="6" viewBox="0 0 10 6" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <path d="M1 1l4 4 4-4" stroke="#506010" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <a href={iRealUrl} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '10px 14px', borderRadius: 10, flexShrink: 0,
          background: 'rgba(8,12,0,0.8)', border: '1px solid rgba(170,255,0,0.15)',
          color: '#7aaa18', fontSize: 12, fontWeight: 700,
          textDecoration: 'none', whiteSpace: 'nowrap',
        }}>
          iReal Pro
        </a>
      </div>
    </div>
  )
}
