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
