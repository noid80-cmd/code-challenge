'use client'
import { useEffect, useState, type ReactNode } from 'react'

// 앱 전체가 layout.tsx의 viewport 설정(userScalable: false)으로 핀치줌이
// 막혀있음. iOS Safari/WKWebView는 <meta name="viewport">의 content 속성만
// 바꾸면 이미 적용된 초기 스케일 제약을 그대로 유지해버리는 경우가 있어서,
// 태그를 아예 제거했다가 새로 만들어 다시 삽입해야 확실히 재평가된다.
function useViewportZoomUnlock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const existing = document.querySelector('meta[name="viewport"]')
    const original = existing?.getAttribute('content') ?? null
    existing?.remove()
    const unlocked = document.createElement('meta')
    unlocked.name = 'viewport'
    unlocked.content = 'width=device-width, initial-scale=1, maximum-scale=6, user-scalable=yes'
    document.head.appendChild(unlocked)
    return () => {
      unlocked.remove()
      if (original) {
        const restored = document.createElement('meta')
        restored.name = 'viewport'
        restored.content = original
        document.head.appendChild(restored)
      }
    }
  }, [active])
}

function ZoomIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
      <circle cx="8.5" cy="8.5" r="6.5" stroke="#f0ece0" strokeWidth="1.8" />
      <line x1="13.2" y1="13.2" x2="18" y2="18" stroke="#f0ece0" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="8.5" y1="5.5" x2="8.5" y2="11.5" stroke="#f0ece0" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="5.5" y1="8.5" x2="11.5" y2="8.5" stroke="#f0ece0" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function RotateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="6" width="10" height="10" rx="2" stroke="#f0ece0" strokeWidth="1.6" />
      <path d="M15 8.5A6 6 0 1 0 16.5 13" stroke="#f0ece0" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M17.5 6.5L15 8.5L13.5 5.7" stroke="#f0ece0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

// 리듬/멜로디 컴포넌트는 자기 컨테이너 폭을 스스로 재서 다시 그리는 구조라,
// children을 확대 오버레이에 그대로 다시 배치하는 것만으로 재렌더링된다.
export default function ZoomableNotation({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [landscape, setLandscape] = useState(false)
  useViewportZoomUnlock(open)

  function close() {
    setOpen(false)
    setLandscape(false)
  }

  const controls = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 14 }}>
      <button onClick={(e) => { e.stopPropagation(); setLandscape(v => !v) }} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: landscape ? 'rgba(240,236,224,0.22)' : 'rgba(255,255,255,0.1)',
        color: '#f0ece0', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
      }}>
        <RotateIcon /> 가로로 보기
      </button>
      <button onClick={(e) => { e.stopPropagation(); close() }} style={{
        width: 36, height: 36, borderRadius: 11, border: 'none', cursor: 'pointer', flexShrink: 0,
        background: 'rgba(255,255,255,0.12)', color: '#f0ece0', fontSize: 17, fontWeight: 800,
      }}>✕</button>
    </div>
  )

  return (
    <>
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            onClick={() => setOpen(true)}
            aria-label="확대해서 보기"
            style={{
              width: 30, height: 30, borderRadius: 9, border: 'none', cursor: 'pointer',
              background: 'rgba(240,236,224,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ZoomIcon />
          </button>
        </div>
        {children}
      </div>

      {open && (
        <div
          onClick={close}
          style={landscape ? {
            position: 'fixed', top: 0, left: 0,
            width: '100vh', height: '100vw',
            transformOrigin: 'top left',
            transform: 'rotate(90deg) translateY(-100%)',
            background: 'rgba(4,4,4,0.98)', zIndex: 200,
            overflow: 'auto', WebkitOverflowScrolling: 'touch',
            padding: '20px 16px 48px',
          } : {
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(4,4,4,0.97)',
            overflow: 'auto', WebkitOverflowScrolling: 'touch',
            padding: '20px 16px 48px',
          }}
        >
          {controls}
          <div onClick={e => e.stopPropagation()}>
            {children}
          </div>
          <p style={{ textAlign: 'center', color: '#605850', fontSize: 12, marginTop: 16 }}>
            손가락으로 벌리고 오므려서 확대/축소하세요
          </p>
        </div>
      )}
    </>
  )
}
