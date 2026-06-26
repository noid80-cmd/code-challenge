'use client'

import { normalizeMeasures } from '@/lib/chords'

type Progression = { label: string; chords: string[] | string[][]; style?: string; tempo?: number; key?: string }


// ── Staff ─────────────────────────────────────────────────────────────────────

const LG = 9, STAFF_H = LG * 4, PAD_T = 28, PAD_B = 12
const ROW_H = PAD_T + STAFF_H + PAD_B, PAD_L = 10, MW = 92

function StaffRow({ measures, isLast }: { measures: string[][]; isLast: boolean }) {
  const filled = [...measures]
  while (filled.length < 4) filled.push([])

  const W = PAD_L + 4 * MW + 12
  return (
    <svg viewBox={`0 0 ${W} ${ROW_H}`} width="100%" style={{ display: 'block' }}>
      {[0,1,2,3,4].map(i => (
        <line key={i} x1={0} y1={PAD_T + i * LG} x2={W - 4} y2={PAD_T + i * LG}
          stroke="rgba(240,236,224,0.12)" strokeWidth={1} />
      ))}

      {filled.map((chords, col) => {
        const mx = PAD_L + col * MW
        const n = chords.length || 1
        const slotW = MW / n
        return (
          <g key={col}>
            <line x1={mx} y1={PAD_T} x2={mx} y2={PAD_T + STAFF_H}
              stroke="rgba(240,236,224,0.45)" strokeWidth={1.5} />
            {chords.filter(c => c.trim()).map((chord, ci) => {
              const multi = chords.filter(c => c.trim()).length > 1
              const maxW = slotW - 4
              return (
                <text key={ci}
                  x={mx + ci * slotW + 2}
                  y={PAD_T - 7}
                  fontSize={12} fontWeight={700}
                  fill="#c8c4b0"
                  fontFamily="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif"
                  textLength={multi ? maxW : undefined}
                  lengthAdjust={multi ? 'spacingAndGlyphs' : undefined}>
                  {chord}
                </text>
              )
            })}
          </g>
        )
      })}

      <line x1={PAD_L + 4 * MW} y1={PAD_T} x2={PAD_L + 4 * MW} y2={PAD_T + STAFF_H}
        stroke="rgba(240,236,224,0.45)" strokeWidth={isLast ? 3.5 : 1.5} />
      {isLast && (
        <>
          <line x1={PAD_L + 4 * MW - 6} y1={PAD_T} x2={PAD_L + 4 * MW - 6} y2={PAD_T + STAFF_H}
            stroke="rgba(240,236,224,0.45)" strokeWidth={1.5} />
          <circle cx={PAD_L + 4 * MW - 13} cy={PAD_T + 1.5 * LG} r={2.5} fill="rgba(240,236,224,0.7)" />
          <circle cx={PAD_L + 4 * MW - 13} cy={PAD_T + 2.5 * LG} r={2.5} fill="rgba(240,236,224,0.7)" />
        </>
      )}
    </svg>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ChordPlayer({ progressions, title }: {
  progressions: Progression[]
  title: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {progressions.map((prog, pi) => {
        const measures = normalizeMeasures(prog.chords)

        // 이전 마디와 같은 코드면 빈 마디로 표시
        const eq = (a: string[], b: string[]) => a.length === b.length && a.every((c, i) => c === b[i])
        const displayMeasures = measures.map((m, i) =>
          i > 0 && eq(m, measures[i - 1]) ? [] as string[] : m
        )

        const rows: string[][][] = []
        for (let i = 0; i < displayMeasures.length; i += 4) rows.push(displayMeasures.slice(i, i + 4))

        return (
          <div key={pi}>
            {/* 진행 레이블 + 키 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {progressions.length > 1 && prog.label && (
                <div style={{
                  display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#a0988c',
                  background: 'rgba(240,236,224,0.08)', border: '1px solid rgba(240,236,224,0.15)',
                  borderRadius: 6, padding: '2px 9px',
                }}>
                  {prog.label}
                </div>
              )}
              {prog.key && (
                <div style={{
                  display: 'inline-block', fontSize: 11, fontWeight: 800, color: '#0a0a08',
                  background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                  borderRadius: 6, padding: '2px 9px',
                }}>
                  Key: {prog.key}
                </div>
              )}
            </div>

            {/* 악보 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8 }}>
              {rows.map((row, ri) => (
                <StaffRow key={ri} measures={row} isLast={ri === rows.length - 1} />
              ))}
            </div>

          </div>
        )
      })}
    </div>
  )
}
