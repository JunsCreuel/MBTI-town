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
