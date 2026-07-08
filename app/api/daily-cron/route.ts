import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 120

function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

function parseBarSum(bar: string): number {
  let total = 0
  let i = 0
  const s = bar.trim()
  let pendingMod = 1

  while (i < s.length) {
    if (s[i] === ' ') { i++; continue }
    if (s[i] === '(') {
      i++
      let nStr = ''
      while (i < s.length && /\d/.test(s[i])) { nStr += s[i]; i++ }
      const n = parseInt(nStr || '3')
      const mDefault = n === 2 ? 3 : n === 3 ? 2 : n === 4 ? 3 : n === 5 ? 4 : 2
      let peekI = i
      while (peekI < s.length && s[peekI] === ' ') peekI++
      let baseDur = 1
      if (peekI < s.length && (s[peekI] === 'B' || s[peekI] === 'z')) {
        peekI++
        let basNumStr = ''
        while (peekI < s.length && /\d/.test(s[peekI])) { basNumStr += s[peekI]; peekI++ }
        if (basNumStr) baseDur = parseInt(basNumStr)
        else if (peekI < s.length && s[peekI] === '/') baseDur = 0.5
      }
      total += mDefault * baseDur
      pendingMod = 1
      let left = n
      while (i < s.length && left > 0) {
        if (s[i] === ' ') { i++; continue }
        if (s[i] === 'B' || s[i] === 'z') {
          left--; i++
          while (i < s.length && /\d/.test(s[i])) i++
          while (i < s.length && s[i] === '/') i++
        } else break
      }
      continue
    }
    if (s[i] === 'B' || s[i] === 'z') {
      i++
      let numStr = ''
      while (i < s.length && /\d/.test(s[i])) { numStr += s[i]; i++ }
      const num = numStr ? parseInt(numStr) : 1
      let slashes = 0
      while (i < s.length && s[i] === '/') { slashes++; i++ }
      const baseDur = slashes > 0 ? num / Math.pow(2, slashes) : num
      const dur = baseDur * pendingMod
      pendingMod = 1
      if (i < s.length && s[i] === '>') {
        total += dur * 1.5; pendingMod = 0.5; i++
      } else if (i < s.length && s[i] === '<') {
        total += dur * 0.5; pendingMod = 1.5; i++
      } else {
        total += dur
      }
      continue
    }
    i++
  }
  return total
}

function validateABC(patterns: Array<{ abc: string }>): boolean {
  for (const p of patterns) {
    const text = (p.abc as string).replace(/\\n/g, '\n')
    if (/\(2/.test(text)) {
      console.error(`[cron-rhythm] duplet (2 found`)
      return false
    }
    if (/B[4-9]/.test(text)) {
      console.error(`[cron-rhythm] note B4 or longer`)
      return false
    }
    const barLines = text.split('\n').filter((l: string) => l.trim().startsWith('|'))
    if (barLines.length === 0) return false
    for (const barLine of barLines) {
      const bars = barLine.trim().replace(/\|]$/, '|').split('|').filter((b: string) => b.trim() !== '')
      for (const bar of bars) {
        const sum = parseBarSum(bar)
        if (Math.abs(sum - 8) > 0.01) {
          console.error(`[cron-rhythm] bar sum=${sum}: "${bar}"`)
          return false
        }
      }
    }
  }
  return true
}

