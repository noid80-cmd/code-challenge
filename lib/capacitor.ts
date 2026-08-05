const NATIVE_FLAG_KEY = 'cc-is-native-app'

// Kpick(kverse)에서 실기기로 확인한 것과 동일한 이슈: Capacitor의
// window.Capacitor.isNativePlatform()이 콜드 스타트 첫 페이지에서는 정확히
// "ios"로 나오는데, 로그인 후 리다이렉트처럼 하드 네비게이션을 한 번
// 거치면 그 다음 페이지부터는 "web"으로 잘못 보고하는 경우가 있음(Capacitor
// 자체 제약으로 보임). 최초에 한 번이라도 native로 정확히 감지되면 그
// 사실을 localStorage에 남겨서, 이후 페이지에서 잘못 "web"이라 해도 계속
// native로 취급한다(앱 종류가 세션 중간에 바뀔 리는 없으므로).
function rawIsNativePlatform(): boolean {
  if (typeof window === 'undefined') return false
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return !!cap?.isNativePlatform?.()
}

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  if (rawIsNativePlatform()) {
    try { localStorage.setItem(NATIVE_FLAG_KEY, '1') } catch { /* non-critical */ }
    return true
  }
  try { return localStorage.getItem(NATIVE_FLAG_KEY) === '1' } catch { return false }
}

// window.Capacitor 브릿지가 페이지 로드 타이밍에 따라 아직 안 붙어있는
// 순간이 있어 단발성 체크로는 신뢰할 수 없다. 짧게 재시도해서 판단한다.
export async function isNativeAppAsync(retries = 5, delayMs = 200): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    if (isNativeApp()) return true
    await new Promise(r => setTimeout(r, delayMs))
  }
  return false
}
