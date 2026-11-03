# SCENE (PROJECT SCENE, 임시 이름)

걸어 다니는 3D 마을에 내 집이 있고, 문을 열면 나만의 방(미니홈피)이 있다. 마을에서 이웃을 만나고, 방을 꾸미고, 음악과 기록을 남긴다.
게시물이 아니라 공간이 프로필이다. 개발 기준은 [PROJECT_GUIDE.md](PROJECT_GUIDE.md)를 따른다.

> 이전 버전(MBTI 16개 마을, 땅따먹기)은 `archive/v0-mbti-town` 브랜치에 있다.

## 지금 되는 것 (1차 출시 범위)

- **마을 (기본 틀)**: 중앙광장을 다섯 지역(오행)이 둘러싼 3D 섬을 여러 사람이 실시간으로 같이 걷는다
  - 지역마다 본섬 집터 20곳. 가입하면 고른 지역에 내 집이 서고, 접속하면 내 집 문 앞에서 시작한다. 문 앞의 "들어가기" = 나의 방
  - 1동이 다 차면 그 지역 2동(집터 24곳), 2동이 다 차면 3동… 새 동네가 열린다. 본섬 큰길 끝 "동네 길" 아치로 오간다
  - 이웃 집을 누르면 그 집 앞으로 가고 "놀러 가기". 이름표는 내 집·친구 집·공개 방만, 차단한 사람은 화면에서 숨긴다
  - 몸짓 7가지(응원·박수·안녕·꾸벅·춤·폴짝·갸웃)와 이모티콘 9가지로 소통 (자유 채팅 없음). 이름표 아래에 MBTI·일주가 보인다. 전체 지도에서 지역·광장·내 집으로 바로 가기. 채널당 100명
  - 카메라: ⟲ ⟳ 버튼(Q/E)이나 바닥을 옆으로 끌어 돌리기, 시점 버튼(V)으로 기본·가까이·멀리, R = 정면
  - 로그인하지 않으면 손님으로 구경
- **첫 가입 7단계**: 세계 입장 → 나의 사주(이름·생년월일 양력/음력·태어난 시간, 모름 가능) → 나의 지역(사주의 일간 오행으로 자동 배정) → 캐릭터 → 첫 집 → 첫 BGM → 이름·프로필 문구 → 마을의 내 집 앞
- **사주**: 절기 기준 년주·월주, 서울 지방시 기준 일주·시주, 음력·윤달, 지난 서머타임 반영. 생일을 고치면 사는 지역도 다시 정해진다 (`src/server/saju.ts`)
- **나의 방 (HOME)**: 마을 속 내 집 안. 문을 열면 "방에 들어가는 중…"을 지나 집 안 3D 공간으로 들어간다. 바닥을 누르면 캐릭터가 걷고, 휠·두 손가락으로 다가가면 캐릭터를 따라가며, 기능 소품을 누르면 열린다. 방향키·WASD로도 걷는다
  - 친구 방에 놀러 가면 내 캐릭터로 걷고, 주인이나 다른 손님이 있으면 같은 방에서 서로 보인다 (집마다 실시간 방)
  - 턴테이블 = BGM, 책상 = 기록, 우편함 = 방명록, 옷장 = 캐릭터, 액자 = 사진, 창문 = 거주 지역 풍경과 시간대
  - 꾸미기: 소품 16종 추가·이동·돌리기·빼기, 벽지 8종·바닥 5종, 대표 BGM
- **BGM**: 권리 걱정 없는 오리지널 임시 곡 6곡. 자동 재생하지 않는다
- **기록 (ARCHIVE)**: 감정(7가지)·일상(글+사진)·메모. 기본 나만 보기, 기록마다 공개 범위. 사진첩
- **둘러보기**: 지역별 공개 방, 새로 온 주민, 친구 방, 오늘의 토론 이벤트 (마을 탭 안)
- **소셜**: 친구 신청·수락, 방 링크 공유(`/r/주소`), 방명록(공개·친구만), 방문 기록(끌 수 있음), 신고·차단
- **MY**: 프로필·주소, 나의 사주(생일 고치기 → 사는 지역 다시 정하기), MBTI, 방 공개 범위(전체·친구만·나만), 발견 끄기, 친구·차단 관리, 기록 내보내기(JSON)·전체 삭제
- **오늘의 토론**: 중앙광장 이벤트. 하루에 두 지역(오행)이 맞붙어 논거를 쓰고, 나머지 세 지역 주민이 관전 판정한다. MBTI는 프로필 태그
- **로그인**: Supabase Auth (카카오·구글·이메일 링크). 설정이 없으면 로컬에서 개발용 로그인

공개 범위와 차단은 서버(`src/server/scene/service.ts`)가 검사한다. 화면에서 숨기는 것만으로 끝내지 않는다.
마을 실시간 서버는 웹 서버가 서명한 입장 토큰(`src/shared/townToken.ts`)만 믿고, 위치는 이동 속도와 막힌 칸으로 다시 검사한다.

