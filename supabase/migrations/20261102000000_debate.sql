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
