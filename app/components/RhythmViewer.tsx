'use client'
import { useEffect, useId, useMemo, useRef } from 'react'

type Pattern = { label: string; abc: string }

function getNoteDur(tok: string): number {
  if (tok.startsWith('(')) {
    const m = tok.match(/^\((\d+)/)
    const n = m ? parseInt(m[1]) : 3
    return n === 3 ? 2 : n === 2 ? 3 : n === 5 ? 4 : 2
  }
  if (tok.includes('/')) return 0.5
  const m = tok.match(/(\d+)$/)
  return m ? parseInt(m[1]) : 1
}

function beamBar(bar: string): string {
  const noteRe = /\(\d+(?:[Bz][0-9]*\/?)+|[Bz][0-9]*\/?/g
  const notes: Array<{ tok: string; dur: number; pos: number }> = []
  let cumPos = 0
  let m: RegExpExecArray | null
  while ((m = noteRe.exec(bar)) !== null) {
    const dur = getNoteDur(m[0])
    notes.push({ tok: m[0], dur, pos: cumPos })
    cumPos += dur
  }
  if (notes.length === 0) return bar

  const out: string[] = []
  let i = 0
  while (i < notes.length) {
    const cur = notes[i]
    const next = notes[i + 1]
    if (cur.tok.startsWith('(')) { out.push(cur.tok); i++; continue }
    if (cur.tok === 'B' && cur.dur === 1 && cur.pos % 2 === 0 &&
        next?.tok === 'B' && next.dur === 1) {
      out.push('BB'); i += 2; continue
    }
    if (cur.tok === 'B/' && cur.dur === 0.5) {
      const beatEnd = (Math.floor(cur.pos / 2) + 1) * 2
      let j = i
      const group: string[] = []
      while (j < notes.length && notes[j].tok === 'B/' && notes[j].pos + 0.5 <= beatEnd) {
        group.push('B/'); j++
      }
      if (group.length >= 2) { out.push(group.join('')); i = j; continue }
    }
    out.push(cur.tok); i++
  }
  return out.join(' ')
}

function fixBeaming(abc: string): string {
  return abc.replace(/\|([^|[\]\n]*)/g, (_, bar) => '|' + beamBar(bar))
}

function toPercFormat(abc: string): string {
  return abc
    .replace(/^K:perc$/gim, 'K:C')
    .replace(/^(V:\d+[^\n]*)/gm, (m) => {
      let out = m
      if (out.includes('clef=perc')) out = out.replace('clef=perc', 'clef=none')
      if (!out.includes('clef=')) out += ' clef=none'
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

export default function RhythmViewer({ patterns }: { patterns: Pattern[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')

  // Split each pattern into 2-bar chunks so every row is a separate tune.
  // This guarantees stretchlast applies to every row (each chunk is its only line).
  const processedChunks = useMemo(
    () => patterns.map(p => ({
      label: p.label,
      chunks: splitIntoChunks(p.abc, 2).map(c => fixBeaming(toPercFormat(c))),
    })),
    [patterns]
  )

  useEffect(() => {
    if (!containerRef.current) return
    const containerWidth = containerRef.current.clientWidth

    import('abcjs').then(ABCJS => {
      processedChunks.forEach((pattern, pi) => {
        pattern.chunks.forEach((abc, ci) => {
          const el = document.getElementById(`rv-${uid}-${pi}-${ci}`)
          if (!el) return
          ABCJS.renderAbc(`rv-${uid}-${pi}-${ci}`, abc, {
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
  }, [processedChunks, uid])

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {processedChunks.map((pattern, pi) => (
        <div key={pi}>
          {pattern.label && (
            <div style={{ fontSize: 12, fontWeight: 700, color: '#a0988c', marginBottom: 8, letterSpacing: '0.05em' }}>
              {pattern.label}
            </div>
          )}
          <div style={{ background: 'rgba(240,236,224,0.04)', borderRadius: 12, overflow: 'hidden' }}>
            {pattern.chunks.map((_, ci) => (
              <div key={ci} id={`rv-${uid}-${pi}-${ci}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
