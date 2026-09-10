'use client'

import { createClient } from './supabase/client'

// 가입 알림은 이메일 가입 폼에서만 부르고 있었다. 구글로 들어온 사람은
// 이 폼을 지나가지 않아서 알림이 한 건도 안 갔다 — 하루 84명이 가입한 날
// 텔레그램에는 서너 개만 떴다.
//
// 그래서 로그인이 끝나는 모든 자리에서 부른다. 중복은 서버가 막는다
// (profiles.signup_notified_at 이 비어 있을 때만 보낸다).
export async function maybeNotifySignup() {
  try {
    const { data } = await createClient().auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    // 같은 브라우저에서 로그인할 때마다 왕복하지 않도록 한 번만 시도한다.
    // 서버 판단이 진짜고 이건 요청을 아끼는 용도다.
    const seen = `signup_notified_${data.session?.user?.id}`
    if (localStorage.getItem(seen)) return
    localStorage.setItem(seen, '1')
    await fetch('/api/notify-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    })
  } catch { /* 알림 때문에 로그인이 막히면 안 된다 */ }
}
