'use client'

import { LEVELS, LEVEL_LABELS, LEVEL_COLORS, LEVEL_HINTS, type Level } from '@/lib/level'

export default function LevelPicker({
  value,
  onChange,
  compact = false,
}: {
  value: Level
  onChange: (level: Level) => void
  compact?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 10, width: '100%' }}>
      {LEVELS.map(lv => {
        const active = lv === value
        const color = LEVEL_COLORS[lv]
        return (
          <button
            key={lv}
            type="button"
            onClick={() => onChange(lv)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              padding: compact ? '12px 14px' : '15px 16px',
              borderRadius: 14, cursor: 'pointer', textAlign: 'left',
              background: active ? 'rgba(240,236,224,0.08)' : 'rgba(240,236,224,0.03)',
              border: `1px solid ${active ? color : 'rgba(240,236,224,0.08)'}`,
              transition: 'all 0.15s',
            }}
          >
            <span
              style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${active ? color : 'rgba(240,236,224,0.25)'}`,
                background: active ? color : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {active && (
                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                  <path d="M1 3.4L3.3 5.7L8 1" stroke="#0a0a08" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: active ? '#f0ece0' : '#c8c4b0' }}>
                {LEVEL_LABELS[lv]}
              </span>
              {!compact && (
                <span style={{ display: 'block', fontSize: 12.5, color: '#8a8478', marginTop: 3, lineHeight: 1.5, wordBreak: 'keep-all' }}>
                  {LEVEL_HINTS[lv]}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
