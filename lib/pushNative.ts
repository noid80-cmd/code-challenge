'use client'

import { isNativeAppAsync } from './capacitor'

// 스토어에서 받은 앱(웹뷰)에는 웹 푸시(PushManager)가 아예 없다. 그래서 앱에서는
// 알림을 켤 방법 자체가 없었다. 앱에서는 FCM 토큰을 받아 서버에 저장하고,
// 크론이 그 토큰으로 직접 보낸다. 웹/PWA는 기존 웹 푸시를 그대로 쓴다.

// 네이티브 플러그인에 직접 붙는다.
//
// 예전에는 `@capacitor-firebase/messaging`을 통째로 동적 import 했는데, 그
// 패키지의 진입점이 웹 구현을 거쳐 `firebase/messaging`(웹 SDK)을 정적으로
// 끌고 온다. 앱에서는 쓰지도 않는 덩어리다. 실기기에서 그 청크가 6초 안에
// 안 내려와 플러그인 호출까지 가지도 못했다.
//
// 앱에서 필요한 건 네이티브 플러그인뿐이고, Capacitor는 그걸 붙이는 얇은
// 통로를 제공한다. 웹/PWA 푸시는 애초에 다른 경로(web-push)라 영향 없다.
type Messaging = {
  checkPermissions(): Promise<{ receive: string }>
  requestPermissions(): Promise<{ receive: string }>
  getToken(): Promise<{ token: string }>
  isSupported(): Promise<{ isSupported: boolean }>
  addListener(
    event: 'tokenReceived',
    cb: (e: { token: string }) => void
  ): Promise<{ remove: () => Promise<void> }>
}

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
    import('@capacitor/core')
      .then(mod => mod.registerPlugin<Messaging>('FirebaseMessaging') as Messaging | 'no-plugin' | 'timeout')
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
  | 'no-bridge' | 'no-plugin' | 'timeout' | 'error'
  | 'denied' | 'prompt' | 'granted'
// 앱 웹뷰가 옛 JS를 들고 있는지 한눈에 보려고 붙인다. 캐시된 화면인지
// 새 화면인지 구분이 안 돼 같은 진단을 두 번 돌린 적이 있다.
const PROBE_TAG = 'p3'

export type NativeProbe = {
  state: 'granted' | 'denied' | 'prompt' | 'unsupported'
  reason: PushReason
  /** 화면에 그대로 찍는 진단 문자열. 플랫폼·플러그인 등록 여부·에러 메시지. */
  detail?: string
}

// Capacitor는 네이티브 플러그인 등록 여부를 직접 알려준다. 이걸 안 보고
// 호출 결과만으로 원인을 좁히려다 며칠을 썼다.
function bridgeInfo(): string {
  const cap = (window as unknown as {
    Capacitor?: { getPlatform?: () => string; isPluginAvailable?: (n: string) => boolean }
  }).Capacitor
  if (!cap) return 'no-capacitor'
  const platform = cap.getPlatform?.() ?? '?'
  const available = cap.isPluginAvailable?.('FirebaseMessaging')
  return `${platform}·플러그인 ${available === undefined ? '?' : available ? '등록됨' : '미등록'}`
}

/** 앱의 알림 권한 상태와, 그렇게 판단한 이유 */
export async function probeNativePush(): Promise<NativeProbe> {
  const fm = await loadMessaging()
  if (fm === 'no-bridge') return { state: 'unsupported', reason: 'no-bridge', detail: PROBE_TAG }
  const info = bridgeInfo()
  if (typeof fm === 'string') return { state: 'unsupported', reason: fm, detail: `${PROBE_TAG}·${info}` }

  // 같은 플러그인의 isSupported()는 내부 객체(implementation) 없이 무조건
  // 응답한다. checkPermissions()는 `implementation?.` 옵셔널 체이닝이라
  // 그 객체가 nil이면 resolve도 reject도 하지 않고 그냥 매달린다.
  // 그래서 이 둘을 비교하면 "다리가 안 통하는 것"과 "플러그인 초기화(load)가
  // 안 끝난 것"이 갈린다. 맥 없이 웹 배포만으로 확인할 수 있는 유일한 갈림길이다.
  // async 즉시실행으로 감싼다. fm.isSupported 자체가 없으면 호출이 그 자리에서
  // 예외를 던지는데, 그러면 진단이 통째로 죽어 화면이 '확인 중'에 멈춘다.
  const supported = await withTimeout(
    (async () => {
      try { await fm.isSupported(); return 'ok' } catch (e) {
        return `err:${e instanceof Error ? e.message : String(e)}`
      }
    })(),
    4000,
    'no-answer'
  )
  const info2 = `${PROBE_TAG}·${info}·isSupported ${supported}`

  // 거부와 무응답을 갈라야 한다. 둘을 같은 값으로 뭉뚱그렸더니 "응답 없음"이
  // 사실은 "즉시 에러"인 경우를 구분할 수 없었다.
  type Outcome =
    | { k: 'ok'; receive: string }
    | { k: 'err'; msg: string }
    | { k: 'timeout' }
  const outcome = await withTimeout<Outcome>(
    fm.checkPermissions()
      .then(r => ({ k: 'ok' as const, receive: r.receive as string }))
      .catch((e: unknown) => ({ k: 'err' as const, msg: e instanceof Error ? e.message : String(e) })),
    5000,
    { k: 'timeout' }
  )

  if (outcome.k === 'timeout') return { state: 'unsupported', reason: 'timeout', detail: info2 }
  if (outcome.k === 'err') {
    return { state: 'unsupported', reason: 'error', detail: `${info2} · ${outcome.msg}`.slice(0, 160) }
  }
  const detail = info2
  if (outcome.receive === 'granted') return { state: 'granted', reason: 'granted', detail }
  if (outcome.receive === 'denied') return { state: 'denied', reason: 'denied', detail }
  return { state: 'prompt', reason: 'prompt', detail }
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
