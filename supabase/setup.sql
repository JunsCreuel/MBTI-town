-- SCENE DB 전체 설정 (자동 생성 파일: 직접 고치지 말고 `npm run db:bundle`로 다시 만든다)
-- Supabase 대시보드 > SQL Editor > New query 에 이 파일 내용을 통째로 붙여 넣고 Run 한다.
-- 여러 번 실행해도 안전하다: 이미 실행한 마이그레이션(public.schema_migrations에 이름이 있는 것)은 건너뛴다.

create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now());
alter table public.schema_migrations enable row level security;

-- ───────── 20261102000000_debate.sql ─────────

do $mig$
begin
  if exists (select 1 from public.schema_migrations where name = '20261102000000_debate.sql') then return; end if;
  execute $sql$
-- MBTI 마을 토론 매치 스키마 (PROJECT_GUIDE.md 6, 7장)
-- 브라우저는 이 테이블에 직접 접근하지 않는다. 읽기와 쓰기는 모두 서버(Next.js API)가 규칙을 검사한 뒤에 한다.
-- 그래서 RLS를 켜고 정책을 두지 않아 anon/authenticated 키로는 아무것도 할 수 없게 막는다.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  mbti text check (mbti ~ '^[EI][SN][TF][JP]$'),
  mbti_changed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.topics (
  id text primary key,
  title text not null,
  side_a text not null,
  side_b text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,                 -- 'YYYY-MM-DD#슬롯' (한국 날짜)
  seq integer not null,                     -- 몇 번째 경기인지 (대진 순환에 쓴다)
  topic_id text references public.topics (id),
  topic jsonb not null,                     -- 경기 당시 주제 (주제를 고쳐도 지난 경기는 그대로)
  team_a jsonb not null,
  team_b jsonb not null,
  opens_at timestamptz not null,
  writing_ends_at timestamptz not null,
  voting_ends_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'judging', 'done')),
  judging_started_at timestamptz,
  result jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists matches_seq_key on public.matches (seq);

create table if not exists public.arguments (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  author_mbti text not null check (author_mbti ~ '^[EI][SN][TF][JP]$'),
  side text not null check (side in ('a', 'b')),
  body text not null check (char_length(body) between 1 and 1000),
  moderation jsonb,
  created_at timestamptz not null default now()
);
create index if not exists arguments_match_idx on public.arguments (match_id, created_at);

create table if not exists public.recommendations (
  argument_id uuid not null references public.arguments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (argument_id, user_id)
);
create index if not exists recommendations_match_user_idx on public.recommendations (match_id, user_id);

