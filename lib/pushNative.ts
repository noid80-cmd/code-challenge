'use client'

import { isNativeAppAsync } from './capacitor'

// 스토어에서 받은 앱(웹뷰)에는 웹 푸시(PushManager)가 아예 없다. 그래서 앱에서는
// 알림을 켤 방법 자체가 없었다. 앱에서는 FCM 토큰을 받아 서버에 저장하고,
// 크론이 그 토큰으로 직접 보낸다. 웹/PWA는 기존 웹 푸시를 그대로 쓴다.

type Messaging = typeof import('@capacitor-firebase/messaging')['FirebaseMessaging']

/**
 * 네이티브 다리는 대답을 안 할 수도 있다.
 *
 * Capacitor는 네이티브에 등록되지 않은 플러그인을 부르면 에러를 던지는 게
 * 아니라 프로미스를 영영 안 끝낸다. 그래서 푸시 플러그인이 없는 빌드에서
 * `checkPermissions()`를 부르면 await가 그대로 매달리고, 화면은 '확인 중'에서
 * 멈춘 채 알림을 켤 방법이 사라진다(실제로 겪음).
 *
 * 대답이 없으면 없는 대로 판단을 내리고 사용자에게 할 일을 알려줘야 한다.
 */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>(resolve => {
    let settled = false
    const finish = (v: T) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v) } }
    const timer = setTimeout(() => finish(fallback), ms)
    p.then(finish, () => finish(fallback))
  })
}

/**
 * 브릿지가 붙을 때까지 기다려서 판단한다.
 *
 * 동기 `isNativeApp()`은 페이지가 막 뜬 순간 `window.Capacitor`가 아직 안
 * 붙어 있으면 false를 준다. 그 false를 믿으면 앱 안에서 웹 경로로 빠지고,
 * iOS 웹뷰에는 PushManager가 없으니 "이 기기는 푸시 미지원"이라는 엉뚱한
 * 결론이 나온다(실제로 1.2를 깔고도 "앱을 업데이트하세요"가 떴다).
 */
async function loadMessaging(): Promise<Messaging | 'no-bridge' | 'no-plugin' | 'timeout'> {
  if (!(await isNativeAppAsync(10, 300))) return 'no-bridge'
  return withTimeout<Messaging | 'no-plugin' | 'timeout'>(
    import('@capacitor-firebase/messaging')
      .then(mod => mod.FirebaseMessaging as Messaging | 'no-plugin' | 'timeout')
      .catch(() => 'no-plugin' as const),
    6000,
    'timeout'
  )
}

/**
 * 서버에 토큰을 올린다. 성공 여부를 돌려주는 게 중요하다.
 *
 * 이 요청은 로그인을 요구한다. 로그아웃 상태로 알림을 허용하면 권한은 허용으로
 * 남는데 서버에는 토큰이 없는, 알림만 조용히 안 오는 상태가 된다.
 */
async function saveToken(token: string): Promise<boolean> {
  const platform =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'ios' : 'android'
  try {
    const res = await fetch('/api/device-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, platform }),
    })
    return res.ok
  } catch {
    return false
  }
}

// 왜 그렇게 판단했는지를 화면에 그대로 보여주려고 이유를 함께 돌려준다.
// 알림이 안 온다는 얘기가 나올 때마다 추측으로 좁혀 들어가느라 며칠을 썼다.
export type PushReason =
  | 'no-bridge' | 'no-plugin' | 'timeout'
  | 'denied' | 'prompt' | 'granted'
export type NativeProbe = {
  state: 'granted' | 'denied' | 'prompt' | 'unsupported'
  reason: PushReason
}

/** 앱의 알림 권한 상태와, 그렇게 판단한 이유 */
export async function probeNativePush(): Promise<NativeProbe> {
  const fm = await loadMessaging()
  if (typeof fm === 'string') return { state: 'unsupported', reason: fm }

  const receive = await withTimeout(
    fm.checkPermissions().then(r => r.receive as string),
    5000,
    'timeout'
  )
  if (receive === 'timeout') return { state: 'unsupported', reason: 'timeout' }
  if (receive === 'granted') return { state: 'granted', reason: 'granted' }
  if (receive === 'denied') return { state: 'denied', reason: 'denied' }
  return { state: 'prompt', reason: 'prompt' }
}

/** 권한을 요청하고 토큰을 서버에 등록한다. 성공하면 true */
export async function enableNativeNotifications(): Promise<boolean> {
  const fm = await loadMessaging()
  if (typeof fm === 'string') return false
  // 권한 창은 사용자가 읽고 누를 때까지 열려 있으므로 넉넉히 기다린다.
  const perm = await withTimeout(fm.requestPermissions(), 60000, null)
  if (perm?.receive !== 'granted') return false
  const got = await withTimeout(fm.getToken(), 15000, null)
  if (!got?.token) return false
  // 저장 성공 여부를 그대로 돌려줘야 한다. 예전에는 무조건 true를 돌려줘서
  // 로그아웃 상태로 켜면 서버에는 토큰이 없는데 화면은 '켜짐'이 됐다.
  return await saveToken(got.token)
}

/**
 * 앱을 열 때마다 호출한다.
 * FCM 토큰은 앱 재설치·데이터 삭제·주기적 갱신으로 바뀐다. 바뀐 걸 모르면
 * 알림이 조용히 끊기므로, 허용 상태면 매번 현재 토큰을 서버에 다시 올린다
 * (토큰 기준 upsert라 중복되지 않는다).
 */
export async function refreshNativeToken(): Promise<boolean> {
  const fm = await loadMessaging()
  if (typeof fm === 'string') return false
  // 토큰 갱신이 안 되는 것보다 화면이 멈추는 게 나쁘다. 안 되면 '꺼짐'으로 본다.
  const perm = await withTimeout(fm.checkPermissions(), 5000, null)
  if (perm?.receive !== 'granted') return false
  const got = await withTimeout(fm.getToken(), 15000, null)
  const ok = got?.token ? await saveToken(got.token) : false
  fm.addListener('tokenReceived', ({ token: t }) => {
    if (t) saveToken(t).catch(() => {})
  }).catch(() => {})
  return ok
}
