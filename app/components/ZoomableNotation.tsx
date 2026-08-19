'use client'
import { useEffect, useState, type ReactNode } from 'react'

function RotateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="6" width="10" height="10" rx="2" stroke="#f0ece0" strokeWidth="1.6" />
      <path d="M15 8.5A6 6 0 1 0 16.5 13" stroke="#f0ece0" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M17.5 6.5L15 8.5L13.5 5.7" stroke="#f0ece0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

// 코드/리듬/멜로디 악보를 감싸서 "가로로 보기" 버튼을 붙인다. 누르면 같은
// 컴포넌트를 화면 전체에 90도 회전시켜 다시 보여줘서, 세로로 든 폰에서도
// 훨씬 넓은 폭으로 볼 수 있게 한다. vh/vw 같은 CSS 단위는 회전 트랜스폼과
// 함께 쓰면 브라우저마다 계산이 어긋나는 경우가 있어, window.innerWidth/
// innerHeight 값을 읽어 픽셀 단위로 명시한다.
export default function ZoomableNotation({ children }: { children: ReactNode }) {
  const [landscape, setLandscape] = useState(false)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    if (!landscape) { setDims(null); return }
    setDims({ w: window.innerWidth, h: window.innerHeight })
  }, [landscape])

  return (
    <>
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            onClick={() => setLandscape(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
              background: 'rgba(240,236,224,0.1)', color: '#c8c4b8',
              fontSize: 11, fontWeight: 700,
            }}
          >
            <RotateIcon /> 가로로 보기
          </button>
        </div>
        {children}
      </div>

      {landscape && dims && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0,
            width: dims.h, height: dims.w,
            transformOrigin: 'top left',
            transform: `rotate(90deg) translateY(-${dims.w}px)`,
            background: '#040404', zIndex: 200,
            overflow: 'auto', WebkitOverflowScrolling: 'touch',
            padding: `calc(env(safe-area-inset-top) + 16px) 20px 20px calc(env(safe-area-inset-top) + 20px)`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button
              onClick={() => setLandscape(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'rgba(255,255,255,0.12)', color: '#f0ece0', fontSize: 12, fontWeight: 700,
              }}
            >
              ✕ 세로로 돌아가기
            </button>
          </div>
          <div>{children}</div>
        </div>
      )}
    </>
  )
}