create table if not exists public.votes (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  voter_mbti text not null check (voter_mbti ~ '^[EI][SN][TF][JP]$'),
  side text not null check (side in ('a', 'b')),
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.topics enable row level security;
alter table public.matches enable row level security;
alter table public.arguments enable row level security;
alter table public.recommendations enable row level security;
alter table public.votes enable row level security;
$sql$;
  insert into public.schema_migrations (name) values ('20261102000000_debate.sql') on conflict (name) do nothing;
end $mig$;

-- ───────── 20261102010000_spectator_judging.sql ─────────

do $mig$
begin
  if exists (select 1 from public.schema_migrations where name = '20261102010000_spectator_judging.sql') then return; end if;
  execute $sql$
-- 관전 판정: AI 채점을 빼고 관전자가 승패를 정한다.
-- 관전자는 양 팀 대표 논거 중 가장 설득력 있는 하나를 고르고, 그 논거의 팀에 한 표가 간다.
alter table public.votes
  add column if not exists argument_id uuid references public.arguments (id) on delete set null;

create index if not exists votes_match_argument_idx on public.votes (match_id, argument_id);

-- 논거 검사는 금지어 목록으로 한다. 검사 기록 칸은 더 쓰지 않는다.
alter table public.arguments drop column if exists moderation;
$sql$;
  insert into public.schema_migrations (name) values ('20261102010000_spectator_judging.sql') on conflict (name) do nothing;
end $mig$;

-- ───────── 20261102020000_scene.sql ─────────

do $mig$
begin
  if exists (select 1 from public.schema_migrations where name = '20261102020000_scene.sql') then return; end if;
  execute $sql$
-- PROJECT SCENE: 미니홈피, 기록, 소셜 (PROJECT_GUIDE.md 6~11장)
-- 브라우저는 이 테이블에 직접 접근하지 않는다. 서버(Next.js API)가 공개 범위·차단을 검사한 뒤 읽고 쓴다.
-- 그래서 RLS를 켜고 정책을 두지 않는다.

-- 프로필: 미니홈피 주인 정보와 설정
alter table public.profiles add column if not exists handle text unique check (handle ~ '^[a-z0-9_]{3,20}$');
alter table public.profiles add column if not exists display_name text check (char_length(display_name) <= 40);
alter table public.profiles add column if not exists bio text check (char_length(bio) <= 200);
alter table public.profiles add column if not exists district text check (district in ('wood', 'fire', 'earth', 'metal', 'water'));
alter table public.profiles add column if not exists birth_date date;            -- 선택 입력. 출생시간은 받지 않는다
alter table public.profiles add column if not exists taste jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists avatar jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists room_visibility text not null default 'public'
  check (room_visibility in ('public', 'friends', 'private'));
alter table public.profiles add column if not exists show_visits boolean not null default true;
alter table public.profiles add column if not exists discoverable boolean not null default true;
alter table public.profiles add column if not exists onboarded_at timestamptz;
alter table public.profiles add column if not exists last_seen_at timestamptz;

-- 나의 방: 배치 JSON 하나 (타임캡슐은 이 JSON을 날짜와 함께 따로 저장하면 된다)
create table if not exists public.rooms (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  layout jsonb not null,
  bgm text,
  updated_at timestamptz not null default now()
);

-- 사진: 1차에서는 DB에 둔다 (화면에서 줄여 올린다). 사용자가 늘면 Storage로 옮긴다.
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  bytes bytea not null,
  width integer,
  height integer,
  created_at timestamptz not null default now()
);
create index if not exists photos_owner_idx on public.photos (owner_id, created_at desc);

-- 기록: 감정·일상·메모. 기본 나만 보기.
create table if not exists public.records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('emotion', 'daily', 'memo')),
  emotion text check (emotion in ('calm', 'joy', 'flutter', 'tired', 'sad', 'complex', 'angry')),
  body text not null default '' check (char_length(body) <= 4000),
  photo_id uuid references public.photos (id) on delete set null,
  visibility text not null default 'private' check (visibility in ('private', 'friends', 'public')),
  created_at timestamptz not null default now()
);
create index if not exists records_owner_idx on public.records (owner_id, created_at desc);

-- 친구: 신청 → 수락. 두 사람 사이에는 한 줄만 둔다.
create table if not exists public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (requester, addressee),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee_idx on public.friendships (addressee);

-- 방명록
create table if not exists public.guestbook (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 600),
  visibility text not null default 'public' check (visibility in ('friends', 'public')),
  created_at timestamptz not null default now()
);
create index if not exists guestbook_owner_idx on public.guestbook (owner_id, created_at desc);

-- 차단과 신고
create table if not exists public.blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid references public.profiles (id) on delete set null,
  target_kind text not null check (target_kind in ('guestbook', 'record', 'user')),
  target_id uuid not null,
  reason text check (char_length(reason) <= 300),
  created_at timestamptz not null default now()
);

-- 방문 기록: 하루에 한 줄 (방 주인만 본다)
create table if not exists public.visits (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  visitor_id uuid not null references public.profiles (id) on delete cascade,
  visited_on date not null,
  last_at timestamptz not null default now(),
  primary key (owner_id, visitor_id, visited_on)
);
create index if not exists visits_owner_idx on public.visits (owner_id, last_at desc);

alter table public.rooms enable row level security;
alter table public.photos enable row level security;
alter table public.records enable row level security;
alter table public.friendships enable row level security;
alter table public.guestbook enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.visits enable row level security;
$sql$;
  insert into public.schema_migrations (name) values ('20261102020000_scene.sql') on conflict (name) do nothing;
end $mig$;

-- ───────── 20261102030000_town.sql ─────────

