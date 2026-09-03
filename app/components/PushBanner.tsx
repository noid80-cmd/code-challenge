'use client'

import { useCallback, useEffect, useState } from 'react'
import { probeNativePush, enableNativeNotifications, refreshNativeToken, type PushReason } from '@/lib/pushNative'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

/**
 * 알림 설정 줄.
 *
 * 매일 올라오는 챌린지를 알림으로 알리는 게 이 앱의 핵심이라, 꺼져 있으면
 * 그 사실이 화면 맨 위에서 바로 보여야 한다. 예전에는 스크롤을 내려야 나오는
 * 자리에 있었고, 켤 수 없는 상황(로그아웃·구버전 앱)에서는 아예 사라져서
 * 왜 안 되는지 알 방법이 없었다. 실제로 테스터 12명 전부 토큰이 없었다.
 *
 * 그래서 켜져 있을 때만 사라지고, 나머지 상황에서는 이유와 할 일을 보여준다.
 *
 * 이 컴포넌트는 앱 토큰을 서버에 등록하는 유일한 지점이기도 하다. 챌린지
 * 화면에만 두었더니 앱을 열고 홈만 보는 사람은 토큰이 영영 등록되지 않아
 * 알림 대상이 0명이었다. 그래서 홈에도 같이 둔다.
 */
type PushStatus = 'checking' | 'on' | 'off' | 'blocked' | 'needLogin' | 'outdated' | 'webOnly'

// 로그인 여부만 보면 되므로 Supabase User 전체를 요구하지 않는다.
// (호출하는 쪽이 id만 들고 있는 화면도 있다.)
type SignedIn = { id: string } | null | undefined

// user가 undefined면 아직 로그인 확인 중이다. 그 사이에 '로그인 필요'를 띄우면
// 로그인한 사람에게도 잠깐 깜빡인다.
function usePushStatus(user: SignedIn) {
  const [status, setStatus] = useState<PushStatus>('checking')
  const [reason, setReason] = useState<PushReason | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const check = useCallback(async () => {
    if (user === undefined) return
    const probe = await probeNativePush()
    setReason(probe.reason)
    setDetail(probe.detail ?? null)

    // 브릿지가 아예 없으면 진짜 브라우저다. 그때만 웹 푸시 경로로 간다.
    if (probe.reason !== 'no-bridge') {
      // 플러그인이 없거나 대답이 없는 빌드는 켤 방법이 없다. 앱을 업데이트하라고
      // 말해 주는 게 맞다.
      if (probe.state === 'unsupported') return setStatus('outdated')
      if (probe.state === 'denied') return setStatus('blocked')
      if (!user) return setStatus('needLogin')
      // 권한이 허용이어도 서버에 토큰이 없으면 알림은 안 온다. 권한이 아니라
      // 등록 성공 여부로 판단한다.
      if (probe.state === 'granted') return setStatus((await refreshNativeToken()) ? 'on' : 'off')
      return setStatus('off')
    }

    // 앱이 아닌데 브라우저가 푸시를 못 받는 경우다(예: iOS Safari). 이건
    // 업데이트할 앱이 없는 상황이라 '앱을 업데이트하세요'가 틀린 안내다.
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return setStatus('webOnly')
    if (Notification.permission === 'denied') return setStatus('blocked')
    if (!user) return setStatus('needLogin')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (!sub) return setStatus('off')
      // 브라우저에는 구독이 남아 있는데 서버 행만 사라진 경우를 스스로 복구한다.
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      }).catch(() => {})
      setStatus('on')
    } catch {
      setStatus('off')
    }
  }, [user])

  useEffect(() => { check() }, [check])

  async function enable() {
    setBusy(true)
    try {
      if (reason && reason !== 'no-bridge') {
        // 실패 이유를 구분해야 한다. 권한을 막은 것과 토큰 등록이 안 된 것은
        // 사용자가 할 일이 다르다. 둘 다 '차단'으로 뭉뚱그리면 안내가 틀린다.
        if (await enableNativeNotifications()) return setStatus('on')
        const probe = await probeNativePush()
        setReason(probe.reason)
        setDetail(probe.detail ?? null)
        if (probe.state === 'denied') return setStatus('blocked')
        if (probe.state === 'unsupported') return setStatus('outdated')
        return setStatus(user ? 'off' : 'needLogin')
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })
      setStatus('on')
    } catch {
      setStatus('blocked')
    } finally {
      setBusy(false)
    }
  }

  return { status, reason, detail, busy, enable }
}

// 앱을 업데이트하라고만 하면 어디서 하는지를 또 찾아야 한다. 스토어 이름을
// 직접 말해 준다.
function storeName(): string {
  if (typeof navigator === 'undefined') return '스토어'
  return /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) ? 'App Store' : 'Play 스토어'
}

