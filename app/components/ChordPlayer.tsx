'use client'

import { buildIRealUrl, normalizeMeasures } from '@/lib/chords'

type Progression = { label: string; chords: string[] | string[][]; style?: string; tempo?: number }

const STYLE_LABELS: Record<string, string> = {
  'slow-swing': '슬로우 스윙',   'swing': '미디엄 스윙',
  'fast-swing': '패스트 스윙',   'ballad': '발라드',
  'jazz-waltz': '재즈 왈츠',    'bossa': '보사노바',
  'samba': '삼바',               'afro-cuban': '아프로 쿠반',
  'mambo': '맘보',               'cha-cha': '차차',
  'tango': '탱고',               'straight': '스트레이트',
  'pop': '팝',                   'rock': '록',
  'funk': '펑크',                'shuffle': '셔플',
  'rnb': 'R&B',                  'reggae': '레게',
}

// ── Staff ─────────────────────────────────────────────────────────────────────

const LG = 9, STAFF_H = LG * 4, PAD_T = 28, PAD_B = 12
const ROW_H = PAD_T + STAFF_H + PAD_B, PAD_L = 10, MW = 92

function StaffRow({ measures, isLast }: { measures: string[][]; isLast: boolean }) {
  const filled = [...measures]
  while (filled.length < 4) filled.push([])

  const W = PAD_L + 4 * MW + 12
  return (
    <svg width={W} height={ROW_H} style={{ display: 'block', overflow: 'visible' }}>
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
            {chords.filter(c => c.trim()).map((chord, ci) => (
              <text key={ci}
                x={mx + ci * slotW + 5}
                y={PAD_T - 7}
                fontSize={12} fontWeight={700}
                fill="#c8c4b0"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif">
                {chord}
              </text>
            ))}
          </g>
        )
      })}

      <line x1={PAD_L + 4 * MW} y1={PAD_T} x2={PAD_L + 4 * MW} y2={PAD_T + STAFF_H}
        stroke="rgba(240,236,224,0.45)" strokeWidth={isLast ? 3 : 1.5} />
      {isLast && (
        <line x1={PAD_L + 4 * MW - 5} y1={PAD_T} x2={PAD_L + 4 * MW - 5} y2={PAD_T + STAFF_H}
          stroke="rgba(240,236,224,0.45)" strokeWidth={1.5} />
      )}
    </svg>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ChordPlayer({ progressions, title }: {
  progressions: Progression[]
  title: string
}) {
  // 어드민이 설정한 스타일·템포를 그대로 사용 (유저가 변경 불가)
  const style = progressions[0]?.style?.toLowerCase() || 'swing'
  const tempo = progressions[0]?.tempo

  const allMeasures = progressions.flatMap(p => normalizeMeasures(p.chords))
  const iRealUrl = buildIRealUrl(title, allMeasures, style)

  const rows: { measures: string[][]; label: string }[] = []
  progressions.forEach(prog => {
    const measures = normalizeMeasures(prog.chords)
    for (let i = 0; i < measures.length; i += 4) {
      rows.push({ measures: measures.slice(i, i + 4), label: i === 0 ? prog.label : '' })
    }
  })

  const styleLabel = STYLE_LABELS[style] ?? style
  const tempoLabel = tempo ? ` · ♩${tempo}` : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ borderRadius: 12, paddingBottom: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {row.label && progressions.length > 1 && (
              <div style={{
                display: 'inline-block',
                fontSize: 11, fontWeight: 700, color: '#a0988c',
                background: 'rgba(240,236,224,0.08)',
                border: '1px solid rgba(240,236,224,0.15)',
                borderRadius: 6, padding: '2px 9px',
                marginBottom: 8, marginTop: ri > 0 ? 14 : 0,
              }}>
                {row.label}
              </div>
            )}
            <StaffRow measures={row.measures} isLast={ri === rows.length - 1} />
          </div>
        ))}
      </div>

      {/* 리듬 정보 + iReal Pro */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          flex: 1, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(13,13,12,0.8)', border: '1px solid rgba(240,236,224,0.15)',
          fontSize: 13, fontWeight: 600, color: '#a0988c',
        }}>
          {styleLabel}{tempoLabel}
        </div>
        <a href={iRealUrl} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '10px 14px', borderRadius: 10, flexShrink: 0,
          background: 'rgba(13,13,12,0.8)', border: '1px solid rgba(240,236,224,0.15)',
          color: '#a0988c', fontSize: 12, fontWeight: 700,
          textDecoration: 'none', whiteSpace: 'nowrap',
        }}>
          iReal Pro →
        </a>
      </div>
    </div>
  )
}