do $mig$
begin
  if exists (select 1 from public.schema_migrations where name = '20261102030000_town.sql') then return; end if;
  execute $sql$
-- 마을: 지역마다 정해진 집터에 주민의 집이 선다 (PROJECT_GUIDE.md 3장).
-- house_lot = 그 지역 집터 번호 (0부터, 마을 맵 lots 레이어의 이름 "<지역>.<번호>"와 같다).
-- 집터가 다 찬 지역으로 오면 house_lot이 비어 있다 (마을에 집은 없고 방은 그대로 쓴다).
alter table public.profiles add column if not exists house_lot integer check (house_lot >= 0);
create unique index if not exists profiles_house_lot_key on public.profiles (district, house_lot) where house_lot is not null;

-- 이미 가입한 주민에게 가입 순서대로 집터를 준다. 지역마다 20곳 (src/config/game.ts townConfig.lotsPerDistrict와 같다).
-- 그 지역에 집터를 받은 사람이 아직 없을 때만 채우므로 다시 실행해도 겹치지 않는다.
update public.profiles p
set house_lot = r.n
from (
  select id, district, (row_number() over (partition by district order by onboarded_at, id) - 1)::int as n
  from public.profiles
  where onboarded_at is not null and district is not null and house_lot is null
) r
where p.id = r.id
  and r.n < 20
  and not exists (select 1 from public.profiles q where q.district = r.district and q.house_lot is not null);
$sql$;
  insert into public.schema_migrations (name) values ('20261102030000_town.sql') on conflict (name) do nothing;
end $mig$;

-- ───────── 20261103000000_hoods.sql ─────────

do $mig$
begin
  if exists (select 1 from public.schema_migrations where name = '20261103000000_hoods.sql') then return; end if;
  execute $sql$
-- 새 동네: 지역 1동(본섬) 집터가 다 차면 2동, 2동이 다 차면 3동… 이 열린다 (PROJECT_GUIDE.md 3장).
-- house_hood = 집이 있는 동네 번호 (1 = 본섬). 집터 번호(house_lot)는 동네마다 0부터 센다.
alter table public.profiles add column if not exists house_hood integer not null default 1 check (house_hood >= 1);
drop index if exists public.profiles_house_lot_key;
create unique index if not exists profiles_house_slot_key on public.profiles (district, house_hood, house_lot) where house_lot is not null;
$sql$;
  insert into public.schema_migrations (name) values ('20261103000000_hoods.sql') on conflict (name) do nothing;
end $mig$;

-- ───────── 20261103010000_saju.sql ─────────

do $mig$
begin
  if exists (select 1 from public.schema_migrations where name = '20261103010000_saju.sql') then return; end if;
  execute $sql$
-- 사주로 거주 지역 자동 배정 (PROJECT_GUIDE.md 3장).
-- birth = 사용자가 넣은 생일 그대로 {calendar: solar|lunar, date, leap, time|null}. 본인만 본다.
-- saju  = 계산한 네 기둥과 오행 (화면 표시용). 거주 지역(district)은 saju의 일간 오행이다.
-- birth_date는 양력으로 바꾼 생일을 그대로 쓴다.
alter table public.profiles add column if not exists birth jsonb;
alter table public.profiles add column if not exists saju jsonb;
$sql$;
  insert into public.schema_migrations (name) values ('20261103010000_saju.sql') on conflict (name) do nothing;
end $mig$;

-- ───────── 20261103020000_district_debate.sql ─────────

do $mig$
begin
  if exists (select 1 from public.schema_migrations where name = '20261103020000_district_debate.sql') then return; end if;
  execute $sql$
-- 오늘의 토론을 지역(오행) 대결로 바꾼다 (PROJECT_GUIDE.md 10장).
-- 논거·판정에 지역을 남긴다. MBTI는 토론과 상관없는 프로필 태그라 논거에 선택으로만 남는다.
alter table public.arguments add column if not exists author_district text
  check (author_district in ('wood', 'fire', 'earth', 'metal', 'water'));
alter table public.arguments alter column author_mbti drop not null;
alter table public.votes add column if not exists voter_district text
  check (voter_district in ('wood', 'fire', 'earth', 'metal', 'water'));
alter table public.votes alter column voter_mbti drop not null;

