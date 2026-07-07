'use client'
import { useEffect, useId } from 'react'

type Pattern = { label: string; abc: string }

function splitBarsPerLine(abc: string, barsPerLine: number): string {
  const lines = abc.split('\n')
  const musicIdx = lines.findIndex(l => l.trim().startsWith('|'))
  if (musicIdx === -1) return abc

  const header = lines.slice(0, musicIdx)
  const music = lines[musicIdx].trim()

  // "|bar1|bar2|...|barN|]" → split by | → filter empty
  const parts = music.split('|').filter((_, i) => i > 0) // skip leading empty
  // last part is "]", bars are all but last
  const bars = parts.slice(0, -1)

  const musicLines: string[] = []
  for (let i = 0; i < bars.length; i += barsPerLine) {
    const chunk = bars.slice(i, i + barsPerLine)
    const isLast = i + barsPerLine >= bars.length
    musicLines.push('|' + chunk.join('|') + (isLast ? '|]' : '|'))
  }

  return [...header, ...musicLines].join('\n')
}

export default function RhythmViewer({ patterns }: { patterns: Pattern[] }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')

  useEffect(() => {
    import('abcjs').then(ABCJS => {
      patterns.forEach((p, i) => {
        const el = document.getElementById(`rv-${uid}-${i}`)
        if (!el) return
        const staffwidth = Math.max(window.innerWidth - 72, 280)
        const abc4 = splitBarsPerLine(p.abc, 4)
        ABCJS.renderAbc(`rv-${uid}-${i}`, abc4, {
          staffwidth,
          scale: 1.1,
          foregroundColor: '#f0ece0',
          selectionColor: 'none',
          paddingtop: 8,
          paddingbottom: 8,
          paddingright: 10,
          paddingleft: 10,
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
