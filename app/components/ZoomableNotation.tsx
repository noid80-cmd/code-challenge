'use client'
import type { ReactNode } from 'react'

// 이 앱은 iOS에서 가로 회전을 지원하도록 설정되어 있어서(Info.plist), 폰을
// 옆으로 돌리면 OS가 실제로 레이아웃을 가로로 다시 그려준다. RhythmViewer/
// MelodyPlayer는 ResizeObserver로 실제 너비 변화를 그대로 따라가므로 별도
// 처리 없이 자동으로 더 크게 보인다. 예전엔 CSS로 억지로 90도 돌리는
// 방식을 썼는데, 실제로 폰을 돌리면 OS 회전과 겹쳐 이중으로 돌아가며
// 깨졌음 — 그래서 안내 문구만 남기고 커스텀 회전 로직은 제거했다.
export default function ZoomableNotation({ children }: { children: ReactNode }) {
  return (
    <div>
      {children}
      <p style={{ textAlign: 'center', color: '#403830', fontSize: 11, marginTop: 10 }}>
        📱 폰을 옆으로 돌리면 더 크게 볼 수 있어요
      </p>
    </div>
  )
}
