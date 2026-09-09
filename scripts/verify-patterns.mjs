// 리듬/멜로디 마디 패턴 검증기.  실행: node scripts/verify-patterns.mjs
//
// 1) 마디 길이 — abcjs가 실제 해석한 길이가 정확히 4/4(=1.0)인가.
//    parseOnly의 note.duration은 "적힌 길이"라 잇단음표 비율이 빠져 있다.
//    startTriplet/tripletMultiplier를 직접 곱해야 한다. 이 보정을 빼면
//    멀쩡한 3연음 마디까지 길이 초과로 오판한다.
//    길이가 어긋나면 abcjs가 빔·기둥을 이상하게 그린다(기둥이 사라지는 증상).
//    특히 (5는 abcjs가 5:2(반 박)로 해석하므로 5연음은 반드시 (5:4:5로 적어야 한다.
// 2) 붙임줄 무결성(리듬) — 박 셀로 쪼개 섞는 shuffleBeatsAcrossBars가
//    타이를 끊지 않는지. 타이는 공백 없는 한 토큰이어야 한다.
// 3) daily-cron 복제본이 원본 라우트와 일치하는지.
import fs from 'fs'
import abcjs from 'abcjs'

function extract(file, varName) {
  const src = fs.readFileSync(file, 'utf8')
  const start = src.indexOf(`const ${varName}: Record<string, string> = {`)
  if (start === -1) throw new Error(`${varName} not found in ${file}`)
  const open = src.indexOf('{', start)
  let depth = 0, end = -1
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break } }
  }
  const out = {}
  for (const m of src.slice(open + 1, end).matchAll(/'?([A-Za-z0-9]+)'?\s*:\s*'([^']*)'/g)) out[m[1]] = m[2]
  return out
}

function barLengths(abc) {
  const tune = abcjs.parseOnly(abc)[0]
  const voice = tune.lines.find(l => l.staff)?.staff[0]?.voices[0] ?? []
  const bars = []
  let sum = 0, mult = 1, left = 0
  for (const el of voice) {
    if (el.el_type === 'bar') { if (sum > 0) bars.push(sum); sum = 0; continue }
    if (el.el_type !== 'note') continue
    if (el.startTriplet) { mult = el.tripletMultiplier; left = el.startTriplet }
    sum += el.duration * (left > 0 ? mult : 1)
    if (left > 0) { left--; if (left === 0) mult = 1 }
  }
  if (sum > 0) bars.push(sum)
  return bars
}

// --- generate-rhythm/route.ts 의 tokenDuration / splitIntoBeatCells 와 같은 규칙 ---
function noteDur(sym) {
  if (sym.endsWith('/')) return 0.5
  const m = sym.match(/\d+$/)
  return m ? parseInt(m[0], 10) : 1
}
function tokenDuration(tok) {
  const tup = tok.match(/^\((\d+)(?::(\d+))?(?::(\d+))?/)
  if (tup) {
    const p = parseInt(tup[1], 10)
    const q = tup[2] ? parseInt(tup[2], 10) : (p === 3 ? 2 : p === 2 ? 3 : p === 5 ? 4 : 2)
    const notes = tok.slice(tup[0].length).match(/[Bz](?:\/|\d+)?/g) ?? []
    return notes.reduce((s, n) => s + noteDur(n), 0) * (q / p)
  }
  if (tok.includes('>') || tok.includes('<')) return 2
  return (tok.match(/[Bz](?:\/|\d+)?/g) ?? []).reduce((s, n) => s + noteDur(n), 0)
}
function beatCells(bar) {
  const cells = []
  let cur = [], curDur = 0
  for (const tok of bar.trim().split(/\s+/)) {
    cur.push(tok); curDur += tokenDuration(tok)
    if (curDur % 2 === 0) { cells.push({ text: cur.join(' '), slots: curDur / 2 }); cur = []; curDur = 0 }
  }
  if (cur.length) cells.push({ text: cur.join(' '), slots: curDur / 2 })
  return cells
}

const RH_H = 'X:1\nM:4/4\nL:1/8\nQ:1/4=100\nK:perc\nV:1 clef=none stafflines=1 stem=up\n'
const ML_H = 'X:1\nM:4/4\nL:1/8\nQ:1/4=100\nK:C\nV:1 clef=treble\n'
const SRC = {
  rhythm: extract('app/api/generate-rhythm/route.ts', 'BAR_PATTERNS'),
  melody: extract('app/api/generate-melody/route.ts', 'BAR_PATTERNS'),
}
const CRON = {
  rhythm: extract('app/api/daily-cron/route.ts', 'BAR_PATTERNS'),
  melody: extract('app/api/daily-cron/route.ts', 'MELODY_BAR_PATTERNS'),
}

let failed = 0, checked = 0
for (const [kind, header] of [['rhythm', RH_H], ['melody', ML_H]]) {
  const pats = SRC[kind]
  console.log(`\n=== ${kind === 'rhythm' ? '리듬' : '멜로디'} — 패턴 ${Object.keys(pats).length}개 ===`)
  for (const [id, bar] of Object.entries(pats)) {
    checked++
    const lens = barLengths(header + '|' + bar + '|]')
    if (lens.length !== 1 || Math.abs(lens[0] - 1) > 1e-9) {
      console.log(`  ✗ ${id.padEnd(4)} 마디 길이 ${lens.map(n => n.toFixed(4)).join(', ')} (기대 1.0000)  ${bar}`); failed++
      continue
    }
    if (kind === 'rhythm') {
      const cells = beatCells(bar)
      const slots = cells.reduce((s, c) => s + c.slots, 0)
      if (slots !== 4) { console.log(`  ✗ ${id.padEnd(4)} 박 셀 합계 ${slots} (기대 4)  ${bar}`); failed++; continue }
      const dangling = cells.find(c => c.text.trim().endsWith('-'))
      if (dangling) { console.log(`  ✗ ${id.padEnd(4)} 붙임줄이 박 셀 경계에서 끊김: "${dangling.text}"`); failed++; continue }
    }
  }
  // daily-cron 복제본 대조. 두 경로가 같은 악보를 내야 하므로 완전히 같아야 한다.
  // 한쪽에만 패턴을 추가하면 매일 자동 생성이 어드민 생성보다 좁아진다(실제로 그랬다).
  const cron = CRON[kind]
  const conflict = Object.keys(cron).filter(k => pats[k] !== undefined && cron[k] !== pats[k])
  const orphan = Object.keys(cron).filter(k => pats[k] === undefined)
  const missing = Object.keys(pats).filter(k => cron[k] === undefined)
  if (conflict.length || orphan.length || missing.length) {
    if (conflict.length) console.log(`  ✗ daily-cron 값 불일치: ${conflict.join(', ')}`)
    if (orphan.length) console.log(`  ✗ daily-cron에만 있는 ID: ${orphan.join(', ')}`)
    if (missing.length) console.log(`  ✗ daily-cron에 빠진 ID: ${missing.join(', ')}`)
    failed++
  } else {
    console.log(`  · daily-cron 복제본 완전 일치 (${Object.keys(cron).length}개)`)
  }
}
console.log(`\n검사 ${checked}개, 실패 ${failed}개`)
process.exit(failed ? 1 : 0)
