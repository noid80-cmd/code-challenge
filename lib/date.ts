export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 오늘 문제가 이미 만들어졌는지로 정한다 — 시계로 정하지 않는다.
//
// 문제는 크론이 만드는데 Vercel Hobby 는 지정 시각에서 최대 1시간 늦게 돈다
// (11:55로 적어놔도 12:50에 돌았다). 시계로 넘기면 양쪽으로 어긋난다.
// 크론이 늦은 날엔 날짜만 넘어가 빈 화면이 되고(12:00~12:50 이 실제로 그랬다),
// 이른 날엔 "나왔어요" 알림만 먼저 간다 — 알림도 만들어진 직후에 나가니까.
// 만들어졌는지를 보면 둘 다 사라진다.
export function candidateDates() {
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  return { today: localDate(now), yesterday: localDate(yesterday) }
}

// 오늘·어제 것을 한 번에 받아 넘겨주면 어느 날짜를 볼지 골라준다.
// 오늘 것이 하나라도 있으면 오늘로 넘어간다.
export function pickActiveDate<T extends { date: string }>(rows: T[]) {
  const { today, yesterday } = candidateDates()
  const hasToday = rows.some(r => r.date === today)
  return { date: hasToday ? today : yesterday, showingYesterday: !hasToday }
}

// 어드민 화면의 초기 날짜용. 거기선 날짜를 직접 고를 수 있어서 시계로 충분하다.
export function challengeDate() {
  const now = new Date()
  if (now.getHours() < 11) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return { date: localDate(yesterday), isBeforeNoon: true }
  }
  return { date: localDate(now), isBeforeNoon: false }
}
