'use client'
import { useEffect, useState, type ReactNode } from 'react'

// 코드/리듬/멜로디 악보를 감싸서 우측 상단에 돋보기 버튼을 붙인다. 누르면
// 전체화면 오버레이로 같은 컴포넌트를 다시 보여준다.
// 앱 전체가 layout.tsx의 viewport 설정(userScalable: false)으로 핀치줌이
// 막혀있어서, 이 오버레이가 열려있는 동안만 <meta name="viewport"> 태그를
// 직접 완화해 사용자가 손가락으로 원하는 만큼 확대/축소·이동할 수 있게 하고
// 닫으면 원래 설정으로 되돌린다.
export default function ZoomableNotation({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const meta = document.querySelector('meta[name="viewport"]')
    const original = meta?.getAttribute('content') ?? null
    meta?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes')
    return () => {
      if (original) meta?.setAttribute('content', original)
    }
  }, [open])

  return (
    <>
      <div style={{ position: 'relative' }}>
        {children}
        <button
          onClick={() => setOpen(true)}
          aria-label="확대해서 보기"
          style={{
            position: 'absolute', top: 8, right: 8, zIndex: 2,
            width: 30, height: 30, borderRadius: 9, border: 'none', cursor: 'pointer',
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
            <circle cx="8.5" cy="8.5" r="6.5" stroke="#f0ece0" strokeWidth="1.8" />
            <line x1="13.2" y1="13.2" x2="18" y2="18" stroke="#f0ece0" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="8.5" y1="5.5" x2="8.5" y2="11.5" stroke="#f0ece0" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="5.5" y1="8.5" x2="11.5" y2="8.5" stroke="#f0ece0" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(4,4,4,0.97)',
            overflow: 'auto', WebkitOverflowScrolling: 'touch',
            padding: '20px 16px 48px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', position: 'sticky', top: 0, marginBottom: 14 }}>
            <button
              onClick={() => setOpen(false)}
              style={{
                width: 36, height: 36, borderRadius: 11, border: 'none', cursor: 'pointer',
                background: 'rgba(255,255,255,0.12)', color: '#f0ece0', fontSize: 17, fontWeight: 800,
              }}
            >✕</button>
          </div>
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
