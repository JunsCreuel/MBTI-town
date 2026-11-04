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