-- 아직 끝나지 않은 MBTI 대결 경기는 지운다 (지금 칸의 경기는 지역 대결로 새로 만들어진다). 끝난 경기 기록은 남긴다.
delete from public.matches where status <> 'done' and coalesce(team_a ->> 'kind', '') <> 'district';
$sql$;
  insert into public.schema_migrations (name) values ('20261103020000_district_debate.sql') on conflict (name) do nothing;
end $mig$;

-- ───────── 20261103030000_play.sql ─────────

do $mig$
begin
  if exists (select 1 from public.schema_migrations where name = '20261103030000_play.sql') then return; end if;
  execute $sql$
-- 놀거리 (PROJECT_GUIDE.md 3장 마을): 열매 따기·운세 열매·낚시와 주민증.
-- 브라우저는 직접 접근하지 않는다. 서버가 하루 횟수를 검사한 뒤 쓴다 (RLS 켜고 정책 없음).

-- 모은 것: 열매·물고기 종류별 개수 (도감)
create table if not exists public.collections (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('fruit', 'fish')),
  item text not null check (char_length(item) <= 40),
  count integer not null default 0 check (count >= 0),
  first_at timestamptz not null default now(),
  primary key (user_id, kind, item)
);

-- 하루에 한 번씩만: 나무마다 열매 한 번, 운세 나무 한 번, 낚시는 하루 횟수만큼 (한국 날짜)
create table if not exists public.daily_picks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  spot text not null check (char_length(spot) <= 40),
  item text,
  created_at timestamptz not null default now(),
  primary key (user_id, day, spot)
);

-- 주민증: 취미 한 줄 (선택)
alter table public.profiles add column if not exists hobby text check (char_length(hobby) <= 30);

alter table public.collections enable row level security;
alter table public.daily_picks enable row level security;
$sql$;
  insert into public.schema_migrations (name) values ('20261103030000_play.sql') on conflict (name) do nothing;
end $mig$;

-- ───────── 20261103040000_admin.sql ─────────

do $mig$
begin
  if exists (select 1 from public.schema_migrations where name = '20261103040000_admin.sql') then return; end if;
  execute $sql$
-- 운영자 (PROJECT_GUIDE.md 운영): 모든 방·기록을 보고, 신고를 처리하고, 글·계정을 지울 수 있다.
-- 브라우저는 직접 접근하지 않는다 (RLS 켜고 정책 없음). 운영자 등록은 SQL Editor에서 한 줄로 한다:
--   insert into public.admins (user_id) select id from auth.users where email = '<운영자 이메일>';

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

-- 신고 처리 기록
alter table public.reports add column if not exists resolved_at timestamptz;
alter table public.reports add column if not exists resolved_by uuid references auth.users (id) on delete set null;
alter table public.reports add column if not exists resolution text check (resolution in ('dismissed', 'removed'));
create index if not exists reports_open_idx on public.reports (created_at desc) where resolved_at is null;
$sql$;
  insert into public.schema_migrations (name) values ('20261103040000_admin.sql') on conflict (name) do nothing;
end $mig$;

-- ───────── 20261104000000_market.sql ─────────

do $mig$
begin
  if exists (select 1 from public.schema_migrations where name = '20261104000000_market.sql') then return; end if;
  execute $sql$
-- 상가 (PROJECT_GUIDE.md 3장 마을): 게임 코인과 점포 20칸.
-- 브라우저는 직접 접근하지 않는다. 서버가 규칙(값·한 사람 한 칸·코인)을 검사한 뒤 쓴다 (RLS 켜고 정책 없음).

-- 코인: 낚시·열매 따기로 모으고 점포를 살 때 쓴다 (게임 안의 돈. 현금으로 사거나 바꿀 수 없다)
alter table public.profiles add column if not exists coins integer not null default 0 check (coins >= 0);

-- 점포: 번호(0~19, 화면에는 1~20호)마다 주인 한 명, 한 사람에 한 칸
create table if not exists public.market_shops (
  slot smallint primary key check (slot >= 0 and slot < 20),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 12),
  intro text not null default '' check (char_length(intro) <= 40),
  color text not null default 'mint' check (char_length(color) <= 20),
  bought_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.market_shops enable row level security;
