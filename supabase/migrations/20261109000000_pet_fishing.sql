-- 강아지 키우기와 주간 낚시 대회 (2026-11-09). 여러 번 실행해도 안전하다.
-- 1) 강아지 친밀도: 밥 주기(하루 한 번)·쓰다듬기(하루 몇 번)·산책(하루 한 번)으로 오른다. 단계마다 재주를 배운다
-- 2) 주간 낚시 대회: 한 주(대항전과 같은 주, 일요일 21시 마감) 동안 낚은 가장 큰 물고기. 끝나면 낚시왕을 한 번 정해 둔다

create table if not exists public.pet_care (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  affection integer not null default 0 check (affection >= 0),
  fed_day date,
  walked_day date,
  pet_day date,
  pets_today smallint not null default 0 check (pets_today >= 0),
  updated_at timestamptz not null default now()
);
alter table public.pet_care enable row level security;

-- 한 사람의 이번 주 가장 큰 물고기 (더 큰 것을 낚으면 바꾼다)
create table if not exists public.fishing_weekly (
  week date not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  fish text not null check (char_length(fish) <= 40),
  size real not null check (size >= 0),
  caught_at timestamptz not null default now(),
  primary key (week, user_id)
);
create index if not exists fishing_weekly_rank_idx on public.fishing_weekly (week, size desc);
alter table public.fishing_weekly enable row level security;

-- 끝난 주의 낚시왕 (처음 한 번 정한다. 이 줄을 처음 넣은 요청만 상을 주고 발표한다)
create table if not exists public.fishing_weekly_results (
  week date primary key,
  user_id uuid references public.profiles (id) on delete set null,
  fish text check (char_length(fish) <= 40),
  size real,
  decided_at timestamptz not null default now()
);
alter table public.fishing_weekly_results enable row level security;

-- 이 파일만 따로 실행해도 실행 기록을 남긴다
insert into public.schema_migrations (name) values ('20261109000000_pet_fishing.sql') on conflict (name) do nothing;
