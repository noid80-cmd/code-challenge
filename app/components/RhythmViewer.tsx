'use client'
import { useEffect, useId } from 'react'

type Pattern = { label: string; abc: string }

function splitBarsPerLine(abc: string, barsPerLine: number): string {
  // Normalize literal \n (JSON-encoded) to real newlines
  const text = abc.replace(/\\n/g, '\n')
  const lines = text.split('\n')

  const headerLines: string[] = []
  const allBars: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('|')) {
      // Collect bars from this music line; skip empty segments and closing ]
      trimmed.split('|').forEach(s => {
        const b = s.trim()
        if (b !== '' && b !== ']') allBars.push(b)
      })
    } else {
      headerLines.push(line)
    }
  }

  if (allBars.length === 0) return text

  const musicLines: string[] = []
  for (let i = 0; i < allBars.length; i += barsPerLine) {
    const chunk = allBars.slice(i, i + barsPerLine)
    const isLast = i + barsPerLine >= allBars.length
    musicLines.push('|' + chunk.join('|') + (isLast ? '|]' : '|'))
  }

  return [...headerLines, ...musicLines].join('\n')
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
