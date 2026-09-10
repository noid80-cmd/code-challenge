// 카톡·인스타 같은 앱 안의 브라우저(인앱 브라우저)에서는 구글이 OAuth를 막는다
// (disallowed_useragent). 초대 링크는 대부분 카톡으로 오기 때문에, 여기서
// 구글 로그인을 누르면 그대로 막혀 유입이 끊긴다. 감지해서 밖으로 안내한다.
const IN_APP_PATTERNS = [
  'KAKAOTALK', 'NAVER(', 'Instagram', 'FBAV', 'FBAN', 'FB_IAB',
  'Line/', 'DaumApps', 'everytimeApp', 'Snapchat',
]

export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return IN_APP_PATTERNS.some(p => ua.includes(p))
}

export function isAndroid(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
}

// 안드로이드는 intent 스킴으로 크롬을 직접 띄울 수 있다.
// iOS는 강제로 못 여니 사용자에게 "Safari로 열기"를 안내하는 수밖에 없다.
export function openInExternalBrowser() {
  const url = window.location.href
  if (isAndroid()) {
    const noScheme = url.replace(/^https?:\/\//, '')
    window.location.href =
      `intent://${noScheme}#Intent;scheme=https;package=com.android.chrome;end`
    return true
  }
  return false
}
