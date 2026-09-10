import type { SupabaseClient } from '@supabase/supabase-js'

// 썸네일은 avatars 버킷에 올린다(app/upload/page.tsx). 영상만 videos 버킷이다.
//
// thumbnail_url 은 행마다 전체 URL과 상대 경로가 섞여 있다. 상대 경로를
// videos 로 풀면 전부 400이 나는데, 그러면 <img> 가 조용히 실패해서
// 화면에는 그냥 검은 네모만 남는다 — 실제로 한 번 그렇게 됐다(2026-09-11).
// 푸는 곳이 다섯 군데라 규칙을 여기 한 곳에 둔다.
export function thumbUrl(
  supabase: SupabaseClient,
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined
  if (value.startsWith('http')) return value
  return supabase.storage.from('avatars').getPublicUrl(value).data.publicUrl
}
