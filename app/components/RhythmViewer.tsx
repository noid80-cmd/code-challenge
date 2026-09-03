'use client'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

type Pattern = { label: string; abc: string }

// 6연음은 한 박에 16분음표 6개(빔 두 줄)로 적는 게 맞다. 옛 데이터는 8분음표
// 6개로 저장돼 있어 빔이 한 줄로 그려졌다. (6:4:6 = 16분음표 4개 길이에 6개.
// 아카이브에 남은 챌린지도 제대로 보이도록 그릴 때 바꿔 준다.
function normalizeSextuplets(abc: string): string {
  return abc.replace(/\(6((?:[Bz]){6})(?![0-9/])/g, (_, notes: string) =>
    '(6:4:6' + [...notes].map(n => n + '/').join('')
  )
}

// 잇단음표는 (p 또는 (p:q:r 로 적는다. q가 "몇 개 길이 안에 넣는지"다.
// 붓점(a>b)은 두 음의 길이 합이 그대로 유지되므로 한 덩어리로 센다.
function getNoteDur(tok: string): number {
  if (tok.includes('>') || tok.includes('<')) {
    return tok.split(/[<>]/).reduce((sum, part) => sum + getNoteDur(part), 0)
  }
  if (tok.startsWith('(')) {
    const m = tok.match(/^\((\d+)(?::(\d+))?(?::(\d+))?/)
    const n = m ? parseInt(m[1]) : 3
    const q = m && m[2] ? parseInt(m[2]) : (n === 3 ? 2 : n === 2 ? 3 : n === 5 ? 4 : 2)
    // Detect base note duration: (3BBB→1→2, (3B2B2B2→2→4, (6:4:6B/…→0.5→2
    const noteM = tok.match(/\((?:\d+:?){1,3}[Bz](\d*)(\/?)/)
    let baseDur = 1
    if (noteM) {
      if (noteM[1]) baseDur = parseInt(noteM[1])
      else if (noteM[2]) baseDur = 0.5
    }
    return q * baseDur
  }
  if (tok.includes('/')) return 0.5
  const m = tok.match(/(\d+)$/)
  return m ? parseInt(m[1]) : 1
}

// 잇단음표 · 붓점 쌍 · 낱음표 순서로 읽는다. 붓점 쌍을 한 토큰으로 잡아야
// 박 계산이 맞고, 두 음이 붙어 있으므로 abcjs가 알아서 빔으로 묶는다.
const NOTE_RE = /\(\d+(?::\d+){0,2}(?:[Bz][0-9]*\/?)+|[Bz][0-9]*\/?[<>][Bz][0-9]*\/?|[Bz][0-9]*\/?/g

function beamBar(bar: string): string {
  // 마디 끝 붙임줄(-)은 토큰 재조립 과정에서 유실되므로 떼어뒀다가 끝에 다시 붙인다
  const tieMatch = bar.match(/-\s*$/)
  if (tieMatch) return beamBar(bar.slice(0, tieMatch.index)) + '-'

  // 붓점이 하나라도 있으면 마디 전체를 건너뛰던 코드가 있었다. 그래서 붓점이
  // 낀 마디만 박 단위 빔이 적용되지 않아, 첫 박과 둘째 박이 한 빔으로 묶였다.
  // 붓점 쌍을 토큰으로 잡을 수 있게 됐으니 마디를 통째로 포기할 이유가 없다.
  const notes: Array<{ tok: string; dur: number; pos: number }> = []
  let cumPos = 0
  let m: RegExpExecArray | null
  NOTE_RE.lastIndex = 0
  while ((m = NOTE_RE.exec(bar)) !== null) {
    const dur = getNoteDur(m[0])
    notes.push({ tok: m[0], dur, pos: cumPos })
    cumPos += dur
  }
  if (notes.length === 0) return bar
  // 토큰을 도로 이어붙여 원본과 다르면 읽지 못한 표기가 있다는 뜻이다.
  // 재조립 과정에서 조용히 날아가느니 그 마디는 손대지 않는다.
  if (notes.map(n => n.tok).join('') !== bar.replace(/\s+/g, '')) return bar

  // 같은 박(beat) 안에서 8분음표 이하 길이의 음표가 연속되면 전부 하나의
  // 빔으로 묶는다 (쉼표를 만나면 끊음). 특정 조합만 하드코딩해서 놓치는
  // 케이스가 생기던 걸 박 단위 일반화로 대체.
  const out: string[] = []
  let i = 0
  while (i < notes.length) {
    const cur = notes[i]
    if (cur.tok.startsWith('(')) { out.push(cur.tok); i++; continue }
    const isRest = cur.tok.startsWith('z')
    if (!isRest && cur.dur <= 1) {
      const beatIdx = Math.floor(cur.pos / 2)
      let j = i
      const group: string[] = []
      while (
        j < notes.length &&
        !notes[j].tok.startsWith('(') &&
        !notes[j].tok.startsWith('z') &&
        notes[j].dur <= 1 &&
        Math.floor(notes[j].pos / 2) === beatIdx
      ) {
        group.push(notes[j].tok); j++
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

export default function RhythmViewer({
  patterns,
  activeTab: controlledTab,
  onTabChange,
  hideLabel = false,
  forcedWidth,
}: {
  patterns: Pattern[]
  activeTab?: number
  onTabChange?: (i: number) => void
  hideLabel?: boolean
  forcedWidth?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [internalTab, setInternalTab] = useState(0)
  const [measuredWidth, setMeasuredWidth] = useState(0)
  const containerWidth = forcedWidth ?? measuredWidth
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
      chunks: splitIntoChunks(normalizeSextuplets(p.abc), 2).map(c => fixBeaming(toPercFormat(c))),
    })),
    [patterns]
  )

  // 마운트 직후엔 폰트/레이아웃이 아직 자리잡기 전이라 clientWidth를 한
  // 번만 재면 너비가 틀어진 채로 굳어버려서(예: 기둥 하나가 잘리는 등)
  // 악보가 깨져 보이는 문제가 있었음. ResizeObserver로 실제 크기가
  // 안정된 이후 값을 계속 갱신해서 렌더 이펙트가 최신 너비로 다시 그리게 함.
  // 단, transform:rotate 안에서는 WebKit의 ResizeObserver가 값을 들쭉날쭉
  // 보고하는 경우가 있어서(가로 확대 모달에서 같은 악보가 열 때마다 다르게
  // 그려지던 원인) forcedWidth가 주어지면 관찰 자체를 하지 않고 그 값을 그대로 쓴다.
  useEffect(() => {
    if (forcedWidth != null) return
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (!w) return
      setMeasuredWidth(prev => (Math.abs(w - prev) > 1 ? w : prev))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [forcedWidth])

  useEffect(() => {
    if (!containerRef.current || containerWidth === 0) return
    const piList = hasMultiple ? [activeTab] : processedChunks.map((_, i) => i)

    import('abcjs').then(ABCJS => {
      piList.forEach(pi => {
        processedChunks[pi]?.chunks.forEach((abc, ci) => {
          const el = document.getElementById(`rv-${uid}-${pi}-${ci}`)
          if (!el) return
          ABCJS.renderAbc(`rv-${uid}-${pi}-${ci}`, abc, {
            staffwidth: containerWidth - 4,
            // format.stretchlast=1 forces every row (the only/last line of each chunk) to fill staffwidth
            format: { stretchlast: 1 },
            scale: 0.8,
            foregroundColor: '#f0ece0',
            selectionColor: 'none',
            paddingtop: ci === 0 ? 4 : 20,
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
  }, [processedChunks, uid, activeTab, hasMultiple, containerWidth])

  return (
    <div ref={containerRef}>
      {hasMultiple && (
        <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
          {processedChunks.map((p, pi) => {
            const shortLabel = p.label.replace(/^패턴\s*\d+\s*[-–—]?\s*/i, '') || `패턴 ${pi + 1}`
            return (
              <button key={pi} onClick={() => handleTabChange(pi)} style={{
                flex: 1, padding: '5px 6px', borderRadius: 9, border: 'none', cursor: 'pointer',
                background: activeTab === pi ? 'rgba(240,236,224,0.15)' : 'rgba(240,236,224,0.04)',
                outline: activeTab === pi ? '1px solid rgba(240,236,224,0.3)' : '1px solid rgba(240,236,224,0.08)',
                color: activeTab === pi ? '#f0ece0' : '#605850',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.02em',
                transition: 'all 0.15s', textAlign: 'center',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
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
              <div style={{ fontSize: 11, fontWeight: 700, color: '#a0988c', marginBottom: 5, letterSpacing: '0.05em' }}>
                {pattern.label}
              </div>
            )}
            <div style={{ background: 'rgba(240,236,224,0.04)', borderRadius: 12 }}>
              {pattern.chunks.map((_, ci) => (
                <div key={ci} id={`rv-${uid}-${pi}-${ci}`} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
