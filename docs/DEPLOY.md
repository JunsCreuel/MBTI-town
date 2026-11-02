# 배포 안내

SCENE(PROJECT SCENE)을 인터넷 주소로 띄우는 순서입니다. 처음 한 번 설정하면, 그 뒤로는 `main`에 올릴 때마다 자동으로 다시 배포됩니다.
서비스 화면의 메뉴 이름은 조금씩 바뀔 수 있어서, 막히면 각 단계에 적어 둔 공식 문서를 보세요.

## 전체 그림

| 무엇 | 어디에 | 하는 일 | 비용 |
|---|---|---|---|
| 웹 화면과 API (Next.js) | Vercel | 나의 방, 마을, 기록, 설정, 친구 방 방문, 오늘의 토론, 로그인 | Hobby 무료 (개인·비상업용. 수익을 내면 Pro) |
| DB와 로그인 | Supabase | 프로필·방·기록·사진·친구·방명록·토론 데이터, 카카오·구글·이메일 로그인 | Free 무료 (DB 500MB, 일주일 동안 쓰지 않으면 일시 정지) |

1차 출시에는 실시간 서버가 없어서 두 곳이면 됩니다. (이전 버전의 Render 설정은 쓰지 않습니다)

준비물: GitHub 계정, 그리고 Supabase·Vercel 계정 (둘 다 GitHub로 가입할 수 있습니다).

순서: **0. GitHub 정리 → 1. Supabase → 2. Vercel → 3. 로그인 설정 → 4. 확인**

---

## 0. GitHub 정리 (권장)

저장소 Settings에서:

1. **General → Default branch** 를 `main` 으로 바꿉니다.
2. **Branches** 에서 예전 브랜치 `feature/scroll-template`, `gh-pages` 를 지웁니다.
3. (선택) **General → Repository name** 을 정식 서비스 이름이 정해지면 바꿉니다.

기본 브랜치를 바꾸지 않았다면, 아래 Vercel에서 브랜치를 고를 때 꼭 `main` 을 고르세요.

---

## 1. Supabase: DB와 로그인

### 1-1. 프로젝트 만들기

1. https://supabase.com 에서 **New project**.
2. Region은 **Northeast Asia (Seoul)** 를 고릅니다. 한국 사용자에게 가장 빠릅니다.
3. **Database Password** 는 따로 적어 둡니다. 아래 DB 주소에 들어갑니다.

### 1-2. 표 만들기 (마이그레이션)

왼쪽 메뉴 **SQL Editor → New query** 에서 아래 세 파일 내용을 **순서대로** 붙여 넣고 각각 **Run** 합니다.

1. `supabase/migrations/20261102000000_debate.sql`
2. `supabase/migrations/20261102010000_spectator_judging.sql`
3. `supabase/migrations/20261102020000_scene.sql` (나의 방, 기록, 사진, 친구, 방명록, 차단, 신고, 방문)

모든 표는 보안 규칙(RLS)으로 잠겨 있어서, 브라우저에서 직접 읽거나 쓸 수 없습니다. 읽기·쓰기는 모두 웹 서버(Vercel)가 규칙을 검사한 뒤에 합니다.

> 나중에 `supabase/migrations/` 에 새 파일이 생기면, 그 파일만 같은 방법으로 실행하면 됩니다.

### 1-3. 값 세 개 복사하기

| 값 | 어디서 | 넣을 곳 |
|---|---|---|
| Project URL (`https://xxxx.supabase.co`) | Project Settings → API (또는 상단 **Connect**) | `NEXT_PUBLIC_SUPABASE_URL` |
| Publishable key (예전 이름: anon public key) | Project Settings → API Keys | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| DB 접속 주소: **Transaction pooler**, 포트 `6543` | 상단 **Connect** → Connection string → Transaction pooler | `DATABASE_URL` |

DB 접속 주소의 `[YOUR-PASSWORD]` 는 1-1에서 정한 비밀번호로 바꿉니다.
이 주소에는 비밀번호가 들어 있으니 Vercel 환경변수에만 넣고, 코드나 채팅에 붙여 넣지 마세요.