$sql$;
  insert into public.schema_migrations (name) values ('20261104000000_market.sql') on conflict (name) do nothing;
end $mig$;

-- ───────── 20261104010000_saju.sql ─────────

do $mig$
begin
  if exists (select 1 from public.schema_migrations where name = '20261104010000_saju.sql') then return; end if;
  execute $sql$
-- 사주상담소 (부엉 도사): 복채(코인)로 보는 기간 풀이와, 이용권으로 보는 상세 풀이.
-- 브라우저는 직접 접근하지 않는다. 서버가 복채·이용권을 확인한 뒤 쓴다 (RLS 켜고 정책 없음).

-- 사주 이용권: 낚시에서 아주 드물게 나온다. 상세 풀이를 한 번 볼 수 있다
alter table public.profiles add column if not exists saju_tickets integer not null default 0 check (saju_tickets >= 0);

-- 본 풀이: 같은 기간(오늘·이번 주…)은 다시 봐도 복채를 또 내지 않는다
create table if not exists public.saju_readings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('today', 'tomorrow', 'week', 'month', 'premium')),
  period text not null check (char_length(period) <= 20),
  body jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, period)
);

alter table public.saju_readings enable row level security;
$sql$;
  insert into public.schema_migrations (name) values ('20261104010000_saju.sql') on conflict (name) do nothing;
end $mig$;

-- ───────── 20261104020000_tarot.sql ─────────

do $mig$
begin
  if exists (select 1 from public.schema_migrations where name = '20261104020000_tarot.sql') then return; end if;
  execute $sql$
-- 사주상담소 타로: 오늘의 카드(한 장)와 과거·현재·미래(세 장, 주제별)도 본 풀이로 저장한다.
-- 같은 날 같은 점은 다시 봐도 복채를 또 내지 않고 같은 카드가 나온다.
alter table public.saju_readings drop constraint if exists saju_readings_kind_check;
alter table public.saju_readings add constraint saju_readings_kind_check
  check (kind in ('today', 'tomorrow', 'week', 'month', 'premium', 'tarot_one', 'tarot_three'));
$sql$;
  insert into public.schema_migrations (name) values ('20261104020000_tarot.sql') on conflict (name) do nothing;
end $mig$;

-- ───────── 20261105000000_contest.sql ─────────

do $mig$
begin
  if exists (select 1 from public.schema_migrations where name = '20261105000000_contest.sql') then return; end if;
  execute $sql$
-- 오행 지역 대항전: 한 주(일요일 21시 ~ 다음 일요일 21시) 동안 주민이 올린 활동 점수 (PROJECT_GUIDE.md 3장).
-- 한 줄 = 그 주·그날·그 주민·그 종류의 점수 합 (종류마다 하루 상한까지만 쌓인다). 지역 점수는 이 표를 지역별로 더해 낸다.
-- 브라우저는 직접 읽지 않는다 (서버가 모아서 보여 준다). RLS 켜고 정책 없음.
create table if not exists public.contest_points (
  week date not null,
  day date not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  district text not null check (district in ('wood', 'fire', 'earth', 'metal', 'water')),
  kind text not null check (kind in ('fish', 'fruit', 'debate', 'checkin', 'market')),
  points integer not null default 0 check (points >= 0),
  updated_at timestamptz not null default now(),
  primary key (week, day, user_id, kind)
);
create index if not exists contest_points_week_idx on public.contest_points (week, district);
create index if not exists contest_points_user_idx on public.contest_points (user_id, week);

alter table public.contest_points enable row level security;

-- 한 주가 끝난 뒤 처음 한 번 정한 결과 (다시 계산하지 않는다). 이 줄을 처음 넣은 요청만 서버 전체에 발표한다.
create table if not exists public.contest_results (
  week date primary key,
  winner text check (winner in ('wood', 'fire', 'earth', 'metal', 'water')),
  districts jsonb not null,
  decided_at timestamptz not null default now()
);

alter table public.contest_results enable row level security;
$sql$;
  insert into public.schema_migrations (name) values ('20261105000000_contest.sql') on conflict (name) do nothing;
end $mig$;

