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
