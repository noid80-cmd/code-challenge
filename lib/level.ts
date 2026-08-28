// 난이도는 유저가 프로필에 저장해두고(profiles.level) 언제든 바꿀 수 있다.
// 챌린지는 매일 난이도별로 하나씩 생성되고, 피드는 유저 난이도에 맞는 것만 보여준다.

export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const
export type Level = (typeof LEVELS)[number]

export const DEFAULT_LEVEL: Level = 'intermediate'

export function isLevel(v: unknown): v is Level {
  return typeof v === 'string' && (LEVELS as readonly string[]).includes(v)
}

export function toLevel(v: unknown): Level {
  return isLevel(v) ? v : DEFAULT_LEVEL
}

export const LEVEL_LABELS: Record<Level, string> = {
  beginner: '초급',
  intermediate: '중급',
  advanced: '고급',
}

export const LEVEL_COLORS: Record<Level, string> = {
  beginner: '#34d399',
  intermediate: '#818cf8',
  advanced: '#f87171',
}

// 온보딩/설정 화면에서 자기 수준을 고를 때 쓰는 설명.
// 학생이 "내가 어디쯤인지"를 판단할 수 있게 결과가 아니라 상태로 적는다.
export const LEVEL_HINTS: Record<Level, string> = {
  beginner: '악보를 아직 한 음씩 짚어가며 읽어요',
  intermediate: '기본 코드와 리듬은 읽지만 아직 막히는 데가 있어요',
  advanced: '텐션·전조·복잡한 리듬까지 바로 읽어요',
}

// 유저 난이도에 맞는 챌린지가 그날 없을 때 대신 보여줄 순서.
// (초급 리듬·멜로디처럼 아직 생성되지 않는 조합이 있어서 필요하다)
export const LEVEL_FALLBACK: Record<Level, Level[]> = {
  beginner: ['beginner', 'intermediate', 'advanced'],
  intermediate: ['intermediate', 'advanced', 'beginner'],
  advanced: ['advanced', 'intermediate', 'beginner'],
}
