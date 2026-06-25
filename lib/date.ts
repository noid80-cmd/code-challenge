export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 낮 12시 기준 — 오전엔 어제 날짜 챌린지를 보여줌
export function challengeDate() {
  const now = new Date()
  if (now.getHours() < 12) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return { date: localDate(yesterday), isBeforeNoon: true }
  }
  return { date: localDate(now), isBeforeNoon: false }
}
