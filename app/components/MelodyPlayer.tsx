'use client'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

type Pattern = { label: string; abc: string }

// Shifts every written pitch down one octave and switches the clef to bass —
// for bass players reading the same solfège melody in a comfortable register.
// Only touches bar-content lines (starting with '|'); header lines (K:, M:, etc.)
// are left alone except the V: line's clef.
function toBassClef(abc: string): string {
  const text = abc.replace(/\\n/g, '\n')
  return text.split('\n').map(line => {
    const trimmed = line.trim()
    if (trimmed.startsWith('V:') && trimmed.includes('clef=treble')) {
      return line.replace('clef=treble', 'clef=bass')
    }
    if (trimmed.startsWith('|')) {
      return line.replace(/([\^_=]?)([A-Ga-g])([,']*)/g, (_m, acc: string, letter: string, marks: string) => {
        if (letter === letter.toUpperCase()) return acc + letter + marks + ','
        if (marks.includes("'")) return acc + letter + marks.replace("'", '')
        return acc + letter.toUpperCase() + marks
      })
    }
    return line
  }).join('\n')
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

  // %%stretchlast must be before V: so it lands in tune-level formatting context.
  // Q: (tempo) removed to save vertical space; M: (time sig) kept for layout/stretch.
  const preVLines = headerLines.filter(l => {
    const t = l.trim()
    return !t.startsWith('V:') && !t.startsWith('Q:')
  })
  const vLine = headerLines.find(l => l.trim().startsWith('V:')) ?? ''
  const header = preVLines.join('\n') + '\n%%stretchlast 1\n' + vLine

  const chunks: string[] = []
  for (let i = 0; i < allBars.length; i += chunkSize) {
    const slice = allBars.slice(i, i + chunkSize)
    const isLast = i + chunkSize >= allBars.length
    // Only first chunk shows M: (time sig) to avoid repeating it every 2 bars
    const chunkHeader = i === 0 ? header : header.replace(/^M:[^\n]*\n?/m, '')
    chunks.push(chunkHeader + '\n' + '|' + slice.join('|') + (isLast ? '|]' : '|'))
  }
  return chunks
}

export default function MelodyPlayer({
  patterns,
  activeTab: controlledTab,
  onTabChange,
  hideLabel = false,
}: {
  patterns: Pattern[]
  activeTab?: number
  onTabChange?: (i: number) => void
  hideLabel?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [internalTab, setInternalTab] = useState(0)
  const [bassClef, setBassClef] = useState(false)
  const activeTab = controlledTab ?? internalTab
  const hasMultiple = patterns.length > 1

  function handleTabChange(i: number) {
    setInternalTab(i)
    onTabChange?.(i)
  }

  // Split each pattern into 2-bar chunks so every row is a separate tune.
  // This guarantees stretchlast applies to every row (each chunk is its only line).
  const processedChunks = useMemo(
    () => patterns.map(p => ({
      label: p.label,
      chunks: splitIntoChunks(bassClef ? toBassClef(p.abc) : p.abc, 2),
    })),
    [patterns, bassClef]
  )

  useEffect(() => {
    if (!containerRef.current) return
    const containerWidth = containerRef.current.clientWidth - 4
    const piList = hasMultiple ? [activeTab] : processedChunks.map((_, i) => i)

    import('abcjs').then(ABCJS => {
      piList.forEach(pi => {
        processedChunks[pi]?.chunks.forEach((abc, ci) => {
          const el = document.getElementById(`mv-${uid}-${pi}-${ci}`)
          if (!el) return
          ABCJS.renderAbc(`mv-${uid}-${pi}-${ci}`, abc, {
            staffwidth: containerWidth,
            // format.stretchlast=1 forces every row (the only/last line of each chunk) to fill staffwidth
            format: { stretchlast: 1 },
            scale: 0.8,
            foregroundColor: '#f0ece0',
            selectionColor: 'none',
            paddingtop: ci === 0 ? 4 : 0,
            paddingbottom: 0,
            paddingright: 0,
            paddingleft: 0,
            minPadding: 0,
          } as Parameters<typeof ABCJS.renderAbc>[2])
          const svg = el.querySelector('svg')
          if (svg) {
            svg.removeAttribute('height')
            svg.style.width = '100%'
            svg.style.display = 'block'
            svg.style.overflow = 'visible'
          }
        })
      })
    })
  }, [processedChunks, uid, activeTab, hasMultiple])

  return (
    <div ref={containerRef}>
      {!hideLabel && (
        <button onClick={() => setBassClef(v => !v)} style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
          padding: '5px 10px', borderRadius: 20, cursor: 'pointer',
          background: bassClef ? 'rgba(240,236,224,0.15)' : 'rgba(240,236,224,0.04)',
          border: bassClef ? '1px solid rgba(240,236,224,0.3)' : '1px solid rgba(240,236,224,0.08)',
          color: bassClef ? '#f0ece0' : '#605850',
          fontSize: 11, fontWeight: 700,
        }}>
          <span style={{ fontSize: 13 }}>𝄢</span>
          베이스용 (낮은음자리표, 1옥타브 낮춤)
        </button>
      )}
      {hasMultiple && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {processedChunks.map((p, pi) => {
            const shortLabel = p.label.replace(/^프레이즈\s*\d+\s*[-–—]?\s*/i, '') || `프레이즈 ${pi + 1}`
            return (
              <button key={pi} onClick={() => handleTabChange(pi)} style={{
                flex: 1, padding: '7px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: activeTab === pi ? 'rgba(240,236,224,0.15)' : 'rgba(240,236,224,0.04)',
                outline: activeTab === pi ? '1px solid rgba(240,236,224,0.3)' : '1px solid rgba(240,236,224,0.08)',
                color: activeTab === pi ? '#f0ece0' : '#605850',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.03em',
                transition: 'all 0.15s', textAlign: 'center',
              }}>
                {shortLabel}
              </button>
            )
          })}
        </div>
      )}
      {(hasMultiple ? [processedChunks[activeTab]] : processedChunks).map((pattern, idx) => {
        const pi = hasMultiple ? activeTab : idx
        return (
          <div key={pi}>
            {!hasMultiple && !hideLabel && pattern.label && (
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a0988c', marginBottom: 8, letterSpacing: '0.05em' }}>
                {pattern.label}
              </div>
            )}
            <div style={{ background: 'rgba(240,236,224,0.04)', borderRadius: 12 }}>
              {pattern.chunks.map((_, ci) => (
                <div key={ci} id={`mv-${uid}-${pi}-${ci}`} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
