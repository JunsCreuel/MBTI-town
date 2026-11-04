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
