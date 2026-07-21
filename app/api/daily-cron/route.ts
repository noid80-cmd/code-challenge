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

const BAR_PATTERNS: Record<string, string> = {
  A: 'BB z2 BB z2',
  B: 'z2 BB z2 BB',
  C: 'B B/ B/ z B (3BBB z2',
  D: 'B/ B/ B z B (3BzB z2',
  E: 'B/ B B/ z B (3BBB z2',
  F: 'B>B z2 B>B z2',
  G: 'B>B (3BBB z B z2',
  H: 'B<B z B (3BBB z2',
  I: '(3BzB z B B B/ B/ z2',
  J: '(3B2B2B2 BB z2',
  K: '(3B2B2B2 z2 BB',
  L: '(3B2B2B2 z B B z',
  M: 'z4 B B/ B/ z B',
  N: 'z4 (3BBB z2',
  O: 'B/B/B/B/ z B (3BBB z2',
  P: 'B B/ z/ z B (3BBB z2',
  Q: 'B/ z/ B z B (3BzB z2',
  R: 'z/ B/ B z B (3BBB z2',
  S: 'z B/ z/ z B (3BBB z2',
  T: 'B>B B/ z/ B z B z2',
  U: 'B>B z/ B/ B (3BzB z2',
  V: '(3B2B2B2 B B/ z/ B/ z/ B',
  W: 'z4 B B/ z/ B/ z/ B',
  X: 'B B/ z/ B/ z/ B z B z2',
  Y: 'z/ B/ B B B/ z/ (3BBB z2',
  Z: 'B/ z/ B B B/ z/ (3BzB z2',
}

