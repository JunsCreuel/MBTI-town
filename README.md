# MBTI 마을

MBTI 16개 유형이 모여 사는 웹 3D 마을. 유형마다 마을이 있고, 가운데 광장에서 서로 만난다.
매일 열리는 토론 이벤트에서 이기면 진 팀 땅을 가져와 우리 마을이 넓어진다 (땅따먹기).
개발 기준은 [PROJECT_GUIDE.md](PROJECT_GUIDE.md)를 따른다.

## 지금 되는 것

- 입장: MBTI 직접 고르기 또는 12문항 간단 설문 → 내 유형 마을에서 시작
- 3D 마을: 가운데 광장 + 둘레 16개 유형 마을(집·깃발·표지판은 유형 색) + 모래사장과 바다
- 여러 명 동시 접속, 탭(클릭) 이동과 방향키 이동, 길찾기
- 전체 지도: 위에서 내려다보며 유형별 땅 크기를 보고, 마을이나 광장을 눌러 바로 이동
- 땅따먹기: 토론에서 이긴 팀이 진 팀 땅을 가져온다 (`src/shared/territory.ts`, `/api/town`)
- 몸짓: 응원·박수 동작, 하트·궁금·놀람 이모티콘 (자유 채팅 없음)
- 채널: 방(채널)당 정원이 차면 다음 채널이 자동으로 열린다
- 임시 에셋: 코드로 만든 3D 캐릭터·소품 (`_ph`). 실제 GLB로 파일만 바꾸면 된다
- 오늘의 토론 (이벤트): 매일 대진·주제 자동 결정 → 출전 팀 논거 작성(금지어 검사)·팀 내 추천 → 관전 판정(관전 유형이 대표 논거 하나를 골라 승패 결정) → 결과 발표와 결과 카드(1080×1350 PNG 저장·공유)
- 로그인: Supabase Auth (카카오·구글·이메일 링크). 설정이 없으면 로컬에서 개발용 로그인

## 키 없이 바로 해 보기

Supabase 없이도 로컬에서 전체 흐름이 돌아간다. DB는 PGlite(파일에 저장되는 Postgres, `~/.mbti-town/pglite`), 로그인은 개발용을 쓴다. AI API는 쓰지 않는다.
하루를 기다리지 않고 단계를 넘기려면 개발용 시계를 앞으로 돌린다.

```bash
curl -X POST localhost:3000/api/dev/clock -H 'content-type: application/json' -d '{"addMinutes": 600}'
```

```bash
curl -X POST localhost:3000/api/dev/clock -H 'content-type: application/json' -d '{"reset": true}'
```

## 배포

웹 화면은 Vercel, 마을 실시간 서버는 Render, DB와 로그인은 Supabase에 둔다.
순서와 설정값은 [docs/DEPLOY.md](docs/DEPLOY.md)를 따른다. 설정 파일: `render.yaml`, `vercel.json`, `.env.example`.

## 실행

```bash
npm install
cp .env.example .env.local
npm run dev        # 웹 http://localhost:3000 + 실시간 서버 ws://localhost:2567
```

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 웹과 실시간 서버를 함께 띄운다 (시작할 때 `.next/dev` 를 비운다: 운영 빌드 뒤 남은 개발 캐시 때문에 화면이 계속 새로고침되는 문제를 막는다) |
| `npm test` | 단위 테스트 + 실시간 서버 통합 테스트 + 토론 하루 흐름 테스트 (PGlite) |
| `npm run test:postgres` | 토론 하루 흐름 테스트를 운영과 같은 DB 드라이버(postgres.js)로 |
| `npm run typecheck` | 웹·서버 타입 검사 |
| `npm run assets:ph` | 임시 에셋(GLB 등)을 다시 만든다 (`-- --map`이면 마을 맵도 새로 만든다) |
| `npm run assets:check` | 에셋 규칙·용량·남은 `_ph` 목록 검사 |
| `npm run build` | 에셋 검사 후 웹 빌드 |
| `npm run start:server` | 실시간 서버만 실행 (배포용) |

## 구조

```
src/app/                 Next.js 화면 (입장, 마을, 토론)
src/components/plaza/    3D 마을과 전체 지도 (React Three Fiber)
src/components/debate/   오늘의 토론 화면, 결과 카드, 로그인
src/app/api/             토론·로그인 API (규칙 검사 후 DB 쓰기)
src/server/              서버 전용: DB 연결, 토론 저장소·규칙(service)
supabase/migrations/     DB 스키마 (Supabase와 로컬 PGlite가 같은 SQL을 쓴다)
src/shared/              웹과 서버가 함께 쓰는 규칙 (맵, 길찾기, 이동 검사, 메시지 규약, 캐릭터 규약, 토론 규칙, 땅따먹기, 금지어, 주제 목록)
src/config/game.ts       운영 중 바꿀 값 (방 정원, 전송 빈도, 땅 가져오는 비율 등)
src/design/              디자인 토큰, MBTI 유형 정보
server/                  실시간 서버 (Colyseus)
scripts/                 임시 에셋·마을 맵 생성, 에셋 검사
public/assets/           에셋 (manifest.json 키로만 불러온다)
```
