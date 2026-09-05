import { NextResponse } from 'next/server'
import { notifyTelegram } from '@/lib/telegram'


export async function POST(req: Request) {
  const { name, email } = await req.json()
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const time = kst.toISOString().replace('T', ' ').slice(0, 16)
  const text = [
    '🎵 새 회원가입 - 코드 챌린지',
    `이름: ${name}`,
    `이메일: ${email}`,
    `시간: ${time} KST`,
  ].join('\n')

  await notifyTelegram(text)

  return NextResponse.json({ ok: true })
}