function assemblePatternsABC(
  aiPatterns: Array<{ label: string; bars: string[] }>
): Array<{ label: string; abc: string }> | null {
  const result: Array<{ label: string; abc: string }> = []
  for (const p of aiPatterns) {
    if (!Array.isArray(p.bars) || p.bars.length !== 8) {
      console.error(`[cron-rhythm] bars.length=${p.bars?.length ?? 'missing'}`)
      return null
    }
    const barTexts: string[] = []
    for (const id of p.bars) {
      const barText = BAR_PATTERNS[String(id).toUpperCase()]
      if (!barText) {
        console.error(`[cron-rhythm] unknown pattern ID: "${id}"`)
        return null
      }
      barTexts.push(barText)
    }
    const abc =
      'X:1\nM:4/4\nL:1/8\nQ:1/4=100\nK:perc\nV:1 clef=none stafflines=1 stem=up\n|' +
      barTexts.join('|') + '|]'
    result.push({ label: String(p.label || `패턴 ${result.length + 1}`), abc })
  }
  return result.length >= 2 ? result : null
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
    const rhythmLevel = Math.random() < 0.7 ? 'intermediate' : 'advanced'

    const rhythmLevelRule = rhythmLevel === 'advanced'
      ? '각 패턴에 P~Z 중 최소 4개 포함 (나머지는 A~O)'
      : '각 패턴에 P~Z 중 2~3개 포함 (나머지는 A~O)'

    const rhythmPrompt = `드럼/리듬 초견 챌린지를 생성하세요. 서로 다른 리듬 테마의 패턴 2개를 포함합니다.

난이도: ${rhythmLevel === 'advanced' ? '고급' : '중급'}

아래 마디 패턴 라이브러리에서 각 패턴에 대해 정확히 8개 마디 ID를 선택하세요.
각 패턴은 정확히 4박자입니다.

[심플 패턴 A~O]
A: BB z2 BB z2
B: z2 BB z2 BB
C: B B/ B/ z B (3BBB z2
D: B/ B/ B z B (3BzB z2
E: B/ B B/ z B (3BBB z2
F: B>B z2 B>B z2
G: B>B (3BBB z B z2
H: B<B z B (3BBB z2
I: (3BzB z B B B/ B/ z2
J: (3B2B2B2 BB z2
K: (3B2B2B2 z2 BB
L: (3B2B2B2 z B B z
M: z4 B B/ B/ z B
N: z4 (3BBB z2
O: B/B/B/B/ z B (3BBB z2

[16분쉼표(z/) 포함 패턴 P~Z]
P: B B/ z/ z B (3BBB z2
Q: B/ z/ B z B (3BzB z2
R: z/ B/ B z B (3BBB z2
S: z B/ z/ z B (3BBB z2
T: B>B B/ z/ B z B z2
U: B>B z/ B/ B (3BzB z2
V: (3B2B2B2 B B/ z/ B/ z/ B
W: z4 B B/ z/ B/ z/ B
X: B B/ z/ B/ z/ B z B z2
Y: z/ B/ B B B/ z/ (3BBB z2
Z: B/ z/ B B B/ z/ (3BzB z2

규칙:
- ${rhythmLevelRule}
- 두 패턴이 서로 다른 리듬 특성을 갖도록 조합
- 같은 ID 최대 2번 반복 가능

JSON 객체로만 응답:
{
  "title": "챌린지 제목",
  "description": "간단한 설명 (1-2문장)",
  "level": "${rhythmLevel}",
  "patterns": [
    {"label": "패턴 1", "bars": ["C", "A", "G", "D", "R", "E", "J", "P"]},
    {"label": "패턴 2", "bars": ["B", "H", "C", "Q", "A", "D", "M", "E"]}
  ]
}`

    const RHYTHM_FALLBACK = {
      title: '드럼 초견 챌린지',
      description: '셋잇단음표와 붓점 리듬을 포함한 중급 챌린지입니다.',
      level: 'intermediate',
      patterns: assemblePatternsABC([
        { label: '패턴 1', bars: ['A', 'C', 'G', 'D', 'R', 'E', 'J', 'P'] },
        { label: '패턴 2', bars: ['B', 'H', 'C', 'Q', 'A', 'D', 'M', 'E'] },
      ])!,
    }

    let rhythmCh: { title: string; description: string; level: string; patterns: unknown[] } | null = null
    for (let attempt = 1; attempt <= 10; attempt++) {
      const rhythmMsg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: 'You are a JSON generator. Output only a valid JSON object. No explanations, no reasoning text, no markdown. Start your response directly with { and end with }.',
        messages: [{ role: 'user', content: rhythmPrompt }],
      })
      const rhythmText = rhythmMsg.content[0].type === 'text' ? rhythmMsg.content[0].text : ''
      const rhythmJsonStr = extractJsonObject(rhythmText)
      if (!rhythmJsonStr) { console.error(`[cron-rhythm] attempt ${attempt}: no JSON`); continue }
      let parsed
      try { parsed = JSON.parse(rhythmJsonStr) } catch { continue }
      const assembled = assemblePatternsABC(parsed.patterns ?? [])
      if (!assembled) { console.error(`[cron-rhythm] attempt ${attempt}: assembly failed`); continue }
      rhythmCh = { ...parsed, patterns: assembled }
      console.log(`[cron-rhythm] success attempt=${attempt} level=${rhythmLevel}`)
      break
    }
    if (!rhythmCh) {
      console.error('[cron-rhythm] all 10 attempts failed — using fallback')
      rhythmCh = RHYTHM_FALLBACK
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

  // ── 멜로디챌린지 (계이름 시창, C장조 고정) ────────────────
  const MELODY_BAR_PATTERNS: Record<string, string> = {
    A: 'C2 D2 E2 F2', B: 'F2 E2 D2 C2', C: 'G2 A2 B2 c2', D: 'c2 B2 A2 G2',
    E: 'CDEFGABc', F: 'cBAGFEDC',
    G: 'C2 E2 G2 c2', H: 'c2 G2 E2 C2',
    I: 'C4 E4', J: 'E4 C4', K: 'G4 C4', L: 'C4 D4',
    M: 'CDEF E2 D2', N: 'G2 A2 G2 F2', O: 'E2 D2 E2 F2',
    P: 'C2 E2 D2 F2', Q: 'G2 E2 F2 D2',
    R: 'CDED C2 D2', S: 'GFEF G2 F2',
    T: 'C2 G2 c2 G2',
  }

  function assembleMelodyABC(
    aiPatterns: Array<{ label: string; bars: string[] }>
  ): Array<{ label: string; abc: string }> | null {
    const result: Array<{ label: string; abc: string }> = []
    for (const p of aiPatterns) {
      if (!Array.isArray(p.bars) || p.bars.length !== 8) {
        console.error(`[cron-melody] bars.length=${p.bars?.length ?? 'missing'}`)
        return null
      }
      const barTexts: string[] = []
      for (const id of p.bars) {
        const barText = MELODY_BAR_PATTERNS[String(id).toUpperCase()]
        if (!barText) {
          console.error(`[cron-melody] unknown pattern ID: "${id}"`)
          return null
        }
        barTexts.push(barText)
      }
      const abc =
        'X:1\nM:4/4\nL:1/8\nQ:1/4=100\nK:C\nV:1 clef=treble\n|' +
        barTexts.join('|') + '|]'
      result.push({ label: String(p.label || `프레이즈 ${result.length + 1}`), abc })
    }
    return result.length >= 2 ? result : null
  }

  const { data: existingMelody } = await supabase
    .from('challenges').select('id, title').eq('date', today).eq('type', 'melody').maybeSingle()

  let melodyTitle: string | null = existingMelody?.title ?? null

  if (!existingMelody) {
    const melodyLevel = Math.random() < 0.7 ? 'intermediate' : 'advanced'

    const melodyLevelRule = melodyLevel === 'advanced'
      ? '각 프레이즈에 도약 패턴(G,H,I,J,K,L,P,Q,T) 중 최소 4개 포함 (나머지는 순차 진행 위주 패턴)'
      : '각 프레이즈에 도약 패턴(G,H,I,J,K,L,P,Q,T) 중 1~2개 포함 (나머지는 순차 진행 위주 패턴)'

    const melodyPrompt = `계이름 시창(멜로디 초견) 챌린지를 생성하세요. 서로 다른 멜로디 특징을 가진 프레이즈 2개를 포함합니다.

난이도: ${melodyLevel === 'advanced' ? '고급' : '중급'}
조성: C장조 고정

아래 마디 패턴 라이브러리에서 각 프레이즈에 대해 정확히 8개 마디 ID를 선택하세요.
각 마디는 정확히 4박자입니다.

[순차 진행 A~D — 4분음표]
A: C2 D2 E2 F2
B: F2 E2 D2 C2
C: G2 A2 B2 c2
D: c2 B2 A2 G2

[한 옥타브 스케일 E~F — 8분음표]
E: CDEFGABc
F: cBAGFEDC

[3도 도약 아르페지오 G~H]
G: C2 E2 G2 c2
H: c2 G2 E2 C2

[긴 음 도약 I~L — 2분음표]
I: C4 E4
J: E4 C4
K: G4 C4
L: C4 D4

[상행 후 되돌아오기 M~O]
M: CDEF E2 D2
N: G2 A2 G2 F2
O: E2 D2 E2 F2

[도약+스텝 혼합 P~Q]
P: C2 E2 D2 F2
Q: G2 E2 F2 D2

[제자리 왕복 R~S]
R: CDED C2 D2
S: GFEF G2 F2

[반복 도약 T]
T: C2 G2 c2 G2

규칙:
- ${melodyLevelRule}
- 두 프레이즈가 서로 다른 멜로디 특성을 갖도록 조합
- 같은 ID 최대 2번 반복 가능

JSON 객체로만 응답:
{
  "title": "챌린지 제목",
  "description": "간단한 설명 (1-2문장)",
  "level": "${melodyLevel}",
  "patterns": [
    {"label": "순차 상행", "bars": ["A", "C", "E", "M", "B", "D", "F", "O"]},
    {"label": "3도 도약", "bars": ["G", "H", "I", "P", "T", "J", "Q", "K"]}
  ]
}`

    const MELODY_FALLBACK = {
      title: '계이름 시창 챌린지',
      description: '순차 진행과 3도 도약을 포함한 중급 챌린지입니다.',
      level: 'intermediate',
      patterns: assembleMelodyABC([
        { label: '순차 상행', bars: ['A', 'C', 'E', 'M', 'B', 'D', 'F', 'O'] },
        { label: '3도 도약', bars: ['G', 'H', 'I', 'P', 'T', 'J', 'Q', 'K'] },
      ])!,
    }

    let melodyCh: { title: string; description: string; level: string; patterns: unknown[] } | null = null
    for (let attempt = 1; attempt <= 10; attempt++) {
      const melodyMsg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: 'You are a JSON generator. Output only a valid JSON object. No explanations, no reasoning text, no markdown. Start your response directly with { and end with }.',
        messages: [{ role: 'user', content: melodyPrompt }],
      })
      const melodyText = melodyMsg.content[0].type === 'text' ? melodyMsg.content[0].text : ''
      const melodyJsonStr = extractJsonObject(melodyText)
      if (!melodyJsonStr) { console.error(`[cron-melody] attempt ${attempt}: no JSON`); continue }
      let parsed
      try { parsed = JSON.parse(melodyJsonStr) } catch { continue }
      const assembled = assembleMelodyABC(parsed.patterns ?? [])
      if (!assembled) { console.error(`[cron-melody] attempt ${attempt}: assembly failed`); continue }
      melodyCh = { ...parsed, patterns: assembled }
      console.log(`[cron-melody] success attempt=${attempt} level=${melodyLevel}`)
      break
    }
    if (!melodyCh) {
      console.error('[cron-melody] all 10 attempts failed — using fallback')
      melodyCh = MELODY_FALLBACK
    }

    if (melodyCh) {
      await supabase.from('challenges').insert({
        date: today,
        type: 'melody',
        level: melodyCh.level,
        title: melodyCh.title,
        description: melodyCh.description,
        chords: { patterns: melodyCh.patterns },
      })
      melodyTitle = melodyCh.title
    }
  }

  // ── 푸시 알림 ──────────────────────────────────────────
  const { data: subs } = await supabase
    .from('push_subscriptions').select('subscription, endpoint')

  if (!subs || subs.length === 0) {
    return NextResponse.json({ chordTitle, rhythmTitle, melodyTitle, sent: 0 })
  }

  const notifTitle = 'PlayDaily — 오늘의 챌린지'
  const notifBody = [
    chordTitle ? `🎵 ${chordTitle}` : null,
    rhythmTitle ? `🥁 ${rhythmTitle}` : null,
    melodyTitle ? `🎼 ${melodyTitle}` : null,
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
  return NextResponse.json({ chordTitle, rhythmTitle, melodyTitle, sent, total: subs.length })
}