---

## 2. Vercel: 웹 화면

1. https://vercel.com 에서 **Add New → Project**, GitHub 저장소를 **Import**.
2. Framework는 Next.js로 자동 인식됩니다. 빌드 명령은 그대로 둡니다 (`npm run build`).
3. **Environment Variables** 에 아래 값을 넣고 **Deploy**.

| 이름 | 값 | 필수 |
|---|---|---|
| `DATABASE_URL` | 1-3의 Transaction pooler 주소 | 필수 |
| `NEXT_PUBLIC_SUPABASE_URL` | 1-3의 Project URL | 필수 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 1-3의 Publishable key | 필수 |
| `NEXT_PUBLIC_AUTH_PROVIDERS` | 비워 둡니다. 3단계에서 소셜 로그인을 켠 뒤 `kakao,google` 처럼 적습니다 | 선택 |
| `CRON_SECRET` | 아무 긴 무작위 문자열 (5단계) | 선택 |

4. 기본 브랜치를 `main` 으로 바꾸지 않았다면: Project **Settings → Git → Production Branch** 를 `main` 으로 바꾸고 **Deployments → Redeploy**.
5. 배포가 끝나면 주소가 나옵니다. 예: `https://scene.vercel.app`

> `NEXT_PUBLIC_` 으로 시작하는 값은 빌드할 때 화면 코드에 들어갑니다. 바꾼 뒤에는 꼭 **Redeploy** 해야 반영됩니다.

`vercel.json` 이 서버 함수를 서울 지역(`icn1`)에서 돌리도록 정해 둡니다. Supabase 서울과 가까워야 방과 기록이 빨리 열립니다.

공식 문서: https://vercel.com/docs/projects/environment-variables

---

## 3. 로그인 설정 (Supabase)

### 3-1. 주소 등록 (필수)

Supabase **Authentication → URL Configuration**:

- **Site URL**: Vercel 주소 (예: `https://scene.vercel.app`)
- **Redirect URLs** 에 추가: `https://scene.vercel.app/auth/callback`

이게 없으면 로그인 뒤 `/login?error=1` 로 돌아옵니다.

### 3-2. 이메일 로그인 (기본으로 켜져 있음)

로그인 화면의 "이메일로 로그인 링크 받기"가 바로 동작합니다.
다만 Supabase 기본 메일 발송은 시간당 보낼 수 있는 수가 아주 적어서 테스트용입니다. 실제로 사람을 받기 전에 **Authentication → Emails (SMTP Settings)** 에서 메일 발송 서비스를 연결하세요.

### 3-3. 카카오 로그인 (선택)

1. https://developers.kakao.com 에서 애플리케이션을 만들고 **카카오 로그인** 을 켭니다.
2. Redirect URI에 `https://<프로젝트 ID>.supabase.co/auth/v1/callback` 을 넣습니다. (Supabase의 Kakao 설정 화면에 정확한 주소가 나옵니다)
3. REST API 키와 Client Secret을 Supabase **Authentication → Sign In / Providers → Kakao** 에 넣고 켭니다.

동의 항목과 키 위치는 공식 문서를 따르세요: https://supabase.com/docs/guides/auth/social-login/auth-kakao

### 3-4. 구글 로그인 (선택)

1. Google Cloud Console에서 OAuth 클라이언트(웹 애플리케이션)를 만들고, 승인된 리디렉션 URI에 같은 Supabase 콜백 주소를 넣습니다.
2. 클라이언트 ID와 보안 비밀을 Supabase **Providers → Google** 에 넣고 켭니다.

공식 문서: https://supabase.com/docs/guides/auth/social-login/auth-google

### 3-5. 로그인 화면에 버튼 보이기

Vercel 환경변수 `NEXT_PUBLIC_AUTH_PROVIDERS` 에 켠 것만 적고 Redeploy 합니다. 예: `kakao,google` (카카오만 켰다면 `kakao`)
켜지 않은 로그인 버튼이 보이면 누를 때 오류가 나니, Supabase에서 켠 것만 적으세요.

