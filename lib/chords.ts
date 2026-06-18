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
