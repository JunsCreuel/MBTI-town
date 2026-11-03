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
