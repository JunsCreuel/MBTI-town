-- 사람이 늘어날 때를 대비한 정리 (2026-11-07 데이터·보안 점검). 여러 번 실행해도 안전하다.
-- 1) 자주 찾는 칸에 색인: 사진 보기·계정 지우기·하루 상한 세기·신고 처리·탐색 정렬이 표 전체를 훑지 않게
-- 2) 한 경기에 논거 하나: 동시에 두 번 보내도 DB가 막는다
-- 3) 걷어낸 기능(사주·오행 지역 대결)의 칸을 지운다 (생일 같은 개인 정보가 남지 않게)
-- 4) 브라우저 공개 키(anon·authenticated)로는 표에 아무 권한도 없게 한다. RLS로 이미 막혀 있지만 한 겹 더

-- 1) 색인
create index if not exists records_photo_idx on public.records (photo_id) where photo_id is not null;
create index if not exists visits_visitor_idx on public.visits (visitor_id);
create index if not exists guestbook_author_idx on public.guestbook (author_id, created_at desc);
create index if not exists votes_user_idx on public.votes (user_id);
create index if not exists recommendations_user_idx on public.recommendations (user_id);
create index if not exists arguments_author_idx on public.arguments (author_id);
create index if not exists reports_reporter_idx on public.reports (reporter, created_at desc);
create index if not exists reports_resolved_by_idx on public.reports (resolved_by) where resolved_by is not null;
create index if not exists reports_target_idx on public.reports (target_kind, target_id);
create index if not exists profiles_onboarded_idx on public.profiles (onboarded_at desc nulls last);

-- 2) 한 경기에 한 사람 논거 하나 (이미 겹친 줄이 있으면 건너뛰고 알려 준다)
do $body$
begin
  create unique index if not exists arguments_one_per_match on public.arguments (match_id, author_id) where author_id is not null;
exception when unique_violation then
  raise notice '한 경기에 논거를 두 개 이상 낸 사람이 있어 arguments_one_per_match를 만들지 못했습니다';
end $body$;

-- 3) 걷어낸 기능의 칸
alter table public.profiles drop column if exists birth;
alter table public.profiles drop column if exists birth_date;
alter table public.profiles drop column if exists saju;
alter table public.profiles drop column if exists saju_tickets;
alter table public.arguments drop column if exists author_district;
alter table public.votes drop column if exists voter_district;

-- 4) 브라우저 공개 키로는 표·순번·함수에 권한이 없게 (서버는 DB에 직접 붙어서 영향이 없다)
do $body$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') and exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from anon, authenticated';
    execute 'revoke all on all sequences in schema public from anon, authenticated';
    execute 'revoke execute on all functions in schema public from anon, authenticated';
    execute 'alter default privileges in schema public revoke all on tables from anon, authenticated';
    execute 'alter default privileges in schema public revoke all on sequences from anon, authenticated';
    execute 'alter default privileges in schema public revoke execute on functions from anon, authenticated';
  end if;
end $body$;

-- 이 파일만 따로 실행해도 실행 기록을 남긴다
insert into public.schema_migrations (name) values ('20261107000000_hardening.sql') on conflict (name) do nothing;
