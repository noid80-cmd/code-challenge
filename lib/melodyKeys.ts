// 멜로디(계이름 시창) 조성.
//
// 마디 패턴 라이브러리는 전부 C장조로 적혀 있다. 조성을 바꾸겠다고 음이름을
// 직접 옮기면 임시표가 틀어진다 — 반음 패턴이 섞여 있어서 더 그렇다.
// 그래서 악보는 C장조 그대로 두고, 그릴 때 abcjs 에 반음 수만 넘긴다.
// 조표와 음이름 표기는 abcjs 가 알아서 맞춘다.
//
// 고급에서만 쓴다. 초급·중급은 계이름 읽기 자체가 목적이라 C장조가 맞다.
export type MelodyKey = { label: string; semitones: number }

export const ADVANCED_KEYS: MelodyKey[] = [
  { label: 'G장조', semitones: -5 },   // #1
  { label: 'F장조', semitones: 5 },    // b1
  { label: 'D장조', semitones: 2 },    // #2
  { label: 'B♭장조', semitones: -2 },  // b2
  { label: 'A장조', semitones: -3 },   // #3
  { label: 'E♭장조', semitones: 3 },   // b3
]

/** 어제와 같은 조성이 또 나오지 않게, 최근에 쓴 것은 빼고 고른다. */
export function pickAdvancedKey(recentLabels: string[] = []): MelodyKey {
  const pool = ADVANCED_KEYS.filter(k => !recentLabels.some(t => t.includes(k.label)))
  const from = pool.length > 0 ? pool : ADVANCED_KEYS
  return from[Math.floor(Math.random() * from.length)]
}