function copyFor(status: Exclude<PushStatus, 'checking'>): { body: string; cta: string | null } {
  switch (status) {
    case 'on':
      return { body: '매일 새 챌린지가 올라오면 알려드립니다.', cta: null }
    case 'off':
      return { body: '알림을 켜지 않으면 매일 올라오는 챌린지를 모르고 지나갑니다.', cta: '알림 켜기' }
    case 'blocked':
      return { body: '기기 설정에서 알림이 꺼져 있습니다. 설정 > 초견챌린지 > 알림에서 켜 주세요.', cta: null }
    case 'needLogin':
      return { body: '로그인하면 매일 새 챌린지를 알림으로 받을 수 있습니다.', cta: '로그인' }
    case 'webOnly':
      return { body: '이 브라우저는 알림을 지원하지 않습니다. 앱에서 켜 주세요.', cta: null }
    case 'outdated':
      // 알림 기능은 iOS 1.2 / 안드로이드 versionCode 2부터 들어갔다. 그 이전
      // 빌드에는 알림을 켜는 방법 자체가 없다.
      return { body: `${storeName()}에서 초견챌린지를 업데이트해 주세요. 지금 깔린 버전에는 알림 기능이 없습니다.`, cta: null }
  }
}

export default function PushBanner({ user }: { user: SignedIn }) {
  const { status, busy, enable } = usePushStatus(user)

  // 켜져 있으면 조용히 사라진다. 이미 한 사람을 계속 붙잡지 않는다.
  if (status === 'checking' || status === 'on') return null

  const { body, cta } = copyFor(status)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
      background: 'linear-gradient(135deg, rgba(240,180,60,0.14), rgba(240,180,60,0.06))',
      border: '1px solid rgba(240,180,60,0.35)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 20,
      width: '100%', maxWidth: 640,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#f0ece0', marginBottom: 3 }}>
          매일 알림 받기
        </div>
        <div style={{ fontSize: 11.5, color: '#a0988c', lineHeight: 1.55 }}>{body}</div>
      </div>
      {cta && (
        <button
          onClick={status === 'needLogin' ? () => { window.location.href = '/login' } : enable}
          disabled={busy}
          style={{
            padding: '9px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
            color: '#0a0a08', fontSize: 12.5, fontWeight: 800,
            opacity: busy ? 0.6 : 1, flexShrink: 0, whiteSpace: 'nowrap',
          }}
        >
          {busy ? '설정 중...' : cta}
        </button>
      )}
    </div>
  )
}

/**
 * 마이페이지의 알림 설정 항목.
 *
 * 배너는 켜져 있으면 사라지고 조건이 맞아야만 나타난다. 그래서 배너가 안 뜨면
 * 알림을 켤 방법이 화면 어디에도 없었다("어디서 켜는 건지 모르겠다"). 설정은
 * 상태와 상관없이 늘 같은 자리에 있어야 찾을 수 있으므로, 이 항목은 켜져
 * 있을 때도 '켜짐'을 그대로 보여주고 사라지지 않는다.
 */
// 판정 근거를 화면에 그대로 남긴다. 알림이 안 온다는 얘기가 나올 때마다
// 화면에는 결론만 있고 근거가 없어 추측으로 좁혀 들어가느라 며칠을 썼다.
const REASON_LABEL: Record<PushReason, string> = {
  'no-bridge': '브라우저로 열림',
  'no-plugin': '앱 · 알림 모듈 없음',
  'timeout': '앱 · 알림 모듈 응답 없음',
  'error': '앱 · 알림 모듈 오류',
  'denied': '앱 · 권한 거부됨',
  'prompt': '앱 · 권한 요청 전',
  'granted': '앱 · 권한 허용됨',
}

export function PushSettingRow({ user }: { user: SignedIn }) {
  const { status, reason, detail, busy, enable } = usePushStatus(user)
  const on = status === 'on'
  const { body, cta } = status === 'checking'
    ? { body: '확인 중...', cta: null }
    : copyFor(status)

  return (
    <div style={{
      background: 'linear-gradient(145deg, #111110, #0d0d0c)',
      border: '1px solid rgba(240,236,224,0.1)',
      borderRadius: 18, padding: '16px 18px', marginBottom: 28,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#f0ece0' }}>매일 챌린지 알림</span>
          <span style={{
            fontSize: 10.5, fontWeight: 800, padding: '2px 7px', borderRadius: 6,
            background: on ? 'rgba(120,200,120,0.16)' : 'rgba(240,180,60,0.16)',
            color: on ? '#8fd08f' : '#e0b45c',
          }}>{status === 'checking' ? '확인 중' : on ? '켜짐' : '꺼짐'}</span>
        </div>
        <div style={{ fontSize: 11.5, color: '#807060', lineHeight: 1.55 }}>{body}</div>
        {reason && (
          <div style={{ fontSize: 10.5, color: '#403830', marginTop: 6, fontWeight: 700, lineHeight: 1.5, wordBreak: 'break-all' }}>
            {REASON_LABEL[reason]}{detail ? ` (${detail})` : ''}
          </div>
        )}
      </div>
      {cta && (
        <button
          onClick={status === 'needLogin' ? () => { window.location.href = '/login' } : enable}
          disabled={busy}
          style={{
            padding: '9px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
            color: '#0a0a08', fontSize: 12.5, fontWeight: 800,
            opacity: busy ? 0.6 : 1, flexShrink: 0, whiteSpace: 'nowrap',
          }}
        >
          {busy ? '설정 중...' : cta}
        </button>
      )}
    </div>
  )
}
