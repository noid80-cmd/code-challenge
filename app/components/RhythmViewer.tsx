'use client'
import { useEffect, useId, useMemo } from 'react'

type Pattern = { label: string; abc: string }

function fixBeaming(abc: string): string {
  const unbeamed = abc.replace(/B(?![0-9/])(?=B(?![0-9/]))/g, 'B ')
  return unbeamed.replace(/(?<!B)B(?![0-9/]) B(?![0-9/])/g, 'BB')
}

function toPercFormat(abc: string): string {
  return abc.replace(/(V:\d+[^\n]*)/g, (m) => {
    let out = m
    if (!out.includes('stafflines')) out += ' stafflines=1'
    if (!out.includes('stem=')) out += ' stem=up'
    return out
  })
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

  const allChunks = useMemo(
    () => patterns.map(p =>
      splitIntoChunks(p.abc, 4)
        .map(c => fixBeaming(toPercFormat(c)))
    ),
    [patterns]
  )

  useEffect(() => {
    import('abcjs').then(ABCJS => {
      allChunks.forEach((chunks, i) => {
        chunks.forEach((chunkAbc, c) => {
          const el = document.getElementById(`rv-${uid}-${i}-${c}`)
          if (!el) return
          // Measure the actual rendered container width so the SVG doesn't overflow
          const containerWidth = el.parentElement?.clientWidth ?? 300
          const staffwidth = Math.max(containerWidth - 4, 200)
          ABCJS.renderAbc(`rv-${uid}-${i}-${c}`, chunkAbc, {
            staffwidth,
            scale: 0.7,
            foregroundColor: '#f0ece0',
            selectionColor: 'none',
            paddingtop: 4,
            paddingbottom: 4,
            paddingright: 0,
            paddingleft: 0,
            minPadding: 0,
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
