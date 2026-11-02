# SCENE (PROJECT SCENE, 임시 이름)

나의 취향과 일상을 하나의 공간에 담는 미니홈피. 3D 아이소메트릭 방을 꾸미고, 음악과 기록을 남기고, 친구 방에 놀러 간다.
게시물이 아니라 공간이 프로필이다. 개발 기준은 [PROJECT_GUIDE.md](PROJECT_GUIDE.md)를 따른다.

> 이전 버전(MBTI 마을: 3D 섬, 실시간 광장, 땅따먹기)은 `archive/v0-mbti-town` 브랜치에 있다.

## 지금 되는 것 (1차 출시 범위)

- **첫 가입 7단계**: 세계 입장 → 취향(색·분위기·음악, MBTI·생년월일은 선택) → 거주지 추천(오행 다섯 지역) → 캐릭터 → 첫 집 → 첫 BGM → 이름·프로필 문구
- **나의 방 (HOME)**: 3D 아이소메트릭 미니룸. 바닥을 누르면 캐릭터가 걷고, 기능 소품을 누르면 열린다
  - 턴테이블 = BGM, 책상 = 기록, 우편함 = 방명록, 옷장 = 캐릭터, 액자 = 사진, 창문 = 거주 지역 풍경과 시간대
  - 꾸미기: 소품 16종 추가·이동·돌리기·빼기, 벽지 8종·바닥 5종, 대표 BGM
- **BGM**: 권리 걱정 없는 오리지널 임시 곡 6곡. 자동 재생하지 않는다
- **기록 (ARCHIVE)**: 감정(7가지)·일상(글+사진)·메모. 기본 나만 보기, 기록마다 공개 범위. 사진첩
- **마을 (EXPLORE)**: 다섯 지역 + 중앙광장 지도, 지역별 공개 방, 새로 온 주민, 친구 방, 오늘의 토론 이벤트
- **소셜**: 친구 신청·수락, 방 링크 공유(`/r/주소`), 방명록(공개·친구만), 방문 기록(끌 수 있음), 신고·차단
- **MY**: 프로필·주소, 이사, MBTI·생년월일, 방 공개 범위(전체·친구만·나만), 발견 끄기, 친구·차단 관리, 기록 내보내기(JSON)·전체 삭제
- **오늘의 토론**: 중앙광장 이벤트. MBTI 유형끼리 논거를 쓰고, 다른 유형이 관전 판정한다 (MBTI를 넣은 사람만 참여)
- **로그인**: Supabase Auth (카카오·구글·이메일 링크). 설정이 없으면 로컬에서 개발용 로그인

공개 범위와 차단은 서버(`src/server/scene/service.ts`)가 검사한다. 화면에서 숨기는 것만으로 끝내지 않는다.

## 키 없이 바로 해 보기

Supabase 없이도 로컬에서 전체 흐름이 돌아간다. DB는 PGlite(파일에 저장되는 Postgres, `~/.mbti-town/pglite`), 로그인은 개발용을 쓴다.

```bash
npm install
```

```bash
npm run dev
```

http://localhost:3000 에서 **시작하기 → 개발용으로 로그인** 으로 들어간다. 다른 사람 방을 보려면 다른 브라우저(또는 시크릿 창)로 한 번 더 가입한다.

오늘의 토론 하루 흐름을 기다리지 않고 보려면 개발용 시계를 앞으로 돌린다.

```bash
curl -X POST localhost:3000/api/dev/clock -H 'content-type: application/json' -d '{"addMinutes": 600}'
```

## 배포

웹 화면과 API는 Vercel, DB와 로그인은 Supabase에 둔다. 순서와 설정값은 [docs/DEPLOY.md](docs/DEPLOY.md)를 따른다. 설정 파일: `vercel.json`, `.env.example`.

## 명령

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 웹을 띄운다 (시작할 때 `.next/dev` 를 비운다: 운영 빌드 뒤 남은 개발 캐시로 화면이 계속 새로고침되는 문제를 막는다) |
| `npm test` | 방 배치·지역 추천·기록 규칙, 미니홈피 서버 규칙(공개 범위·친구·방명록·차단·사진 권한), 토론 하루 흐름 (PGlite) |
| `npm run test:postgres` | 서버 규칙 테스트를 운영과 같은 DB 드라이버(postgres.js)로 |
| `npm run typecheck` | 타입 검사 |
| `npm run assets:ph` | 임시 에셋(가구 GLB, 창밖 풍경, 아이콘, 안내 캐릭터, BGM)을 다시 만든다. BGM 인코딩에 ffmpeg가 필요하다 (`-- --no-audio` 면 BGM은 건너뛴다) |
| `npm run assets:check` | 에셋 규칙·용량·남은 `_ph` 목록 검사 |
| `npm run build` | 에셋 검사 후 웹 빌드 |

## 구조

```
src/app/                    화면 (첫 화면, 온보딩, home, explore, archive, my, r/[handle], debate)과 API
src/components/room/        3D 미니룸 (React Three Fiber): 장면, 캐릭터, 꾸미기, 방명록
src/components/onboarding/  첫 가입 7단계
src/components/home/        나의 방 화면과 꾸미기 HUD
src/components/explore/     마을 지도
src/components/archive/     기록·사진첩
src/components/my/          설정
src/components/debate/      오늘의 토론 (중앙광장 이벤트), 결과 카드, 로그인
src/server/scene/           미니홈피 저장소와 규칙 (공개 범위·차단 검사)
src/server/debate/          토론 저장소와 규칙
src/shared/                 화면과 서버가 함께 쓰는 규칙 (방 배치, 지역 추천, 기록, 캐릭터, BGM 목록, 토론, 금지어)
src/config/game.ts          운영 중 바꿀 값 (방 크기, 소품 수, 글자 수, 토론 시간표)
src/design/                 디자인 토큰, MBTI 유형 정보
supabase/migrations/        DB 스키마 (Supabase와 로컬 PGlite가 같은 SQL을 쓴다)
scripts/                    임시 에셋 생성(가구 모델, 풍경, BGM), 에셋 검사
public/assets/              에셋 (manifest.json 키로만 불러온다)
```
