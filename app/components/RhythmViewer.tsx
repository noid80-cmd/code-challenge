'use client'
import { useEffect, useId, useMemo } from 'react'

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

function extractBars(abc: string): string[] {
  const text = abc.replace(/\\n/g, '\n')
  const bars: string[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('|')) {
      trimmed.split('|').forEach(s => {
        const b = s.trim()
        if (b && b !== ']') bars.push(b)
      })
    }
  }
  return bars
}

function extractHeader(abc: string): string {
  const text = abc.replace(/\\n/g, '\n')
  return text.split('\n')
    .filter(l => {
      const t = l.trim()
      return t.length > 0 && !t.startsWith('|') && !t.startsWith('V:')
    })
    .join('\n')
}

// Combines all patterns into one multi-voice ABC tune so abcjs renders them
// in a single SVG pass — barlines are synchronized across ALL staves.
function buildMultiVoiceABC(patterns: Pattern[], chunkSize: number): string {
  if (patterns.length === 0) return ''
  const allBars = patterns.map(p => extractBars(p.abc))
  const header = extractHeader(patterns[0].abc)
  const maxBars = Math.max(...allBars.map(b => b.length))

  // Declare each pattern as its own voice with a label ("A 패턴" / "B 패턴")
  const voiceDecls = patterns.map((p, i) =>
    `V:${i + 1} name="${p.label}" abbrev="" clef=none stafflines=1 stem=up`
  ).join('\n')

  // Interleave voice content: each group of chunkSize bars becomes one source
  // line per voice. abcjs treats consecutive [V:n] groups as one system so
  // barlines are computed together and remain aligned.
  const contentLines: string[] = []
  for (let start = 0; start < maxBars; start += chunkSize) {
    const isLast = start + chunkSize >= maxBars
    for (let i = 0; i < patterns.length; i++) {
      const bars = allBars[i].slice(start, start + chunkSize)
      if (bars.length === 0) continue
      contentLines.push(`[V:${i + 1}]|${bars.join('|')}${isLast ? '|]' : '|'}`)
    }
  }

  return header + '\n%%stretchlast\n' + voiceDecls + '\n' + contentLines.join('\n')
}

export default function RhythmViewer({ patterns }: { patterns: Pattern[] }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')

  const combinedAbc = useMemo(
    () => {
      if (patterns.length === 0) return ''
      return fixBeaming(buildMultiVoiceABC(patterns, 4))
    },
    [patterns]
  )

  useEffect(() => {
    if (!combinedAbc) return
    import('abcjs').then(ABCJS => {
      const el = document.getElementById(`rv-${uid}`)
      if (!el) return
      const containerWidth = el.parentElement?.clientWidth ?? 300
      // Reserve ~80 px on the left for the voice name labels
      const staffwidth = Math.max(containerWidth - 80, 160)
      ABCJS.renderAbc(`rv-${uid}`, combinedAbc, {
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
  }, [combinedAbc, uid])

  if (patterns.length === 0) return null

  return (
    <div style={{ background: 'rgba(240,236,224,0.04)', borderRadius: 12, overflow: 'hidden' }}>
      <div id={`rv-${uid}`} />
    </div>
  )
}
