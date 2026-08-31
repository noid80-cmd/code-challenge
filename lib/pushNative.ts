'use client'

import { isNativeApp } from './capacitor'

// 스토어에서 받은 앱(웹뷰)에는 웹 푸시(PushManager)가 아예 없다. 그래서 앱에서는
// 알림을 켤 방법 자체가 없었다. 앱에서는 FCM 토큰을 받아 서버에 저장하고,
// 크론이 그 토큰으로 직접 보낸다. 웹/PWA는 기존 웹 푸시를 그대로 쓴다.

type Messaging = typeof import('@capacitor-firebase/messaging')['FirebaseMessaging']

async function messaging(): Promise<Messaging | null> {
  if (!isNativeApp()) return null
  try {
    const mod = await import('@capacitor-firebase/messaging')
    return mod.FirebaseMessaging
  } catch {
    // 플러그인이 없는 빌드(구버전 앱)에서도 화면이 깨지지 않아야 한다
    return null
  }
}

async function saveToken(token: string) {
  const platform =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'ios' : 'android'
  await fetch('/api/device-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform }),
  })
}

/** 이미 허용된 상태인지 */
export async function nativeNotifState(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  const fm = await messaging()
  if (!fm) return 'unsupported'
  try {
    const { receive } = await fm.checkPermissions()
    return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'prompt'
  } catch {
    return 'unsupported'
  }
}

/** 권한을 요청하고 토큰을 서버에 등록한다. 성공하면 true */
export async function enableNativeNotifications(): Promise<boolean> {
  const fm = await messaging()
  if (!fm) return false
  try {
    const { receive } = await fm.requestPermissions()
    if (receive !== 'granted') return false
    const { token } = await fm.getToken()
    if (!token) return false
    await saveToken(token)
    return true
  } catch {
    return false
  }
}

/**
 * 앱을 열 때마다 호출한다.
 * FCM 토큰은 앱 재설치·데이터 삭제·주기적 갱신으로 바뀐다. 바뀐 걸 모르면
 * 알림이 조용히 끊기므로, 허용 상태면 매번 현재 토큰을 서버에 다시 올린다
 * (토큰 기준 upsert라 중복되지 않는다).
 */
export async function refreshNativeToken(): Promise<void> {
  const fm = await messaging()
  if (!fm) return
  try {
    const { receive } = await fm.checkPermissions()
    if (receive !== 'granted') return
    const { token } = await fm.getToken()
    if (token) await saveToken(token)
    fm.addListener('tokenReceived', ({ token: t }) => {
      if (t) saveToken(t).catch(() => {})
    })
  } catch {
    // 토큰 갱신 실패가 앱 사용을 막으면 안 된다
  }
}
