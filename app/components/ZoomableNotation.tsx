'use client'
import { useState, type ReactNode } from 'react'

function RotateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="6" width="10" height="10" rx="2" stroke="#f0ece0" strokeWidth="1.6" />
      <path d="M15 8.5A6 6 0 1 0 16.5 13" stroke="#f0ece0" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M17.5 6.5L15 8.5L13.5 5.7" stroke="#f0ece0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

// 이 앱은 iOS에서 가로 회전을 지원하도록 설정되어 있어서(Info.plist), 폰을
// 옆으로 돌리면 OS가 실제로 레이아웃을 가로로 다시 그려준다. RhythmViewer/
// MelodyPlayer는 ResizeObserver로 실제 너비 변화를 그대로 따라가므로 별도
// 처리 없이 자동으로 더 크게 보인다. 예전엔 CSS로 억지로 90도 돌리는
// 방식을 썼는데, 실제로 폰을 돌리면 OS 회전과 겹쳐 이중으로 돌아가며
// 깨졌음 — 그래서 실제로 화면을 돌리는 대신, 버튼을 누르면 안내 문구를
// 보여주는 정도로 단순화했다.
export default function ZoomableNotation({ children }: { children: ReactNode }) {
  const [hint, setHint] = useState(false)

  return (
    <div>
      {children}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
        <button
          onClick={() => setHint(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 20, cursor: 'pointer',
            background: hint ? 'rgba(240,236,224,0.12)' : 'rgba(240,236,224,0.06)',
            border: '1px solid rgba(240,236,224,0.18)',
            color: '#c8c4b8', fontSize: 12, fontWeight: 700,
          }}
        >
          <RotateIcon /> 가로로 확대
        </button>
      </div>
      {hint && (
        <p style={{ textAlign: 'center', color: '#a0988c', fontSize: 12, marginTop: 8 }}>
          📱 폰을 옆으로 돌리면 화면에 맞춰 크게 보여요
        </p>
      )}
    </div>
  )
}
