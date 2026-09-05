// 가입 알림을 운영자 텔레그램으로 보낸다.
//
// 봇 토큰이 라우트에 문자열로 박혀 있었고 이 저장소는 공개다. 같은 봇을
// Krookie(kverse)에서도 쓰고 있었고 그쪽도 공개 저장소였다. 코드에서
// 지운다고 회수되지는 않는다(히스토리에 남는다) — BotFather에서 재발급해야
// 한다. 재발급 전까지는 알림이 나가지 않는 게 맞다고 보고 폴백을 두지
// 않았다. 폐기할 토큰을 공개 저장소에 계속 두는 것보다 낫다.
//
// 재발급 후 Vercel 환경변수에 TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID를 넣고
// 재배포하면 코드 수정 없이 살아난다. 두 앱 모두 넣어야 한다.
const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim()
const CHAT_ID = (process.env.TELEGRAM_CHAT_ID || '').trim()

/** 실패해도 호출부를 막지 않는다 — 알림이 안 가는 것보다 가입이 막히는 게 훨씬 나쁘다. */
export async function notifyTelegram(text: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN/CHAT_ID 미설정 — 가입 알림을 보내지 않음')
    return
  }
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text }),
    })
  } catch (err) {
    console.warn('[telegram] 발송 오류', err)
  }
}
