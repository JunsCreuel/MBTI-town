# MBTI 마을

MBTI 16개 유형이 팀이 되어 매일 토론 대항전을 벌이고, 그 전적이 마을에 쌓이는 웹 3D 공간.
개발 기준은 [PROJECT_GUIDE.md](PROJECT_GUIDE.md)를 따른다.

## 지금 되는 것

- 입장: MBTI 직접 고르기 또는 12문항 간단 설문
- 3D 광장: 여러 명 동시 접속, 탭(클릭) 이동과 방향키 이동, 길찾기
- 몸짓: 응원·박수 동작, 하트·궁금·놀람 이모티콘 (자유 채팅 없음)
- 채널: 방(채널)당 정원이 차면 다음 채널이 자동으로 열린다
- 임시 에셋: 코드로 만든 3D 캐릭터·소품 (`_ph`). 실제 GLB로 파일만 바꾸면 된다
- 오늘의 토론: 매일 대진·주제 자동 결정 → 출전 팀 논거 작성·AI 필터·팀 내 추천 → 관전 투표 → AI Judge 채점(7:3 합산) → 결과 발표와 결과 카드(1080×1350 PNG 저장·공유)
- 로그인: Supabase Auth (카카오·구글·이메일 링크). 설정이 없으면 로컬에서 개발용 로그인

## 키 없이 바로 해 보기

Supabase와 Anthropic 키가 없어도 로컬에서 전체 흐름이 돌아간다. DB는 PGlite(파일에 저장되는 Postgres, `~/.mbti-town/pglite`), 로그인은 개발용, 채점·필터는 개발용 가짜 구현을 쓴다.
하루를 기다리지 않고 단계를 넘기려면 개발용 시계를 앞으로 돌린다.

```bash
curl -X POST localhost:3000/api/dev/clock -H 'content-type: application/json' -d '{"addMinutes": 600}'
```

```bash
curl -X POST localhost:3000/api/dev/clock -H 'content-type: application/json' -d '{"reset": true}'
```

## 운영 설정 (Supabase + Claude)

1. Supabase 프로젝트를 만들고 `supabase/migrations/` 의 SQL을 SQL Editor에서 실행한다 (또는 `supabase db push`).
2. Authentication > Providers 에서 Kakao, Google, Email을 켠다. Redirect URL에 `https://<도메인>/auth/callback` 을 넣는다.
3. 환경변수를 넣는다 (`.env.example` 참고): `DATABASE_URL`(Transaction pooler 주소), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`.
4. 매일 채점 시각 직후(기본 21:01 한국 시간)와 자정 직후에 `/api/cron/debate` 를 부르도록 예약한다. 헤더: `Authorization: Bearer $CRON_SECRET`.
   예약 작업이 없어도 투표 마감 뒤 첫 방문 때 채점되지만, 예약해 두면 발표 시각이 정확하다.

## 실행

```bash
npm install
cp .env.example .env.local
npm run dev        # 웹 http://localhost:3000 + 실시간 서버 ws://localhost:2567
```

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 웹과 실시간 서버를 함께 띄운다 |
| `npm test` | 단위 테스트 + 실시간 서버 통합 테스트 + 토론 하루 흐름 테스트 (PGlite) |
| `npm run typecheck` | 웹·서버 타입 검사 |
| `npm run assets:ph` | 임시 에셋(GLB 등)을 다시 만든다 (`-- --map`이면 광장 맵도 새로 만든다) |
| `npm run assets:check` | 에셋 규칙·용량·남은 `_ph` 목록 검사 |
| `npm run build` | 에셋 검사 후 웹 빌드 |
| `npm run start:server` | 실시간 서버만 실행 (배포용) |

## 구조

```
src/app/                 Next.js 화면 (입장, 광장)
src/components/plaza/    3D 광장 (React Three Fiber)
src/components/debate/   오늘의 토론 화면, 결과 카드, 로그인
src/app/api/             토론·로그인 API (규칙 검사 후 DB 쓰기)
src/server/              서버 전용: DB 연결, 토론 저장소·규칙(service)·AI Judge
supabase/migrations/     DB 스키마 (Supabase와 로컬 PGlite가 같은 SQL을 쓴다)
src/shared/              웹과 서버가 함께 쓰는 규칙 (맵, 길찾기, 이동 검사, 메시지 규약, 캐릭터 규약, 토론 규칙, 주제 목록)
src/config/game.ts       운영 중 바꿀 값 (방 정원, 전송 빈도, 점수 비율 등)
src/design/              디자인 토큰, MBTI 유형 정보
server/                  실시간 서버 (Colyseus)
scripts/                 임시 에셋 생성, 에셋 검사
public/assets/           에셋 (manifest.json 키로만 불러온다)
```
