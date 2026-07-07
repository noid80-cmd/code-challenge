'use client'
import { useEffect, useId } from 'react'

type Pattern = { label: string; abc: string }

export default function RhythmViewer({ patterns }: { patterns: Pattern[] }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')

  useEffect(() => {
    import('abcjs').then(ABCJS => {
      patterns.forEach((p, i) => {
        const el = document.getElementById(`rv-${uid}-${i}`)
        if (!el) return
        const staffwidth = Math.max(window.innerWidth - 80, 280)
        ABCJS.renderAbc(`rv-${uid}-${i}`, p.abc, {
          staffwidth,
          scale: 1.1,
          foregroundColor: '#f0ece0',
          selectionColor: 'none',
          paddingtop: 8,
          paddingbottom: 8,
          paddingright: 10,
          paddingleft: 10,
          wrap: { minSpacing: 1.2, maxSpacing: 2.5, preferredMeasuresPerLine: 4 },
        } as Parameters<typeof ABCJS.renderAbc>[2])
      })
    })
  }, [patterns, uid])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {patterns.map((p, i) => (
        <div key={i}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#a0988c', marginBottom: 8, letterSpacing: '0.05em' }}>
            {p.label}
          </div>
          <div style={{ background: 'rgba(240,236,224,0.04)', borderRadius: 12, padding: '8px 4px', overflow: 'hidden' }}>
            <div id={`rv-${uid}-${i}`} />
          </div>
        </div>
      ))}
    </div>
  )
}
