@AGENTS.md

# 코드 챌린지

## 배포 & 저장소
- **URL**: (미정 — Vercel 배포 예정)
- **GitHub**: noid80-cmd/code-challenge
- **플랫폼**: Vercel
- **commit/push는 허락 없이 바로 진행**

## 기술 스택
- Next.js 16 App Router (TypeScript)
- Supabase (auth + DB + Storage)
- @anthropic-ai/sdk (코드 챌린지 생성)
- proxy.ts (middleware 대신 사용)

## 서비스 개요
매일 코드초견 챌린지 SNS — 어드민이 AI로 코드 진행을 생성, 유저들이 연주 영상을 올리고 서로 비교 학습

## 주요 페이지
```
/           메인 피드 (오늘의 챌린지 + 연주 목록)
/login      로그인 (이메일 + Google)
/signup     회원가입
/upload     연주 영상 업로드 (보호됨)
/admin      챌린지 관리 — 어드민 전용 (noid80@hanmail.net)
/auth/callback  OAuth 콜백
```

## 주요 API
```
POST /api/generate-challenge  — Claude API로 코드 진행 생성
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
