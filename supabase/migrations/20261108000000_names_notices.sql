-- 닉네임 한 번 바꾸기와 내게 온 알림 (2026-11-08). 여러 번 실행해도 안전하다.
-- 1) 닉네임: 가입할 때 정한 뒤 한 번까지만 바꿀 수 있다. 바꾼 횟수를 센다
-- 2) 알림: 운영자가 코인을 선물하거나 방에 다녀가면 그 사람에게 남긴다. 다음에 들어오면 화면 위에 크게 보인다 (본 것은 표시)

alter table public.profiles add column if not exists name_changes smallint not null default 0;
do $body$
begin
  alter table public.profiles add constraint profiles_name_changes_check check (name_changes >= 0);
exception when duplicate_object then null;
end $body$;

create table if not exists public.user_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('gift', 'visit')),
  text text not null check (char_length(text) between 1 and 200),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists user_notices_unread_idx on public.user_notices (user_id, created_at) where read_at is null;
alter table public.user_notices enable row level security;

-- 이 파일만 따로 실행해도 실행 기록을 남긴다
insert into public.schema_migrations (name) values ('20261108000000_names_notices.sql') on conflict (name) do nothing;
