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
  // K:perc causes abcjs to render slash/x noteheads — use K:C for standard ovals
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

  // %%stretchlast must be placed BEFORE the V: declaration so it lands in the
  // tune-level header context (abctune.formatting) that layout.js reads.
  // Placing it after V: puts it in the voice/body context which is ignored.
  const preVLines = headerLines.filter(l => {
    const t = l.trim()
    // Q: (tempo) removed to save vertical space; M: (time sig) kept for layout/stretch
    return !t.startsWith('V:') && !t.startsWith('Q:')
  })
  const vLine = headerLines.find(l => l.trim().startsWith('V:')) ?? ''
  const header = preVLines.join('\n') + '\n%%stretchlast 1\n' + vLine

  // Each chunk = separate tune so %%stretchlast applies to every line individually
  const chunks: string[] = []
  for (let i = 0; i < allBars.length; i += chunkSize) {
    const slice = allBars.slice(i, i + chunkSize)
    const isLast = i + chunkSize >= allBars.length
    // Only first chunk shows M: (time sig); subsequent chunks suppress it to avoid repetition
    const chunkHeader = i === 0 ? header : header.replace(/^M:[^\n]*\n?/m, '')
    chunks.push(chunkHeader + '\n' + '|' + slice.join('|') + (isLast ? '|]' : '|'))
  }
  return chunks
}

export default function RhythmViewer({ patterns }: { patterns: Pattern[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')

  const allChunks = useMemo(
    () => patterns.map(p =>
      splitIntoChunks(p.abc, 2)
        .map(c => fixBeaming(toPercFormat(c)))
    ),
    [patterns]
  )

  useEffect(() => {
    if (!containerRef.current) return
    const containerWidth = containerRef.current.clientWidth
    // abcjs adds ~20px internal margin on top of staffwidth.
    // Subtracting 40px gives 20px buffer so SVG never overflows the container.
    const staffwidth = Math.max(containerWidth - 50, 180)

    import('abcjs').then(ABCJS => {
      allChunks.forEach((chunks, i) => {
        chunks.forEach((chunkAbc, c) => {
          const el = document.getElementById(`rv-${uid}-${i}-${c}`)
          if (!el) return
          ABCJS.renderAbc(`rv-${uid}-${i}-${c}`, chunkAbc, {
            staffwidth,
            scale: 0.8,
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
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {allChunks.map((chunks, i) => (
        <div key={i}>
          {patterns[i].label && (
            <div style={{ fontSize: 12, fontWeight: 700, color: '#a0988c', marginBottom: 8, letterSpacing: '0.05em' }}>
              {patterns[i].label}
            </div>
          )}
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
