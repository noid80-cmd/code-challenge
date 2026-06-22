const ROOT_SEMITONES: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
}

const QUALITY_INTERVALS: Record<string, number[]> = {
  '': [0, 4, 7],
  'maj': [0, 4, 7],
  'm': [0, 3, 7],
  'min': [0, 3, 7],
  '7': [0, 4, 7, 10],
  'maj7': [0, 4, 7, 11],
  'M7': [0, 4, 7, 11],
  'm7': [0, 3, 7, 10],
  'min7': [0, 3, 7, 10],
  'dim': [0, 3, 6],
  'dim7': [0, 3, 6, 9],
  'aug': [0, 4, 8],
  'sus2': [0, 2, 7],
  'sus4': [0, 5, 7],
  '7sus4': [0, 5, 7, 10],
  'm7b5': [0, 3, 6, 10],
  '9': [0, 4, 7, 10, 14],
  'maj9': [0, 4, 7, 11, 14],
  'm9': [0, 3, 7, 10, 14],
  '6': [0, 4, 7, 9],
  'm6': [0, 3, 7, 9],
  'add9': [0, 4, 7, 14],
  '7b9': [0, 4, 7, 10, 13],
  '7#9': [0, 4, 7, 10, 15],
  '7#5': [0, 4, 8, 10],
  '7b5': [0, 4, 6, 10],
  'maj7#11': [0, 4, 7, 11, 18],
  '11': [0, 4, 7, 10, 14, 17],
  'm11': [0, 3, 7, 10, 14, 17],
  '13': [0, 4, 7, 10, 21],
  'm13': [0, 3, 7, 10, 21],
}

export function parseChord(name: string): { root: string; quality: string; bass?: string } {
  if (!name?.trim()) return { root: 'C', quality: '' }
  const cleaned = name.replace(/\s*\([^)]+\)\s*/g, '').trim()
  const slashMatch = cleaned.match(/^(.+)\/([A-G][#b]?)$/)
  const main = slashMatch ? slashMatch[1] : cleaned
  const bass = slashMatch ? slashMatch[2] : undefined
  const rootMatch = main.match(/^([A-G][#b]?)/)
  if (!rootMatch) return { root: 'C', quality: '', bass }
  return { root: rootMatch[1], quality: main.slice(rootMatch[1].length), bass }
}

function midiToNote(midi: number): string {
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}

// 기존 함수 유지
export function getChordNotes(name: string): string[] {
  const { root, quality } = parseChord(name)
  const rootSemi = ROOT_SEMITONES[root] ?? 0
  const intervals = QUALITY_INTERVALS[quality] ?? [0, 4, 7]
  const rootMidi = rootSemi + 60
  return intervals.slice(0, 4).map(i => {
    const midi = rootMidi + i
    return midiToNote(midi > 76 ? midi - 12 : midi)
  })
}

export function getBassNote(name: string): string {
  const { root, bass } = parseChord(name)
  const semi = bass ? (ROOT_SEMITONES[bass] ?? 0) : (ROOT_SEMITONES[root] ?? 0)
  return midiToNote(semi + 36)
}

// ── 재즈 보이싱 함수들 ─────────────────────────────────────────────────────────

// Guide tone: 3rd + 7th. 재즈 피아노 comp의 핵심 — block chord 절대 안 씀
export function getGuideTonesVoicing(name: string): string[] {
  const { root, quality } = parseChord(name)
  const rootSemi = ROOT_SEMITONES[root] ?? 0
  const ivs = QUALITY_INTERVALS[quality] ?? [0, 4, 7]

  if (ivs.length < 4) {
    // 3화음: 3rd + 5th
    let t = rootSemi + 60 + ivs[1]
    while (t < 60) t += 12; while (t > 72) t -= 12
    return [midiToNote(t), midiToNote(t + (ivs[2] - ivs[1]))]
  }

  // 7th chord: 3rd + 7th를 C4–C5 범위에 배치
  let third = rootSemi + 60 + ivs[1]
  while (third < 60) third += 12
  while (third > 72) third -= 12

  // 7th는 3rd 근처에 배치 (위아래 반옥타브 이내)
  let seventh = rootSemi + 60 + ivs[3]
  while (seventh < third - 6) seventh += 12
  while (seventh > third + 11) seventh -= 12

  return [third, seventh].sort((a, b) => a - b).map(midiToNote)
}

// 기타 보이싱: 기타 음역대(D2–E4)에 맞는 shell voicing
export function getGuitarVoicing(name: string): string[] {
  const { root, quality } = parseChord(name)
  const rootSemi = ROOT_SEMITONES[root] ?? 0
  const ivs = QUALITY_INTERVALS[quality] ?? [0, 4, 7]

  // 루트를 G2(43) 기준으로 배치하고 기타 음역대에 맞춤
  const base = rootSemi + 43

  return ivs.slice(0, 4).map(i => {
    let m = base + i
    while (m < 38) m += 12   // min D2
    while (m > 64) m -= 12   // max E4
    return midiToNote(m)
  })
}

// Walking bass: 스윙에서 4분음표 4개 (루트 → 5th → 3rd → 다음코드 반음 아래 어프로치)
export function getWalkingBassNotes(name: string, nextName: string): string[] {
  const { root, quality } = parseChord(name)
  const { root: nextRoot } = parseChord(nextName)
  const rootSemi = ROOT_SEMITONES[root] ?? 0
  const nextSemi = ROOT_SEMITONES[nextRoot] ?? 0
  const ivs = QUALITY_INTERVALS[quality] ?? [0, 4, 7]

  // C2(36)~B2(47) 범위에 루트 배치
  let r = rootSemi + 36
  while (r < 36) r += 12
  while (r >= 48) r -= 12

  const beat1 = r
  const beat2 = r + ivs[Math.min(2, ivs.length - 1)]  // 5th
  const beat3 = r + ivs[Math.min(1, ivs.length - 1)]  // 3rd

  // 다음 코드 루트를 현재 루트 근처에 배치
  let nextMidi = nextSemi + 36
  while (nextMidi < 36) nextMidi += 12
  while (nextMidi >= 50) nextMidi -= 12
  if (nextMidi > beat3 + 7) nextMidi -= 12
  if (nextMidi < beat3 - 7) nextMidi += 12

  const beat4 = nextMidi - 1  // 반음 아래에서 어프로치

  return [beat1, beat2, beat3, beat4].map(midiToNote)
}