export async function GET(req: NextRequest) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const today = new Date().toISOString().slice(0, 10)

  // ── 코드챌린지 ──────────────────────────────────────────
  const { data: existingChord } = await supabase
    .from('challenges').select('id, title').eq('date', today).eq('type', 'chord').maybeSingle()

  let chordTitle: string | null = existingChord?.title ?? null

  if (!existingChord) {
    const rand = Math.random()
    const type = rand < 0.90 ? 'chord' : rand < 0.95 ? 'mode' : 'degree'

    const keys = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    const randomKey = keys[Math.floor(Math.random() * keys.length)]

    const levels = ['beginner', 'intermediate', 'advanced'] as const
    const levelWeights = [0.25, 0.5, 0.25]
    const levelRand = Math.random()
    const level = levelWeights[0] > levelRand ? levels[0] : levelWeights[0] + levelWeights[1] > levelRand ? levels[1] : levels[2]
    const levelGuide = level === 'beginner'
      ? '초급 수준: 기본 코드(maj7, m7, 7)만 사용, 흔한 키, 단순한 진행'
      : level === 'advanced'
      ? '고급 수준: 대리화음, 전조, 복잡한 텐션(b9, #11, 13 등) 적극 활용'
      : '중급 수준: 세컨더리 도미넌트, 투파이브 진행 포함, 적당한 복잡도'

    const typeGuide =
      type === 'chord'
        ? `【유형: 일반 코드 진행】\n- 8마디 구성, 한 마디에 1~2개 코드\n- 1~2개의 진행(progression)\n- key 필드 없음`
        : type === 'mode'
        ? `【유형: 모드 초견】\n- 진행 2개, 각 4마디 구성\n- 각 진행은 코드 1개를 4마디 반복\n- 코드명에 모드를 괄호로 표기: "Dm7(Dorian)"\n- 사용 가능한 모드: Dorian, Lydian, Mixolydian, Phrygian, Aeolian\n- key 필드 없음`
        : `【유형: 도수 초견】\n- 8마디 구성, 1~2개의 진행\n- 로마 숫자로 코드 표기: Imaj7, IIm7, IIIm7, IVmaj7, V7, VIm7, VIIm7b5\n- progression마다 key 필드 반드시 포함`

    const chordMsg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `당신은 한국 음악 교육 전문가입니다. 피아노/기타 학생들을 위한 코드초견 챌린지를 생성해주세요.

${typeGuide}

공통 조건:
- 오늘의 키: **${randomKey}** (반드시 이 키로 진행을 만들어야 함)
- chords는 마디 배열: 각 마디는 1~2개 코드를 담는 배열
- style은 다음 중 하나: swing, bossa, samba, jazz_ballad, pop_ballad, funk, shuffle, rnb
- 난이도: **${levelGuide}**

JSON 형식으로만 응답하세요 (다른 텍스트 없이):
※ title은 장르나 리듬 스타일 기반으로 지을 것 (예: "보사노바 & 재즈 코드 챌린지", "펑크 리듬 초견"). 분위기/감성 표현(미드나잇, 드리밍 등) 사용 금지.
{
  "title": "챌린지 제목",
  "description": "간단한 설명 (1-2문장, 유형 언급 포함)",
  "progressions": [
    {
      "label": "진행 1",
      "key": "C",
      "chords": [["Imaj7"], ["IIm7"], ["V7"], ["Imaj7"], ["IIm7"], ["V7"], ["IVmaj7"], ["Imaj7"]],
      "style": "swing"
    }
  ]
}

※ key 필드는 도수 초견일 때만 포함.`,
      }],
    })

    const chordText = chordMsg.content[0].type === 'text' ? chordMsg.content[0].text : ''
    const chordMatch = chordText.match(/\{[\s\S]*\}/)
    if (chordMatch) {
      const chordData = JSON.parse(chordMatch[0])
      await supabase.from('challenges').insert({
        date: today,
        type: 'chord',
        title: chordData.title,
        description: chordData.description,
        level,
        chords: { progressions: chordData.progressions },
      })
      chordTitle = chordData.title
    }
  }

  // ── 리듬챌린지 (패턴 2개를 하나의 레코드로) ────────────────
  const { data: existingRhythm } = await supabase
    .from('challenges').select('id, title').eq('date', today).eq('type', 'rhythm').maybeSingle()

  let rhythmTitle: string | null = existingRhythm?.title ?? null

  if (!existingRhythm) {
    const rRand = Math.random()
    const rhythmLevel = rRand < 0.3 ? 'beginner' : rRand < 0.8 ? 'intermediate' : 'advanced'

    const rhythmLevelGuide =
      rhythmLevel === 'beginner'
        ? `초급: BB·z2·B2·z B·B z 블록만. 예시: BB z2 BB z2 / z2 BB z2 BB / B2 z2 BB z2 / z B BB B2 z2`
        : rhythmLevel === 'advanced'
        ? `고급: 자유 조합(합계=8). 다양한 쉼표·점리듬 사용.\n쉼표: z/=16분(B/그룹내) z=8분 z2=4분 z4=2분 z3=점4분 z>B=점8분쉼표+16분\n셋잇단쉼표(2단위): (3zBB (3BzB (3BBz / 2박3연음쉼표(4단위): (3z2B2B2 (3B2z2B2\n점리듬(2단위): B>z z>B\n예시: z/B/B/B/ z B (3zBB z2 / B>z (3BzB z B z>B / z4 z/B/B/B/ z B / z3 B z2 B/B/B/B/`
        : `중급: 2단위×4 또는 4단위×1+2단위×2. 쉼표 다양하게.\n추가블록(2단위): z/B/B/B/ B/z/B/B/ z>B B>z (3zBB (3BzB (3BBz\n추가블록(4단위): z4 (3z2B2B2 (3B2z2B2\n예시: z/B/B/B/ z B (3BBB z2 / z>B (3BBB z B B/B/B/B/ / z4 B/B/B/B/ z B / (3BzB z B B/B/B/B/ z B`

    const rhythmPrompt = `드럼/리듬 초견 챌린지를 생성하세요. 서로 다른 리듬 테마의 패턴 2개를 포함합니다.

난이도: ${rhythmLevelGuide}

공통:
- 4/4박자, 정확히 8마디, 겹세로줄(|])로 끝낼 것
- K:perc, L:1/8, V:1 clef=none stafflines=1 stem=up
- 각 마디 합계 반드시 8단위
- (3BBB=1박(2단위) vs (3B2B2B2=2박(4단위) 구분 필수
- 금지: B4·B8(음표만), (2

JSON 객체로만 응답:
{
  "title": "챌린지 제목",
  "description": "간단한 설명 (1-2문장)",
  "level": "${rhythmLevel}",
  "patterns": [
    {"label": "패턴 1", "abc": "X:1\\nM:4/4\\nL:1/8\\nQ:1/4=100\\nK:perc\\nV:1 clef=none stafflines=1 stem=up\\n|...|]"},
    {"label": "패턴 2", "abc": "X:1\\nM:4/4\\nL:1/8\\nQ:1/4=100\\nK:perc\\nV:1 clef=none stafflines=1 stem=up\\n|...|]"}
  ]
}`

    let rhythmCh: { title: string; description: string; level: string; patterns: unknown[] } | null = null
    let lastRhythmParsed: typeof rhythmCh = null
    for (let attempt = 1; attempt <= 5; attempt++) {
      const rhythmMsg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: 'You are a JSON generator. Output only a valid JSON object. No explanations, no reasoning text, no markdown. Start your response directly with { and end with }.',
        messages: [{ role: 'user', content: rhythmPrompt }],
      })
      const rhythmText = rhythmMsg.content[0].type === 'text' ? rhythmMsg.content[0].text : ''
      const rhythmJsonStr = extractJsonObject(rhythmText)
      if (!rhythmJsonStr) { console.error(`[cron-rhythm] attempt ${attempt}: no JSON`); continue }
      let parsed
      try { parsed = JSON.parse(rhythmJsonStr) } catch { continue }
      lastRhythmParsed = parsed
      if (!validateABC(parsed.patterns ?? [])) { console.error(`[cron-rhythm] attempt ${attempt}: bar validation failed`); continue }
      rhythmCh = parsed
      break
    }
    if (!rhythmCh) {
      console.error('[cron-rhythm] all attempts failed validation, using last result')
      rhythmCh = lastRhythmParsed
    }

    if (rhythmCh) {
      await supabase.from('challenges').insert({
        date: today,
        type: 'rhythm',
        level: rhythmLevel,
        title: rhythmCh.title,
        description: rhythmCh.description,
        chords: { patterns: rhythmCh.patterns },
      })
      rhythmTitle = rhythmCh.title
    }
  }

  // ── 푸시 알림 ──────────────────────────────────────────
  const { data: subs } = await supabase
    .from('push_subscriptions').select('subscription, endpoint')

  if (!subs || subs.length === 0) {
    return NextResponse.json({ chordTitle, rhythmTitle, sent: 0 })
  }

  const notifTitle = 'PlayDaily — 오늘의 챌린지'
  const notifBody = [
    chordTitle ? `🎵 ${chordTitle}` : null,
    rhythmTitle ? `🥁 ${rhythmTitle}` : null,
  ].filter(Boolean).join('\n') || '새로운 챌린지가 올라왔어요!'

  const deadEndpoints: string[] = []
  const results = await Promise.allSettled(
    subs.map(async ({ subscription, endpoint }) => {
      try {
        await webpush.sendNotification(subscription, JSON.stringify({ title: notifTitle, body: notifBody, url: '/' }))
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'statusCode' in err &&
          ((err as { statusCode: number }).statusCode === 410 || (err as { statusCode: number }).statusCode === 404)) {
          deadEndpoints.push(endpoint)
        }
        throw err
      }
    })
  )

  if (deadEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', deadEndpoints)
  }

  const sent = results.filter(r => r.status === 'fulfilled').length
  return NextResponse.json({ chordTitle, rhythmTitle, sent, total: subs.length })
}