## 키 없이 바로 해 보기

Supabase 없이도 로컬에서 전체 흐름이 돌아간다. DB는 PGlite(파일에 저장되는 Postgres, `~/.mbti-town/pglite`), 로그인은 개발용을 쓴다.
`npm run dev` 가 웹(3000)과 마을 실시간 서버(2567)를 같이 띄운다.

```bash
npm install
```

```bash
npm run dev
```

http://localhost:3000 에서 **시작하기 → 개발용으로 로그인** 으로 들어간다. 가입을 마치면 마을의 내 집 앞에서 시작한다. 같이 걷는 모습을 보려면 다른 브라우저(또는 시크릿 창)로 한 번 더 가입한다.

오늘의 토론 하루 흐름을 기다리지 않고 보려면 개발용 시계를 앞으로 돌린다.

```bash
curl -X POST localhost:3000/api/dev/clock -H 'content-type: application/json' -d '{"addMinutes": 600}'
```

## 배포

웹 화면과 API는 Vercel, 마을 실시간 서버는 Render, DB와 로그인은 Supabase에 둔다. 순서와 설정값은 [docs/DEPLOY.md](docs/DEPLOY.md)를 따른다. 설정 파일: `vercel.json`, `render.yaml`, `.env.example`.

## 명령

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 웹과 마을 실시간 서버를 같이 띄운다 (웹은 시작할 때 `.next/dev` 를 비운다: 운영 빌드 뒤 남은 개발 캐시로 화면이 계속 새로고침되는 문제를 막는다) |
| `npm run start:server` | 마을 실시간 서버만 띄운다 (운영, Render) |
| `npm test` | 마을 맵·길찾기·이동 검사·입장 토큰, 실시간 서버(실제 접속), 집터 배정, 방 배치·지역 추천·기록 규칙, 미니홈피 서버 규칙(공개 범위·친구·방명록·차단·사진 권한), 토론 하루 흐름 (PGlite) |
| `npm run test:postgres` | 서버 규칙 테스트를 운영과 같은 DB 드라이버(postgres.js)로 |
| `npm run typecheck` | 타입 검사 |
| `npm run assets:kenney -- "<폴더>/Models/GLTF format"` | Kenney Nature Kit(CC0, opengameart.org/content/nature-kit)에서 쓰는 자연물을 우리 색·크기로 바꿔 `public/assets/props/nature/`에 넣는다 |
| `npm run db:bundle` | `supabase/migrations/` 를 이어 붙여 `supabase/setup.sql` (Supabase에 한 번에 붙여 넣는 파일)을 다시 만든다. 마이그레이션을 추가하면 실행한다 |
| `npm run assets:ph` | 임시 에셋(마을 소품·가구 GLB, 창밖 풍경, 아이콘, 안내 캐릭터, BGM)을 다시 만든다. 마을 맵은 없을 때만 만든다 (`-- --map` 이면 다시 만든다). BGM 인코딩에 ffmpeg가 필요하다 (`-- --no-audio` 면 BGM은 건너뛴다) |
| `npm run assets:check` | 에셋 규칙·용량·남은 `_ph` 목록 검사 |
| `npm run build` | 에셋 검사 후 웹 빌드 |

## 구조

```
src/app/                    화면 (첫 화면, 온보딩, village, home, explore, archive, my, r/[handle], debate)과 API
src/components/village/     3D 마을 (React Three Fiber): 땅, 소품·집, 캐릭터, 전체 지도, 실시간 연결, HUD
src/components/room/        3D 미니룸 (React Three Fiber): 장면, 캐릭터, 꾸미기, 방명록
src/components/onboarding/  첫 가입 7단계
src/components/home/        나의 방 화면과 꾸미기 HUD
src/components/explore/     둘러보기 (지역별 공개 방)
src/components/archive/     기록·사진첩
src/components/my/          설정
src/components/debate/      오늘의 토론 (중앙광장 이벤트), 결과 카드, 로그인
src/server/scene/           미니홈피 저장소와 규칙 (공개 범위·차단 검사)
src/server/debate/          토론 저장소와 규칙
src/shared/                 화면과 서버가 함께 쓰는 규칙 (마을 맵·이동·길찾기·입장 토큰·메시지 규약, 방 배치, 지역 추천, 기록, 캐릭터, BGM 목록, 토론, 금지어)
server/                     마을 실시간 서버 (Colyseus): 채널, 이동 검사, 몸짓, 지도 이동
src/config/game.ts          운영 중 바꿀 값 (마을 정원·걷는 속도·집터 수, 방 크기, 소품 수, 글자 수, 토론 시간표)
src/design/                 디자인 토큰, MBTI 유형 정보
supabase/migrations/        DB 스키마 (Supabase와 로컬 PGlite가 같은 SQL을 쓴다)
scripts/                    임시 에셋 생성(마을 맵·소품, 가구 모델, 풍경, BGM), 에셋 검사
public/assets/              에셋 (manifest.json 키로만 불러온다)
```
