'use client'

import { useEffect, useState } from 'react'
import { MAJOR_LABELS, majorColor, type Major } from '@/lib/majors'
import { fetchMajor, saveMajor } from './majorClient'
import MajorPicker from './MajorPicker'

// 내 정보 화면의 전공 줄. 알림 설정과 같은 생김새로 둬서 "여기가 설정"임이
// 한눈에 읽히게 한다. 전공은 바뀔 수 있다 — 부전공을 시작하거나 전향하거나.
export default function MajorSettingRow({ userId }: { userId: string | null }) {
  const [major, setMajor] = useState<Major | ''>('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    fetchMajor(userId).then(m => { if (alive) setMajor(m) })
    return () => { alive = false }
  }, [userId])

  async function pick(m: Major) {
    setMajor(m)
    setSaving(true)
    await saveMajor(userId, m)
    setSaving(false)
    setOpen(false)
  }

  return (
    <div style={{
      background: 'linear-gradient(145deg, #111110, #0d0d0c)',
      border: '1px solid rgba(240,236,224,0.1)',
      borderRadius: 18, padding: '16px 18px', marginBottom: 28,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#f0ece0' }}>전공</span>
            {major && (
              <span style={{
                fontSize: 10.5, fontWeight: 800, padding: '2px 7px', borderRadius: 6,
                background: `${majorColor(major)}28`, color: majorColor(major),
              }}>{MAJOR_LABELS[major]}</span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: '#b0a493', lineHeight: 1.55 }}>
            {major ? '올리는 연주에 이 전공이 함께 붙어요' : '아직 고르지 않았어요'}
          </div>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          disabled={saving}
          style={{
            padding: '9px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
            color: '#0a0a08', fontSize: 12.5, fontWeight: 800,
            opacity: saving ? 0.6 : 1, flexShrink: 0, whiteSpace: 'nowrap',
          }}
        >
          {saving ? '저장 중...' : open ? '닫기' : major ? '바꾸기' : '고르기'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 14 }}>
          <MajorPicker value={major} onChange={pick} />
        </div>
      )}
    </div>
  )
}
