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
