'use client'

import { createClient } from '@/lib/supabase/client'
import { DEFAULT_LEVEL, toLevel, type Level } from '@/lib/level'

// 로그인 유저의 난이도는 profiles.level이 원본이다. localStorage는
// 첫 화면을 깜빡임 없이 그리기 위한 캐시이고, 비로그인 방문자에게는
// 유일한 저장소 역할을 한다.
const LS_KEY = 'challenge-level'

export function cachedLevel(): Level {
  if (typeof window === 'undefined') return DEFAULT_LEVEL
  try {
    return toLevel(window.localStorage.getItem(LS_KEY))
  } catch {
    return DEFAULT_LEVEL
  }
}

function cache(level: Level) {
  try {
    window.localStorage.setItem(LS_KEY, level)
  } catch {
    // 시크릿 모드 등에서 localStorage가 막혀도 동작은 계속되어야 한다
  }
}

/** 로그인했으면 프로필에서, 아니면 캐시에서 난이도를 읽는다 */
export async function fetchLevel(userId: string | null | undefined): Promise<Level> {
  if (!userId) return cachedLevel()
  const { data } = await createClient().from('profiles').select('level').eq('id', userId).single()
  const level = toLevel(data?.level)
  cache(level)
  return level
}

export async function saveLevel(userId: string | null | undefined, level: Level): Promise<void> {
  cache(level)
  if (!userId) return
  await createClient().from('profiles').update({ level }).eq('id', userId)
}