---

## 4. 확인

휴대폰과 PC로 Vercel 주소에 들어가서 차례로 확인합니다.

- [ ] 첫 화면 → 시작하기 → 로그인 → 7단계(취향, 거주지, 캐릭터, 첫 집, BGM, 이름)를 마치면 나의 방이 열린다
- [ ] 바닥을 누르면 캐릭터가 걸어가고, 턴테이블이나 플레이어를 누르면 BGM이 나온다 (자동 재생은 하지 않는다)
- [ ] 연필 버튼으로 소품을 추가·이동·돌리기·빼기, 벽지·바닥을 바꾸고 저장하면 다시 들어와도 그대로다
- [ ] 기록 탭에서 감정 기록과 사진 붙인 일상 기록을 남긴다 (기본 나만 보기)
- [ ] 다른 계정으로 내 방 주소(`/r/주소`)에 들어가 친구 신청과 방명록을 남긴다
- [ ] 친구 신청을 수락하면 친구 공개 기록과 사진이 보인다
- [ ] 마을 탭에서 지역을 누르면 공개 방이 보이고, 중앙광장에 오늘의 토론 이벤트가 보인다
- [ ] MY에서 공개 범위를 '나만'으로 바꾸면 다른 계정에서 방이 보이지 않는다
- [ ] MY에서 기록 내보내기 파일을 받을 수 있다

---

## 5. 예약 작업 (선택)

오늘의 토론 결과는 21시가 지나고 누군가 토론 화면이나 마을 탭에 처음 들어올 때 바로 집계되므로, 예약 작업이 없어도 됩니다.
미리 집계해 두고 싶으면 Vercel 환경변수 `CRON_SECRET` 을 넣으세요. `vercel.json` 에 매일 21:01(한국 시간)에 `/api/cron/debate` 를 부르는 예약이 들어 있고, Vercel이 이 값을 헤더에 붙여 부릅니다. Hobby 플랜은 정해진 시각부터 한 시간 안에 실행됩니다.

---

## 6. 그다음부터

- `main` 에 올리면 Vercel이 알아서 다시 배포합니다.
- DB 표 구조가 바뀌면 `supabase/migrations/` 의 새 파일만 SQL Editor에서 실행합니다.
- 운영 DB 경로는 로컬에서 `npm run test:postgres` 로 확인할 수 있습니다 (운영과 같은 드라이버로 미니홈피 규칙과 토론 하루 흐름을 돌립니다).
- 사진은 1차에서 DB에 저장합니다 (한 장 800KB 이하). Supabase Free DB는 500MB라 사용자가 늘면 Supabase Storage로 옮겨야 합니다.

---

## 문제 해결

| 증상 | 확인할 것 |
|---|---|
| 화면마다 "잠시 후 다시 시도해 주세요" | `DATABASE_URL` 이 Transaction pooler(포트 6543) 주소이고 비밀번호가 맞는지. 1-2의 SQL 세 개를 모두 실행했는지. Vercel **Logs** 에서 오류 확인 |
| 사진을 올리면 "사진이 너무 커요" | 화면에서 긴 변 1600px JPEG로 줄여 올립니다. 그래도 크면 `recordConfig.photoMaxBytes` 확인 |
| 로그인 뒤 `/login?error=1` | 3-1의 Redirect URLs에 `…/auth/callback` 이 있는지 |
| 카카오·구글 버튼을 누르면 오류 | Supabase에서 그 로그인을 켰는지, `NEXT_PUBLIC_AUTH_PROVIDERS` 에 켠 것만 적었는지 |
| 로그인 메일이 안 옴 | Supabase 기본 메일 발송 한도. 3-2의 SMTP 설정 |
| 일주일 뒤 사이트가 안 됨 | Supabase Free 프로젝트가 일시 정지됨. Supabase 대시보드에서 다시 시작 |
