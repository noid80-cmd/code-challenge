// 전공. 영상마다 붙여서 보고 싶은 전공만 모아 볼 수 있게 한다.
//
// DB에는 영어 키로 저장한다 — 화면 문구를 바꿔도 데이터가 안 흔들린다.
export const MAJORS = ['drums', 'bass', 'guitar', 'piano', 'composition', 'vocal', 'other'] as const
export type Major = (typeof MAJORS)[number]

export const MAJOR_LABELS: Record<Major, string> = {
  drums: '드럼',
  bass: '베이스',
  guitar: '기타',
  piano: '피아노',
  composition: '작곡',
  vocal: '보컬',
  other: '그외 악기',
}

export function isMajor(v: unknown): v is Major {
  return typeof v === 'string' && (MAJORS as readonly string[]).includes(v)
}

export function majorLabel(v: unknown): string | null {
  return isMajor(v) ? MAJOR_LABELS[v] : null
}
