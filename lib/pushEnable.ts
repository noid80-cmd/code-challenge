'use client'

import { probeNativePush, enableNativeNotifications } from '@/lib/pushNative'

// 알림을 켜는 한 가지 길. 배너에도 있고 온보딩에도 있어서, 두 군데가
// 서로 다르게 구독하면 한쪽만 조용히 망가진다.

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

/** 브라우저(앱이 아닌 경우)에서 구독하고 서버에 등록한다 */
export async function subscribeWebPush(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * 앱이면 네이티브 권한을, 브라우저면 웹 푸시를 켠다.
 *
 * 아이폰은 한 번 거절하면 앱에서 다시 물을 수 없다 — 설정 앱으로 들어가야
 * 한다. 그래서 이 함수를 부르는 자리는 "왜 필요한지 방금 말한 직후"여야 한다.
 */
export async function enablePush(): Promise<boolean> {
  try {
    const probe = await probeNativePush().catch(() => ({ reason: 'no-bridge' as const }))
    if (probe.reason !== 'no-bridge') return await enableNativeNotifications()
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
    return await subscribeWebPush()
  } catch {
    return false
  }
}