-- ───────── 20261105010000_youtube_limits.sql ─────────

do $mig$
begin
  if exists (select 1 from public.schema_migrations where name = '20261105010000_youtube_limits.sql') then return; end if;
  execute $sql$
-- 클럽 유튜브 신청곡 제한: 운영자가 막은 영상·채널, 유튜브 신청 켜기·끄기 (PROJECT_GUIDE.md 3장 클럽).
-- 브라우저는 직접 읽지 않는다 (서버가 운영자인지 확인한 뒤 쓴다). RLS 켜고 정책 없음.
create table if not exists public.youtube_blocks (
  kind text not null check (kind in ('video', 'channel')),
  id text not null check (char_length(id) between 1 and 64),
  label text not null default '' check (char_length(label) <= 120),
  created_at timestamptz not null default now(),
  primary key (kind, id)
);

-- 운영 설정 (키 하나에 값 하나). 지금은 youtube_requests = { "on": true | false }
create table if not exists public.app_settings (
  key text primary key check (char_length(key) <= 40),
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.youtube_blocks enable row level security;
alter table public.app_settings enable row level security;
$sql$;
  insert into public.schema_migrations (name) values ('20261105010000_youtube_limits.sql') on conflict (name) do nothing;
end $mig$;

-- ───────── 20261106000000_mbti_town.sql ─────────

do $mig$
begin
  if exists (select 1 from public.schema_migrations where name = '20261106000000_mbti_town.sql') then return; end if;
  execute $sql$
-- MBTI 마을 전환 (2026-11-05, PROJECT_GUIDE.md 3장): 사는 마을 = MBTI 유형 (16개 마을). 사주 기능을 걷어낸다.
-- 방·기록·사진·친구·방명록·코인·가방·점포는 그대로 남는다.
-- 집터·대항전 점수를 비우는 마이그레이션이라 한 번만 한다: 이 파일만 따로 실행해도 실행 기록(public.schema_migrations)을 남기고,
-- 기록이 있으면 아무것도 하지 않는다.

create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now());
alter table public.schema_migrations enable row level security;

do $body$
begin
  if exists (select 1 from public.schema_migrations where name = '20261106000000_mbti_town.sql') then
    raise notice 'MBTI 마을 전환은 이미 실행했습니다. 건너뜁니다.';
    return;
  end if;

  -- 1) 사는 마을: 오행 다섯 지역 대신 MBTI 16유형.
  --    집터는 비우고, MBTI가 있는 주민은 그 유형 마을로 옮긴다 (집은 다음 접속 때 그 마을 빈 집터에 선다).
  --    MBTI가 없는 주민은 다음 접속 때 MBTI를 고르면 그 마을에 집이 선다.
  alter table public.profiles drop constraint if exists profiles_district_check;
  update public.profiles set house_lot = null, house_hood = 1;
  update public.profiles set district = case when mbti ~ '^[EI][SN][TF][JP]$' then mbti else null end;
  -- 처음 MBTI 마을을 정한 것은 바꾸기 대기 시간을 세지 않는다 (한 번은 바로 고칠 수 있게)
  update public.profiles set mbti_changed_at = null;
  alter table public.profiles add constraint profiles_district_check check (district is null or district ~ '^[EI][SN][TF][JP]$');

  -- 2) 마을 대항전: 지난 점수와 결과는 오행 지역 기준이라 새로 시작한다.
  delete from public.contest_points;
  delete from public.contest_results;
  alter table public.contest_points drop constraint if exists contest_points_district_check;
  alter table public.contest_points add constraint contest_points_district_check check (district ~ '^[EI][SN][TF][JP]$');
  alter table public.contest_results drop constraint if exists contest_results_winner_check;
  alter table public.contest_results add constraint contest_results_winner_check check (winner is null or winner ~ '^[EI][SN][TF][JP]$');

  -- 3) 오늘의 토론: 아직 끝나지 않은 오행 지역 대결 경기는 지우고(논거·추천·판정도 함께) 성향 대결로 새로 연다.
  --    끝난 경기 기록은 그대로 둔다.
  delete from public.matches where status <> 'done' and coalesce(team_a ->> 'kind', '') <> 'axis';

  -- 4) 사주 기능에 쓰던 개인 정보와 기록을 지운다: 생일·사주 계산 결과·사주/타로 풀이·사주 이용권, 오행 채우기 기록.
  update public.profiles set birth = null, birth_date = null, saju = null, saju_tickets = 0;
  drop table if exists public.saju_readings;
  delete from public.daily_picks where spot like 'el:%' or spot like 'els:%';

  insert into public.schema_migrations (name) values ('20261106000000_mbti_town.sql') on conflict (name) do nothing;
