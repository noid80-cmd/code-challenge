'use client'

import { createClient } from '@/lib/supabase/client'
import { isMajor, type Major } from '@/lib/majors'

// 전공은 사람마다 하나다 — 난이도(profiles.level)와 같은 자리에 둔다.
// localStorage는 업로드 화면을 깜빡임 없이 채우기 위한 캐시일 뿐,
// 원본은 profiles.major다. 예전에는 캐시만 있어서 폰을 바꾸거나
// 저장소가 막히면 매번 다시 골라야 했다.
const LS_KEY = 'major'

export function cachedMajor(): Major | '' {
  if (typeof window === 'undefined') return ''
  try {
    const v = window.localStorage.getItem(LS_KEY)
    return isMajor(v) ? v : ''
  } catch {
    return ''
  }
}

function cache(major: Major) {
  try {
    window.localStorage.setItem(LS_KEY, major)
  } catch {
    // 시크릿 모드 등에서 막혀도 동작은 계속되어야 한다
  }
}

/** 로그인했으면 프로필에서, 아니면 캐시에서 전공을 읽는다 */
export async function fetchMajor(userId: string | null | undefined): Promise<Major | ''> {
  if (!userId) return cachedMajor()
  const { data } = await createClient().from('profiles').select('major').eq('id', userId).single()
  if (isMajor(data?.major)) {
    cache(data.major)
    return data.major
  }
  // 프로필이 비어 있으면 이 기기에 남은 것으로 채운다 — 예전에 고른 사람들.
  return cachedMajor()
}

export async function saveMajor(userId: string | null | undefined, major: Major): Promise<void> {
  cache(major)
  if (!userId) return
  await createClient().from('profiles').update({ major }).eq('id', userId)
}
