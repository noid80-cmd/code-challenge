'use client'

import { MAJORS, MAJOR_LABELS, MAJOR_COLORS, type Major } from '@/lib/majors'

// 전공 고르기. 난이도와 달리 설명이 필요 없어서 한 줄에 여러 개를 놓는다.
export default function MajorPicker({
  value,
  onChange,
}: {
  value: Major | ''
  onChange: (major: Major) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, width: '100%' }}>
      {MAJORS.map(m => {
        const active = m === value
        const color = MAJOR_COLORS[m]
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '13px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
              background: active ? 'rgba(240,236,224,0.08)' : 'rgba(240,236,224,0.03)',
              border: `1px solid ${active ? color : 'rgba(240,236,224,0.08)'}`,
              transition: 'all 0.15s',
            }}
          >
            <span style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${active ? color : 'rgba(240,236,224,0.25)'}`,
              background: active ? color : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {active && (
                <svg width="8" height="6" viewBox="0 0 9 7" fill="none">
                  <path d="M1 3.4L3.3 5.7L8 1" stroke="#0a0a08" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span style={{ fontSize: 14.5, fontWeight: 800, color: active ? '#f0ece0' : '#c8c4b0' }}>
              {MAJOR_LABELS[m]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
