@AGENTS.md

# 코드 챌린지

## 배포 & 저장소
- **URL**: https://code-challenge-smoky-seven.vercel.app
- **GitHub**: noid80-cmd/code-challenge
- **플랫폼**: Vercel
- **commit/push는 허락 없이 바로 진행**

## 기술 스택
- Next.js 16 App Router (TypeScript)
- Supabase (auth + DB + Storage)
- @anthropic-ai/sdk (코드 챌린지 생성)
- proxy.ts (middleware 대신 사용)

## 서비스 개요
매일 초견 챌린지 학습 앱 — 코드/리듬/멜로디(계이름 시창) 세 유형, 어드민이 AI로 생성, 유저들이 연주 영상을 올리고 서로 비교 학습

## 챌린지 타입
`challenges.type` 컬럼으로 구분 (`chord` / `rhythm` / `melody`), `chords` jsonb에 타입별 다른 키 저장:
- `chord` — `progressions` (코드 진행, `ChordPlayer.tsx`)
- `rhythm` — `patterns` (타악기 표기 리듬, `RhythmViewer.tsx`, abcjs `K:perc clef=none`)
- `melody` — `patterns` (계이름 시창, `MelodyPlayer.tsx`, abcjs `K:C clef=treble`, v1은 C장조 고정)

리듬/멜로디는 AI가 notation을 직접 생성하지 않고, 미리 검증된 마디 패턴 라이브러리(`BAR_PATTERNS`, `generate-rhythm`/`generate-melody`의 route.ts)에서 ID만 골라 조합 → 오류 가능성 최소화. `daily-cron/route.ts`에 동일 로직이 중복 구현되어 있음 (기존 스타일).

## 주요 페이지
```
/           코드챌린지 피드 (오늘의 챌린지 + 연주 목록)
/rhythm     리듬챌린지 피드
/melody     멜로디챌린지 피드
/login      로그인 (이메일 + Google)
/signup     회원가입
/upload     연주 영상 업로드 (보호됨) — ?type=chord|rhythm|melody
/admin      챌린지 관리 — 어드민 전용 (noid80@hanmail.net)
/auth/callback  OAuth 콜백
```

## 주요 API
```
POST /api/generate-challenge  — Claude API로 코드 진행 생성
POST /api/generate-rhythm     — Claude API로 리듬 패턴 생성
POST /api/generate-melody     — Claude API로 멜로디 프레이즈 생성 (C장조 고정)
POST /api/notify-signup       — 텔레그램 알림
```

## DB 테이블
- `profiles` — 유저 기본정보 (name, avatar_url)
- `challenges` — 날짜별 챌린지 (date unique, title, description, chords JSON)
- `submissions` — 연주 영상 (video_url은 Supabase Storage 경로)
- `likes` — 좋아요 (submission_id + user_id unique)

## chords JSON 구조
```json
{
  "progressions": [
    { "label": "진행 1", "chords": ["Cmaj7", "Am7", "Dm7", "G7"], "style": "Jazz", "tempo": 80 }
  ]
}
```

## 어드민
- `user.email === 'noid80@hanmail.net'` 체크로 어드민 판별
- `/admin`에서 Claude API로 챌린지 생성 → 미리보기 → 저장

## 환경변수
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY` — Claude API 키 (챌린지 생성에 사용)
