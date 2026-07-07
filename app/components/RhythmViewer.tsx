'use client'
import { useEffect, useId, useMemo } from 'react'

type Pattern = { label: string; abc: string }

function fixBeaming(abc: string): string {
  // Convert "B B" → "BB" (pair adjacent 8th notes into beamed groups)
  // (?<!B): don't re-beam already-beamed notes; (?![0-9/]): skip B2, B4, B/
  return abc.replace(/(?<!B)B(?![0-9/]) B(?![0-9/])/g, 'BB')
}

function splitIntoChunks(abc: string, chunkSize: number): string[] {
  const text = abc.replace(/\\n/g, '\n')
  const lines = text.split('\n')
  const headerLines: string[] = []
  const allBars: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('|')) {
      trimmed.split('|').forEach(s => {
        const b = s.trim()
        if (b !== '' && b !== ']') allBars.push(b)
      })
    } else {
      headerLines.push(line)
    }
  }

  if (allBars.length === 0) return [text]

  const header = headerLines.join('\n')
  const chunks: string[] = []
  for (let i = 0; i < allBars.length; i += chunkSize) {
    const slice = allBars.slice(i, i + chunkSize)
    chunks.push(header + '\n|' + slice.join('|') + '|]')
  }
  return chunks
}

export default function RhythmViewer({ patterns }: { patterns: Pattern[] }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')

  // Pre-compute 4-bar chunks per pattern (drives DOM structure + rendering)
  const allChunks = useMemo(
    () => patterns.map(p => splitIntoChunks(p.abc, 4).map(fixBeaming)),
    [patterns]
  )

  useEffect(() => {
    import('abcjs').then(ABCJS => {
      const staffwidth = Math.max(window.innerWidth - 72, 280)
      allChunks.forEach((chunks, i) => {
        chunks.forEach((chunkAbc, c) => {
          const el = document.getElementById(`rv-${uid}-${i}-${c}`)
          if (!el) return
          ABCJS.renderAbc(`rv-${uid}-${i}-${c}`, chunkAbc, {
            staffwidth,
            scale: 1.1,
            foregroundColor: '#f0ece0',
            selectionColor: 'none',
            paddingtop: c === 0 ? 8 : 2,
            paddingbottom: c === chunks.length - 1 ? 8 : 2,
            paddingright: 10,
            paddingleft: 10,
          } as Parameters<typeof ABCJS.renderAbc>[2])
        })
      })
    })
  }, [allChunks, uid])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {allChunks.map((chunks, i) => (
        <div key={i}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#a0988c', marginBottom: 8, letterSpacing: '0.05em' }}>
            {patterns[i].label}
          </div>
          <div style={{ background: 'rgba(240,236,224,0.04)', borderRadius: 12, overflow: 'hidden' }}>
            {chunks.map((_, c) => (
              <div key={c} id={`rv-${uid}-${i}-${c}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