end $body$;
$sql$;
  insert into public.schema_migrations (name) values ('20261106000000_mbti_town.sql') on conflict (name) do nothing;
end $mig$;

-- ───────── 20261107000000_hardening.sql ─────────

do $mig$
begin
  if exists (select 1 from public.schema_migrations where name = '20261107000000_hardening.sql') then return; end if;
  execute $sql$
-- 사람이 늘어날 때를 대비한 정리 (2026-11-07 데이터·보안 점검). 여러 번 실행해도 안전하다.
-- 1) 자주 찾는 칸에 색인: 사진 보기·계정 지우기·하루 상한 세기·신고 처리·탐색 정렬이 표 전체를 훑지 않게
-- 2) 한 경기에 논거 하나: 동시에 두 번 보내도 DB가 막는다
-- 3) 걷어낸 기능(사주·오행 지역 대결)의 칸을 지운다 (생일 같은 개인 정보가 남지 않게)
-- 4) 브라우저 공개 키(anon·authenticated)로는 표에 아무 권한도 없게 한다. RLS로 이미 막혀 있지만 한 겹 더

-- 1) 색인
create index if not exists records_photo_idx on public.records (photo_id) where photo_id is not null;
create index if not exists visits_visitor_idx on public.visits (visitor_id);
create index if not exists guestbook_author_idx on public.guestbook (author_id, created_at desc);
create index if not exists votes_user_idx on public.votes (user_id);
create index if not exists recommendations_user_idx on public.recommendations (user_id);
create index if not exists arguments_author_idx on public.arguments (author_id);
create index if not exists reports_reporter_idx on public.reports (reporter, created_at desc);
create index if not exists reports_resolved_by_idx on public.reports (resolved_by) where resolved_by is not null;
create index if not exists reports_target_idx on public.reports (target_kind, target_id);
create index if not exists profiles_onboarded_idx on public.profiles (onboarded_at desc nulls last);

-- 2) 한 경기에 한 사람 논거 하나 (이미 겹친 줄이 있으면 건너뛰고 알려 준다)
do $body$
begin
  create unique index if not exists arguments_one_per_match on public.arguments (match_id, author_id) where author_id is not null;
exception when unique_violation then
  raise notice '한 경기에 논거를 두 개 이상 낸 사람이 있어 arguments_one_per_match를 만들지 못했습니다';
end $body$;

-- 3) 걷어낸 기능의 칸
alter table public.profiles drop column if exists birth;
alter table public.profiles drop column if exists birth_date;
alter table public.profiles drop column if exists saju;
alter table public.profiles drop column if exists saju_tickets;
alter table public.arguments drop column if exists author_district;
alter table public.votes drop column if exists voter_district;

-- 4) 브라우저 공개 키로는 표·순번·함수에 권한이 없게 (서버는 DB에 직접 붙어서 영향이 없다)
do $body$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') and exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from anon, authenticated';
    execute 'revoke all on all sequences in schema public from anon, authenticated';
    execute 'revoke execute on all functions in schema public from anon, authenticated';
    execute 'alter default privileges in schema public revoke all on tables from anon, authenticated';
    execute 'alter default privileges in schema public revoke all on sequences from anon, authenticated';
    execute 'alter default privileges in schema public revoke execute on functions from anon, authenticated';
  end if;
end $body$;

-- 이 파일만 따로 실행해도 실행 기록을 남긴다
insert into public.schema_migrations (name) values ('20261107000000_hardening.sql') on conflict (name) do nothing;
$sql$;
  insert into public.schema_migrations (name) values ('20261107000000_hardening.sql') on conflict (name) do nothing;
end $mig$;
