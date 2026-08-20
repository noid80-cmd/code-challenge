'use client'
import { cloneElement, isValidElement, useEffect, useState, type ReactElement, type ReactNode } from 'react'

const SIDE_PAD = 42

function RotateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="6" width="10" height="10" rx="2" stroke="#f0ece0" strokeWidth="1.6" />
      <path d="M15 8.5A6 6 0 1 0 16.5 13" stroke="#f0ece0" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M17.5 6.5L15 8.5L13.5 5.7" stroke="#f0ece0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

// 기기 실제 회전(OS 레벨)에 의존하지 않고, 버튼을 누르면 항상 CSS로 화면을
// 가로로 돌려서 보여준다. window.innerWidth/innerHeight를 픽셀 값으로 직접
// 재서 회전된 박스 크기를 정하기 때문에 vh/vw 단위가 변환된 좌표계 안에서
// 꼬이는 문제가 없다. 닫기 버튼은 회전 박스 밖(진짜 화면 좌표)에 둬서
// 노치/세이프에어리어와 무관하게 항상 눌린다.
export default function ZoomableNotation({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [vw, setVw] = useState(0)
  const [vh, setVh] = useState(0)

  // 모달이 열릴 때 window.innerWidth/Height를 곧바로 읽으면 아직 세이프
  // 에어리어/상태바 관련 레이아웃이 다 자리잡기 전 값을 잡아서, 같은
  // 챌린지를 다시 열어도 악보 너비가 매번 달라지는 문제가 있었음. rAF를
  // 두 번 걸쳐 측정을 늦춰서 레이아웃이 완전히 안정된 뒤 값을 읽는다.
  useEffect(() => {
    if (!open) return
    let raf1 = 0
    let raf2 = 0
    const measure = () => {
      const vv = window.visualViewport
      setVw(Math.round(vv?.width ?? window.innerWidth))
      setVh(Math.round(vv?.height ?? window.innerHeight))
    }
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(measure)
    })
    window.addEventListener('resize', measure)
    document.body.style.overflow = 'hidden'
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      window.removeEventListener('resize', measure)
      document.body.style.overflow = ''
    }
  }, [open])

  // RhythmViewer/MelodyPlayer가 자체 ResizeObserver로 너비를 재게 두면
  // transform:rotate 안에서 WebKit이 값을 들쭉날쭉 보고해 같은 악보도
  // 열 때마다 폭이 달라지는 문제가 있었다. vh(위에서 이미 안정적으로
  // 측정됨)에서 좌우 여백만 빼서 고정폭을 직접 넘겨 관찰 자체를 건너뛴다.
  const modalContentWidth = vh > 0 ? vh - SIDE_PAD * 2 : 0
  const zoomedChild = isValidElement(children)
    ? cloneElement(children as ReactElement<{ forcedWidth?: number }>, { forcedWidth: modalContentWidth })
    : children

  return (
    <div>
      {children}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
        <button
          onClick={() => setOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 20, cursor: 'pointer',
            background: 'rgba(240,236,224,0.06)',
            border: '1px solid rgba(240,236,224,0.18)',
            color: '#c8c4b8', fontSize: 12, fontWeight: 700,
          }}
        >
          <RotateIcon /> 가로로 확대
        </button>
      </div>

      {open && vw > 0 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#0a0a0a', overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              width: vh,
              height: vw,
              transform: 'translate(-50%, -50%) rotate(90deg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div style={{ width: '100%', padding: `0 ${SIDE_PAD}px`, boxSizing: 'border-box' }}>
              {zoomedChild}
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              top: 'calc(env(safe-area-inset-top) + 14px)',
              right: 14,
              width: 34, height: 34, borderRadius: '50%',
              background: 'rgba(240,236,224,0.14)',
              border: '1px solid rgba(240,236,224,0.3)',
              color: '#f0ece0', fontSize: 16, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1001, cursor: 'pointer',
            }}
          >✕</button>
        </div>
      )}
    </div>
  )
}
