# 배포 안내

MBTI 마을을 인터넷 주소로 띄우는 순서입니다. 처음 한 번 설정하면, 그 뒤로는 `main`에 올릴 때마다 자동으로 다시 배포됩니다.
서비스 화면의 메뉴 이름은 조금씩 바뀔 수 있어서, 막히면 각 단계에 적어 둔 공식 문서를 보세요.

## 전체 그림

| 무엇 | 어디에 | 하는 일 | 비용 |
|---|---|---|---|
| 웹 화면 (Next.js) | Vercel | 입장, 광장 화면, 오늘의 토론, 로그인, 토론 API | Hobby 무료 (개인·비상업용. 수익을 내면 Pro) |
| 광장 실시간 서버 (Colyseus) | Render | 광장 접속, 이동·몸짓 동기화, 채널 나누기 | Free 무료 (15분 쉬면 잠듦. 운영은 Starter 권장) |
| DB와 로그인 | Supabase | 토론 데이터, 카카오·구글·이메일 로그인 | Free 무료 (일주일 동안 쓰지 않으면 일시 정지) |

웹 화면은 Vercel에 두고, 광장 서버만 Render에 따로 둡니다. Vercel은 오래 연결을 유지하는 웹소켓 서버를 돌릴 수 없기 때문입니다.

준비물: GitHub 계정, 그리고 Supabase·Render·Vercel 계정 (셋 다 GitHub로 가입할 수 있습니다).

순서: **0. GitHub 정리 → 1. Supabase → 2. Render → 3. Vercel → 4. 로그인 설정 → 5. 확인**

---

## 0. GitHub 정리 (권장)

저장소 Settings에서:

1. **General → Default branch** 를 `main` 으로 바꿉니다.
2. **Branches** 에서 예전 브랜치 `feature/scroll-template`, `gh-pages` 를 지웁니다.
3. (선택) **General → Repository name** 을 `MBTI-town` 으로 바꿉니다.

기본 브랜치를 바꾸지 않았다면, 아래 Render와 Vercel에서 브랜치를 고를 때 꼭 `main` 을 고르세요.

---

## 1. Supabase: DB와 로그인

### 1-1. 프로젝트 만들기

1. https://supabase.com 에서 **New project**.
2. Region은 **Northeast Asia (Seoul)** 를 고릅니다. 한국 사용자에게 가장 빠릅니다.
3. **Database Password** 는 따로 적어 둡니다. 아래 DB 주소에 들어갑니다.

### 1-2. 표 만들기 (마이그레이션)

왼쪽 메뉴 **SQL Editor → New query** 에서 아래 두 파일 내용을 **순서대로** 붙여 넣고 각각 **Run** 합니다.

1. `supabase/migrations/20261102000000_debate.sql`
2. `supabase/migrations/20261102010000_spectator_judging.sql`

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

## 2. Render: 광장 실시간 서버

저장소의 `render.yaml` 이 설정을 담고 있습니다.

1. https://render.com 에서 **New → Blueprint**.
2. GitHub 저장소를 연결하고, 브랜치 `main` 을 고릅니다.
3. `render.yaml` 을 읽어 `mbti-town-realtime` 서비스를 보여 주면 **Apply** (또는 Deploy Blueprint).
4. 배포가 끝나면 서비스 주소를 복사합니다. 예: `https://mbti-town-realtime.onrender.com` (이름이 겹치면 뒤에 글자가 붙습니다)
5. 확인: 브라우저로 `주소/__healthcheck` 를 열어 오류 없이 열리면 됩니다.

Free 플랜은 15분 동안 접속이 없으면 잠들고, 다음 사람이 광장에 들어올 때 깨어나는 데 1분 가까이 걸립니다. 실제로 사람을 받기 시작하면 서비스 Settings에서 **Instance Type** 을 Starter로 올리세요.

공식 문서: https://render.com/docs/infrastructure-as-code

---

## 3. Vercel: 웹 화면

1. https://vercel.com 에서 **Add New → Project**, GitHub 저장소를 **Import**.
2. Framework는 Next.js로 자동 인식됩니다. 빌드 명령은 그대로 둡니다 (`npm run build`).
3. **Environment Variables** 에 아래 값을 넣고 **Deploy**.

| 이름 | 값 | 필수 |
|---|---|---|
| `NEXT_PUBLIC_REALTIME_URL` | 2단계 Render 주소 (`https://…onrender.com`, 끝에 `/` 없이) | 필수 |
| `DATABASE_URL` | 1-3의 Transaction pooler 주소 | 필수 |
| `NEXT_PUBLIC_SUPABASE_URL` | 1-3의 Project URL | 필수 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 1-3의 Publishable key | 필수 |
| `NEXT_PUBLIC_AUTH_PROVIDERS` | 비워 둡니다. 4단계에서 소셜 로그인을 켠 뒤 `kakao,google` 처럼 적습니다 | 선택 |
| `CRON_SECRET` | 아무 긴 무작위 문자열 (6단계) | 선택 |

4. 기본 브랜치를 `main` 으로 바꾸지 않았다면: Project **Settings → Git → Production Branch** 를 `main` 으로 바꾸고 **Deployments → Redeploy**.
5. 배포가 끝나면 주소가 나옵니다. 예: `https://mbti-town.vercel.app`

> `NEXT_PUBLIC_` 으로 시작하는 값은 빌드할 때 화면 코드에 들어갑니다. 바꾼 뒤에는 꼭 **Redeploy** 해야 반영됩니다.

`vercel.json` 이 서버 함수를 서울 지역(`icn1`)에서 돌리도록 정해 둡니다. Supabase 서울과 가까워야 토론 화면이 빠릅니다.

