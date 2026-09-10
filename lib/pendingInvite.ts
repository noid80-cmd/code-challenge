// 초대 링크로 들어온 사람은 로그인 → 회원가입 → 메일확인 → 온보딩까지
// 화면을 네 번 넘어간다. ?from= 을 그 전부에 실어 나르면 한 군데만 빠뜨려도
// 코드가 사라진다(실제로 회원가입 링크에서 끊겼다). 브라우저에 잠깐 저장해두면
// 어느 경로로 돌아오든 살아남는다.
const KEY = 'pendingInviteCode'
const TTL_MS = 60 * 60 * 1000   // 1시간. 옛 초대가 나중에 뜬금없이 실행되지 않게

export function savePendingInvite(code: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ code: code.toUpperCase(), at: Date.now() }))
  } catch { /* 사파리 프라이빗 등에서 저장이 막히면 그냥 포기한다 */ }
}

export function readPendingInvite(): string | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const { code, at } = JSON.parse(raw)
    if (!code || Date.now() - at > TTL_MS) { clearPendingInvite(); return null }
    return code as string
  } catch { return null }
}

export function clearPendingInvite() {
  try { localStorage.removeItem(KEY) } catch { /* noop */ }
}
