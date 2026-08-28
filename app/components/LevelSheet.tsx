'use client'

import LevelPicker from './LevelPicker'
import { LEVEL_LABELS, type Level } from '@/lib/level'

/** 현재 난이도를 보여주고 누르면 시트가 열리는 칩 */
export function LevelChip({ level, onClick, style }: { level: Level; onClick: () => void; style?: React.CSSProperties }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: 'rgba(240,236,224,0.05)', border: '1px solid rgba(240,236,224,0.14)',
        borderRadius: 999, padding: '5px 11px', cursor: 'pointer',
        color: '#c8c4b0', fontSize: 12, fontWeight: 800,
        ...style,
      }}
    >
      {LEVEL_LABELS[level]}
      <svg width="9" height="6" viewBox="0 0 9 6" fill="none">
        <path d="M1 1L4.5 4.5L8 1" stroke="#8a8478" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

export default function LevelSheet({
  open,
  value,
  onChange,
  onClose,
}: {
  open: boolean
  value: Level
  onChange: (level: Level) => void
  onClose: () => void
}) {
  if (!open) return null
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 41,
        background: '#111110', borderTop: '1px solid rgba(240,236,224,0.14)',
        borderRadius: '20px 20px 0 0',
        padding: '22px 20px calc(env(safe-area-inset-bottom) + 22px)',
      }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <h3 style={{ fontSize: 16, fontWeight: 900, color: '#f0ece0', margin: '0 0 4px' }}>난이도 선택</h3>
          <p style={{ fontSize: 12.5, color: '#8a8478', margin: '0 0 16px', lineHeight: 1.6 }}>
            고른 난이도의 챌린지만 보여드려요. 언제든 다시 바꿀 수 있어요.
          </p>
          <LevelPicker value={value} onChange={onChange} />
        </div>
      </div>
    </>
  )
}