공식 문서: https://vercel.com/docs/projects/environment-variables

---

## 4. 로그인 설정 (Supabase)

### 4-1. 주소 등록 (필수)

Supabase **Authentication → URL Configuration**:

- **Site URL**: Vercel 주소 (예: `https://mbti-town.vercel.app`)
- **Redirect URLs** 에 추가: `https://mbti-town.vercel.app/auth/callback`

이게 없으면 로그인 뒤 `/login?error=1` 로 돌아옵니다.

### 4-2. 이메일 로그인 (기본으로 켜져 있음)

로그인 화면의 "이메일로 로그인 링크 받기"가 바로 동작합니다.
다만 Supabase 기본 메일 발송은 시간당 보낼 수 있는 수가 아주 적어서 테스트용입니다. 실제로 사람을 받기 전에 **Authentication → Emails (SMTP Settings)** 에서 메일 발송 서비스를 연결하세요.

### 4-3. 카카오 로그인 (선택)

1. https://developers.kakao.com 에서 애플리케이션을 만들고 **카카오 로그인** 을 켭니다.
2. Redirect URI에 `https://<프로젝트 ID>.supabase.co/auth/v1/callback` 을 넣습니다. (Supabase의 Kakao 설정 화면에 정확한 주소가 나옵니다)
3. REST API 키와 Client Secret을 Supabase **Authentication → Sign In / Providers → Kakao** 에 넣고 켭니다.

동의 항목과 키 위치는 공식 문서를 따르세요: https://supabase.com/docs/guides/auth/social-login/auth-kakao

### 4-4. 구글 로그인 (선택)

1. Google Cloud Console에서 OAuth 클라이언트(웹 애플리케이션)를 만들고, 승인된 리디렉션 URI에 같은 Supabase 콜백 주소를 넣습니다.
2. 클라이언트 ID와 보안 비밀을 Supabase **Providers → Google** 에 넣고 켭니다.

공식 문서: https://supabase.com/docs/guides/auth/social-login/auth-google

### 4-5. 로그인 화면에 버튼 보이기

Vercel 환경변수 `NEXT_PUBLIC_AUTH_PROVIDERS` 에 켠 것만 적고 Redeploy 합니다. 예: `kakao,google` (카카오만 켰다면 `kakao`)
켜지 않은 로그인 버튼이 보이면 누를 때 오류가 나니, Supabase에서 켠 것만 적으세요.

---

## 5. 확인

휴대폰과 PC로 Vercel 주소에 들어가서 차례로 확인합니다.

- [ ] 입장 화면에서 MBTI를 고르고 광장에 들어간다 (Render가 자고 있었다면 첫 접속에 1분쯤 걸린다)
- [ ] 두 기기가 같은 채널에서 서로 보이고, 이동·이모티콘이 상대 화면에 나온다
- [ ] 광장의 **오늘의 토론** 버튼이나 게시판을 누르면 토론 화면이 열린다
- [ ] 로그인하고 내 MBTI를 정한다
- [ ] 출전 팀이면 논거를 낸다. 비하 표현이 있으면 거부된다
- [ ] 18시 뒤 관전 유형 계정으로 대표 논거 하나를 고른다
- [ ] 21시 뒤 토론 화면에 결과와 결과 카드가 나온다

---

## 6. 예약 작업 (선택)

결과는 21시가 지나고 누군가 토론 화면에 처음 들어올 때 바로 집계되므로, 예약 작업이 없어도 됩니다.
미리 집계해 두고 싶으면 Vercel 환경변수 `CRON_SECRET` 을 넣으세요. `vercel.json` 에 매일 21:01(한국 시간)에 `/api/cron/debate` 를 부르는 예약이 들어 있고, Vercel이 이 값을 헤더에 붙여 부릅니다. Hobby 플랜은 정해진 시각부터 한 시간 안에 실행됩니다.

---

## 7. 그다음부터

- `main` 에 올리면 Vercel과 Render가 알아서 다시 배포합니다.
- DB 표 구조가 바뀌면 `supabase/migrations/` 의 새 파일만 SQL Editor에서 실행합니다.
- 운영 DB 경로는 로컬에서 `npm run test:postgres` 로 확인할 수 있습니다 (운영과 같은 드라이버로 토론 하루 흐름을 돌립니다).

---

## 문제 해결

| 증상 | 확인할 것 |
|---|---|
| 광장에서 "광장 서버에 연결하지 못했어요" | `NEXT_PUBLIC_REALTIME_URL` 이 Render 주소와 같은지 (`https://`, 끝에 `/` 없이). 바꿨다면 Redeploy. Render Free가 자고 있었다면 1분 뒤 다시 |
| 토론 화면 "잠시 후 다시 시도해 주세요" | `DATABASE_URL` 이 Transaction pooler(포트 6543) 주소이고 비밀번호가 맞는지. 1-2의 SQL 두 개를 실행했는지. Vercel **Logs** 에서 오류 확인 |
| 로그인 뒤 `/login?error=1` | 4-1의 Redirect URLs에 `…/auth/callback` 이 있는지 |
| 카카오·구글 버튼을 누르면 오류 | Supabase에서 그 로그인을 켰는지, `NEXT_PUBLIC_AUTH_PROVIDERS` 에 켠 것만 적었는지 |
| 로그인 메일이 안 옴 | Supabase 기본 메일 발송 한도. 4-2의 SMTP 설정 |
| 일주일 뒤 사이트가 안 됨 | Supabase Free 프로젝트가 일시 정지됨. Supabase 대시보드에서 다시 시작 |
