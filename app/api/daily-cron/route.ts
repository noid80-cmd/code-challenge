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
    A: 'C2 D2 E2 D2', B: 'E2 D2 C2 D2', C: 'G2 A2 G2 F2', D: 'E2 F2 G2 F2',
    E: 'C2 E2 D2 C2', F: 'G2 E2 F2 D2',
    G: 'C2 E2 G2 c2', H: 'c2 G2 E2 C2',
    I: 'C4 D2 E2', J: 'E4 D2 C2', K: 'G4 F2 E2', L: 'C2 D2 E4',
    M: 'G2 F2 E4', N: 'G2 B2 c2 G2', O: 'G4 E2 C2',
    P: 'CD ED C2 D2', Q: 'GF EF G2 F2',
    R: 'EF GF E2 D2', S: 'DC DE C4',
    T: 'FE FG E4',
    U: 'C2 ^C2 D2 E2', V: 'E2 _E2 D2 C2', W: 'F2 ^F2 G2 A2',
    X: 'C>D E>F G2 F2', Y: '(3CDE F2 G2 F2', Z: 'C/D/E/F/ G2 F2 E2',
    '1': 'C2 F2 D2 G2', '2': 'G2 C2 E2 A2', '3': 'C2 A2 F2 D2', '4': 'E2 c2 G2 C2',
    '5': 'z C DE D2 C2', '6': 'z2 GF ED C2', '7': 'z4 C/D/E/F/ G2', '10': 'C2 z2 E/F/G/A/ D2',
    '8': 'C2 D E2 F D2', '9': 'C2 D E3 D2', '11': 'z C D2 E2 D2', '14': 'C2 G2 E F2 D',
    '12': 'G2 F2 G/F/E/D/ C2', '13': 'C/D/E/F/ G2 c2 G2',
    '15': 'z2 (3CDE G2 F2', '16': 'C>D E2 D3 C', '17': '(3CDE z2 F2 E2',
    '18': 'G2 C/D/E/F/ E3 D', '19': 'z2 C>D E2 D2', '20': 'C2 G3 z F/E/D/C/',
    '22': 'E2 c2 (3GFE D2',
    '23': 'C D/E/ F2 D2 C2', '24': 'C/DE/ G2 F2 D2', '25': 'C/D/E G2 E2 C2',
    '26': 'C2 D2 E2 G2-', '27': 'G4 F2 E2',
    '28': 'C2>D2 E2 F2', '29': 'G2>F2 E2 C2',
    '30': 'G2 ^F2 G2 A2', '31': 'G2 _A2 G2 E2', '32': 'D2 ^F2 G2 C2',
    '33': 'E2 ^G2 A2 D2', '34': 'c2 _A2 G2 C2',
    '35': 'C/D/C/E/ G2 F2 D2', '36': 'G/A/G/F/ E2 D2 C2', '37': 'E/D/E/C/ G2 A2 c2',
  }

  const MELODY_CATEGORY = {
    neighbor: ['A', 'B', 'C', 'D'],
    leap: ['E', 'F', 'G', 'H', 'P', 'Q', 'R', 'S', 'T', '1', '2', '3', '4', '18', '20', '22', '32', '33', '34'],
    bigLeap: ['1', '2', '3', '4', '20', '22', '34'],
    chromatic: ['U', 'V', 'W', '30', '31', '32', '33', '34'],
    rhythm: ['X', 'Y', 'Z', '12', '13', '15', '16', '17', '18', '19', '20', '22', '23', '24', '25', '26', '27', '28', '29', '35', '36', '37'],
    syncopation: ['8', '9', '11', '14', '26', '27'],
    rest: ['5', '6', '7', '10', '15', '17', '19', '20'],
  } as const

  type MelodyRecipeNeed = { leap: number; bigLeap: number; chromatic: number; rhythm: number; syncopation: number; rest: number }
  const MELODY_RECIPES: { name: string; need: (level: string) => MelodyRecipeNeed; neighborCap: (level: string) => number; ruleText: string }[] = [
    {
      name: '도약·리듬 집중',
      need: level => ({ leap: level === 'advanced' ? 8 : 6, bigLeap: level === 'advanced' ? 4 : 3, chromatic: 0, rhythm: level === 'advanced' ? 7 : 6, syncopation: 1, rest: 0 }),
      neighborCap: () => 2,
      ruleText: '오늘은 도약과 리듬 심화 위주로 몰아서 만드세요. 반음(U,V,W)이나 쉼표 패턴은 아예 안 써도 됩니다.',
    },
    {
      name: '반음·당김음 집중',
      need: level => ({ leap: 1, bigLeap: 1, chromatic: level === 'advanced' ? 4 : 3, rhythm: 2, syncopation: level === 'advanced' ? 5 : 4, rest: 1 }),
      neighborCap: () => 3,
      ruleText: '오늘은 반음(크로매틱)과 당김음 위주로 몰아서 만드세요. 큰 도약은 최소한만 넣으세요.',
    },
    {
      name: '쉼표·리듬 집중',
      need: level => ({ leap: 2, bigLeap: 1, chromatic: 0, rhythm: level === 'advanced' ? 8 : 7, syncopation: 1, rest: level === 'advanced' ? 5 : 4 }),
      neighborCap: () => 3,
      ruleText: '오늘은 쉼표와 리듬 심화 위주로 몰아서 만드세요. 반음(U,V,W)은 안 써도 됩니다.',
    },
    {
      name: '균형',
      need: level => level === 'advanced'
        ? { leap: 5, bigLeap: 3, chromatic: 1, rhythm: 5, syncopation: 2, rest: 2 }
        : { leap: 4, bigLeap: 2, chromatic: 1, rhythm: 5, syncopation: 2, rest: 2 },
      neighborCap: level => level === 'advanced' ? 2 : 4,
      ruleText: '오늘은 도약·반음·리듬·당김음·쉼표를 골고루 섞어서 만드세요.',
    },
  ]

  function pickMelodyRecipe() {
    return MELODY_RECIPES[Math.floor(Math.random() * MELODY_RECIPES.length)]
  }

  function validateMelodyPairing(bars: string[]): string | null {
    for (let i = 0; i < bars.length; i++) {
      if (bars[i] === '26' && bars[i + 1] !== '27') return `"26" must be immediately followed by "27" (at index ${i})`
      if (bars[i] === '27' && bars[i - 1] !== '26') return `"27" must be immediately preceded by "26" (at index ${i})`
    }
    return null
  }

  function countMelodyCategory(bars: string[], ids: readonly string[]) {
    return bars.filter(b => (ids as readonly string[]).includes(b)).length
  }

  function validateMelodyPhraseShape(bars: string[]): string | null {
    if (bars.length !== 8) return `bars.length=${bars.length}`
    for (const id of bars) {
      if (!MELODY_BAR_PATTERNS[id]) return `unknown id "${id}"`
    }
    const counts: Record<string, number> = {}
    for (const id of bars) counts[id] = (counts[id] ?? 0) + 1
    for (const [id, c] of Object.entries(counts)) {
      if (c > 2) return `id "${id}" repeated ${c} times (max 2)`
    }
    const pairingErr = validateMelodyPairing(bars)
    if (pairingErr) return pairingErr
    return null
  }

  // 카테고리 최소 개수는 "두 프레이즈 합산" 기준으로 검증 (프레이즈별로 전부
  // 강제하면 도약 중심/반음 중심처럼 대조적인 프레이즈 설계와 모순됨)
  function validateMelodyCombined(allBars: string[], level: string, recipe: typeof MELODY_RECIPES[number]): string | null {
    const neighborCap = recipe.neighborCap(level)
    const need = recipe.need(level)

    if (countMelodyCategory(allBars, MELODY_CATEGORY.neighbor) > neighborCap) return `neighbor count exceeds cap ${neighborCap}`
    if (countMelodyCategory(allBars, MELODY_CATEGORY.leap) < need.leap) return `leap count < ${need.leap}`
    if (countMelodyCategory(allBars, MELODY_CATEGORY.bigLeap) < need.bigLeap) return `bigLeap count < ${need.bigLeap}`
    if (countMelodyCategory(allBars, MELODY_CATEGORY.chromatic) < need.chromatic) return `chromatic count < ${need.chromatic}`
    if (countMelodyCategory(allBars, MELODY_CATEGORY.rhythm) < need.rhythm) return `rhythm count < ${need.rhythm}`
    if (countMelodyCategory(allBars, MELODY_CATEGORY.syncopation) < need.syncopation) return `syncopation count < ${need.syncopation}`
    if (countMelodyCategory(allBars, MELODY_CATEGORY.rest) < need.rest) return `rest count < ${need.rest}`
    if (!allBars.some(b => b === '23' || b === '24' || b === '25')) return `missing 2:1:1 rhythm (23/24/25)`
    return null
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
    const melodyRecipe = pickMelodyRecipe()
    console.log(`[cron-melody] recipe=${melodyRecipe.name} level=${melodyLevel}`)

    const melodyNeed = melodyRecipe.need(melodyLevel)
    const melodyNeighborCap = melodyRecipe.neighborCap(melodyLevel)
    const melodyLevelRule = `${melodyRecipe.ruleText} 두 프레이즈를 합쳐(총 16마디) 도약 패턴(도약 카테고리 전체) 최소 ${melodyNeed.leap}개(이 중 4도 이상 큰 도약 최소 ${melodyNeed.bigLeap}개 포함), 반음 패턴(U,V,W) 최소 ${melodyNeed.chromatic}개, 리듬 심화 패턴(리듬 카테고리 전체) 최소 ${melodyNeed.rhythm}개, 당김음 패턴(당김음 카테고리 전체) 최소 ${melodyNeed.syncopation}개, 쉼표 패턴(쉼표 카테고리 전체) 최소 ${melodyNeed.rest}개 포함. 두 프레이즈에 균등하게 나눌 필요 없이 한쪽에 몰아도 됨. 복합 패턴(15~22)은 여러 카테고리에 동시에 속하므로 적극 활용할 것. 이웃음 진행 패턴(A,B,C,D)은 두 프레이즈 합쳐 최대 ${melodyNeighborCap}개로 제한`

    const melodyPrompt = `계이름 시창(멜로디 초견) 챌린지를 생성하세요. 서로 다른 멜로디 특징을 가진 프레이즈 2개를 포함합니다.

난이도: ${melodyLevel === 'advanced' ? '고급' : '중급'}
조성: C장조 고정

아래 마디 패턴 라이브러리에서 각 프레이즈에 대해 정확히 8개 마디 ID를 선택하세요.
각 마디는 정확히 4박자입니다.

[이웃음 중심 진행 A~D — 4분음표, 방향 전환 포함]
A: C2 D2 E2 D2
B: E2 D2 C2 D2
C: G2 A2 G2 F2
D: E2 F2 G2 F2

[스킵+스텝 혼합 E~F]
E: C2 E2 D2 C2
F: G2 E2 F2 D2

[아르페지오 G~H]
G: C2 E2 G2 c2
H: c2 G2 E2 C2

[긴 음 + 스텝 조합 I~O — 2분음표]
I: C4 D2 E2
J: E4 D2 C2
K: G4 F2 E2
L: C2 D2 E4
M: G2 F2 E4
N: G2 B2 c2 G2
O: G4 E2 C2

[꾸밈/턴 피겨 P~T — 8분음표, 박자 단위로 묶임]
P: CD ED C2 D2
Q: GF EF G2 F2
R: EF GF E2 D2
S: DC DE C4
T: FE FG E4

[반음(임시표) U~W — 크로매틱 경과음(한 방향으로 계속 진행)]
U: C2 ^C2 D2 E2 (도-도#-레-미)
V: E2 _E2 D2 C2 (미-미♭-레-도)
W: F2 ^F2 G2 A2 (파-파#-솔-라)

[반음(임시표) 30~34 — 경과음이 아닌 다른 형태: 이웃음(갔다가 돌아옴),
도약+반음, 큰 도약+반음. U~W(경과음)만 반복하지 말고 섞어 쓸 것]
30: G2 ^F2 G2 A2 (솔-파#-솔-라, 아래 이웃음 후 원위치+상행)
31: G2 _A2 G2 E2 (솔-라♭-솔-미, 위 이웃음 후 원위치+도약 하행)
32: D2 ^F2 G2 C2 (레-파#-솔-도, 도약+반음 후 순차 진행)
33: E2 ^G2 A2 D2 (미-솔#-라-레, 도약+반음 후 순차 진행)
34: c2 _A2 G2 C2 (도(위)-라♭-솔-도, 큰 도약 후 2도 반진행+반음)

[리듬 심화 X~Z, 12~13 — 붓점·셋잇단음표·16분음표]
X: C>D E>F G2 F2 (붓점 리듬)
Y: (3CDE F2 G2 F2 (셋잇단음표)
Z: C/D/E/F/ G2 F2 E2 (16분음표 상행 런)
12: G2 F2 G/F/E/D/ C2 (16분음표 하행 런)
13: C/D/E/F/ G2 c2 G2 (16분음표 런 + 도약 결합)

[큰 도약 1~4 — 4도 이상]
1: C2 F2 D2 G2
2: G2 C2 E2 A2
3: C2 A2 F2 D2
4: E2 c2 G2 C2

[쉼표 포함 5~7, 10 — 8분/4분/2분쉼표를 다양하게, 8분·16분음표와 함께, 모두 박자 경계에 정렬]
5: z C DE D2 C2
6: z2 GF ED C2
7: z4 C/D/E/F/ G2
10: C2 z2 E/F/G/A/ D2

[당김음 8, 9, 11, 14 — 붙임줄/쉼표로 박자 경계를 넘겨 진짜 싱코페이션을 만듦. 4개가 서로 다른 리듬 모양]
8: C2 D E2 F D2 (짧은 당김음: 붙임줄 없이 오프비트에서 바로 4분음표)
9: C2 D E3 D2 (긴 당김음: 붙임줄 없이 오프비트에서 바로 점4분음표)
11: z C D2 E2 D2 (쉼표 후 오프비트 진입)
14: C2 G2 E F2 D (도약 후 당김음: 붙임줄 없이 오프비트에서 바로 4분음표)

[복합 패턴 15~22 — 리듬 심화·당김음·쉼표·도약 중 두 개 이상을 한 마디 안에 겹쳐서
매일 비슷한 조합처럼 들리지 않게 밀도를 높인 마디. 반드시 여러 개 섞어 쓸 것]
15: z2 (3CDE G2 F2 (4분쉼표 + 셋잇단음표)
16: C>D E2 D3 C (붓점 + 점4분음표)
17: (3CDE z2 F2 E2 (셋잇단음표 + 4분쉼표)
18: G2 C/D/E/F/ E3 D (도약 + 16분음표 런 + 점4분음표)
19: z2 C>D E2 D2 (4분쉼표 + 붓점)
20: C2 G3 z F/E/D/C/ (도약 + 점4분음표 + 쉼표 + 16분음표 런)
22: E2 c2 (3GFE D2 (6도 도약 + 셋잇단음표)

[2:1:1 리듬 23~25 — 한 박(8분음표+16분음표+16분음표, 2:1:1 길이 비율) 안에서
8분음표의 위치를 앞/중간/뒤로 바꾼 3가지 유형]
23: C D/E/ F2 D2 C2 (8분음표가 앞: 8분+16분+16분)
24: C/DE/ G2 F2 D2 (8분음표가 중간: 16분+8분+16분)
25: C/D/E G2 E2 C2 (8분음표가 뒤: 16분+16분+8분)

[마디를 넘어가는 붙임줄 26~27 — 반드시 짝으로만 사용. 26 바로 다음 마디에
27이 와야 하고, 27은 26 없이 단독으로 쓸 수 없음]
26: C2 D2 E2 G2- (반드시 27 바로 앞에 위치, 마지막 솔이 다음 마디로 붙임줄)
27: G4 F2 E2 (반드시 26 바로 다음에 위치, 붙임줄로 이어받은 솔이 2박 지속)

[점4분음표+8분음표 28~29 — 붙임줄이 아니라 온전한 점음표로 표기한 리듬]
28: C2>D2 E2 F2 (점4분음표+8분음표, 상행)
29: G2>F2 E2 C2 (점4분음표+8분음표, 하행 후 도약)

[16분음표 런 다양화 35~37 — Z, 12, 13, 7, 10, 18, 20의 16분음표 런은 전부
스케일인데, 이건 이웃음+도약이 섞인 16분음표 런. 스케일 런만 반복하지
말고 이런 것도 섞어 쓸 것]
35: C/D/C/E/ G2 F2 D2 (도레도미 — 이웃음 왕복 후 도약)
36: G/A/G/F/ E2 D2 C2 (솔라솔파 — 이웃음 왕복 후 순차 하행)
37: E/D/E/C/ G2 A2 c2 (미레미도 — 이웃음 왕복 후 도약)

[카테고리 소속 — 복합 패턴은 여러 칸에 동시에 포함됨]
도약: E,F,G,H,P,Q,R,S,T,1,2,3,4,18,20,22,32,33,34 (이 중 4도 이상 큰 도약: 1,2,3,4,20,22,34)
리듬 심화: X,Y,Z,12,13,15,16,17,18,19,20,22,23,24,25,26,27,28,29,35,36,37
당김음: 8,9,11,14,26,27
쉼표: 5,6,7,10,15,17,19,20
반음: U,V,W,30,31,32,33,34

규칙:
- ${melodyLevelRule}
- 두 프레이즈가 서로 다른 멜로디 특성을 갖도록 조합 (예: 한 프레이즈는 반음+당김음 중심, 다른 프레이즈는 큰 도약+리듬 심화 중심 — 카테고리 최소 개수는 두 프레이즈 합산 기준이므로 이렇게 나눠 담아도 됨)
- 같은 ID 최대 2번 반복 가능
- 같은 마디를 3개 이상 연속으로 이어붙여 단조로운 음계처럼 들리지 않게 할 것
- 당김음 패턴은 8,9,11,14 중 매번 다른 걸 골라 같은 리듬 모양이 반복되지 않게 할 것
- 26을 쓸 때는 반드시 bars 배열에서 26 바로 다음 자리에 27을 넣을 것 (26만 쓰거나 27만 쓰는 것은 금지)
- 반음이 필요할 때 U,V,W(경과음)만 계속 반복하지 말고 30~34(이웃음/도약+반음)도 최소 절반 정도는 섞어 쓸 것
- 16분음표 런이 필요할 때 Z,12,13처럼 스케일로만 채우지 말고 35,36,37(이웃음+도약 런)도 섞어 쓸 것
- 23, 24, 25(2:1:1 리듬)는 매 생성마다 최소 1개는 포함할 것 — 지금까지 한 번도 안 쓰인 리듬이라 반드시 넣을 것
- 26+27(마디를 넘는 붙임줄)은 리듬 심화 카테고리에 속하는 선택지이니 적당히 섞어 쓸 것 (매번 강제로 넣을 필요는 없음)
- 첫 줄의 오늘의 집중 카테고리 지시를 최우선으로 따를 것 — 최소 개수가 0인 카테고리는 억지로 채우지 말고, 최소 개수가 큰 카테고리 위주로 마디를 고를 것
- 마디가 정확히 8개로 꽉 차므로, 4분음표만 있는 이웃음/아르페지오 마디로 여백을 채우지 말 것

아래 JSON 예시는 형식만 참고하고, 실제 bars 구성은 위 최소 개수 조건에 맞춰 새로 고를 것:
JSON 객체로만 응답:
{
  "title": "챌린지 제목",
  "description": "간단한 설명 (1-2문장)",
  "level": "${melodyLevel}",
  "patterns": [
    {"label": "마디를 넘는 붙임줄·복합 리듬", "bars": ["26", "27", "18", "U", "17", "15", "2", "1"]},
    {"label": "당김음·도약·2:1:1리듬", "bars": ["9", "17", "V", "1", "H", "P", "23", "6"]}
  ]
}`

    const MELODY_FALLBACK = {
      title: '계이름 시창 챌린지',
      description: '복합 리듬과 다양한 쉼표, 당김음을 포함한 중급 챌린지입니다.',
      level: 'intermediate',
      patterns: assembleMelodyABC([
        { label: '복합 리듬·당김음', bars: ['18', '17', 'V', '1', 'H', 'P', '9', '6'] },
        { label: '큰 도약·리듬 심화', bars: ['20', '23', 'U', '15', '2', '3', '8', '5'] },
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
      const rawMelodyPatterns: Array<{ label: string; bars: string[] }> = (parsed.patterns ?? [])
        .map((p: { label: string; bars: string[] }) => ({ label: p.label, bars: (p.bars ?? []).map(String) }))
      let melodyRuleBroken: string | null = null
      for (const p of rawMelodyPatterns) {
        const err = validateMelodyPhraseShape(p.bars)
        if (err) { melodyRuleBroken = err; break }
      }
      if (!melodyRuleBroken) {
        const combined = rawMelodyPatterns.flatMap(p => p.bars)
        melodyRuleBroken = validateMelodyCombined(combined, melodyLevel, melodyRecipe)
      }
      if (melodyRuleBroken) { console.error(`[cron-melody] attempt ${attempt}: rule violation — ${melodyRuleBroken}`); continue }
      const assembled = assembleMelodyABC(rawMelodyPatterns)
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
