-- MBTI 마을 전환 (2026-11-05, PROJECT_GUIDE.md 3장): 사는 마을 = MBTI 유형 (16개 마을). 사주 기능을 걷어낸다.
-- 방·기록·사진·친구·방명록·코인·가방·점포는 그대로 남는다.
-- 집터·대항전 점수를 비우는 마이그레이션이라 한 번만 한다: 이 파일만 따로 실행해도 실행 기록(public.schema_migrations)을 남기고,
-- 기록이 있으면 아무것도 하지 않는다.

create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now());
alter table public.schema_migrations enable row level security;

do $body$
begin
  if exists (select 1 from public.schema_migrations where name = '20261106000000_mbti_town.sql') then
    raise notice 'MBTI 마을 전환은 이미 실행했습니다. 건너뜁니다.';
    return;
  end if;

  -- 1) 사는 마을: 오행 다섯 지역 대신 MBTI 16유형.
  --    집터는 비우고, MBTI가 있는 주민은 그 유형 마을로 옮긴다 (집은 다음 접속 때 그 마을 빈 집터에 선다).
  --    MBTI가 없는 주민은 다음 접속 때 MBTI를 고르면 그 마을에 집이 선다.
  alter table public.profiles drop constraint if exists profiles_district_check;
  update public.profiles set house_lot = null, house_hood = 1;
  update public.profiles set district = case when mbti ~ '^[EI][SN][TF][JP]$' then mbti else null end;
  -- 처음 MBTI 마을을 정한 것은 바꾸기 대기 시간을 세지 않는다 (한 번은 바로 고칠 수 있게)
  update public.profiles set mbti_changed_at = null;
  alter table public.profiles add constraint profiles_district_check check (district is null or district ~ '^[EI][SN][TF][JP]$');

  -- 2) 마을 대항전: 지난 점수와 결과는 오행 지역 기준이라 새로 시작한다.
  delete from public.contest_points;
  delete from public.contest_results;
  alter table public.contest_points drop constraint if exists contest_points_district_check;
  alter table public.contest_points add constraint contest_points_district_check check (district ~ '^[EI][SN][TF][JP]$');
  alter table public.contest_results drop constraint if exists contest_results_winner_check;
  alter table public.contest_results add constraint contest_results_winner_check check (winner is null or winner ~ '^[EI][SN][TF][JP]$');

  -- 3) 오늘의 토론: 아직 끝나지 않은 오행 지역 대결 경기는 지우고(논거·추천·판정도 함께) 성향 대결로 새로 연다.
  --    끝난 경기 기록은 그대로 둔다.
  delete from public.matches where status <> 'done' and coalesce(team_a ->> 'kind', '') <> 'axis';

  -- 4) 사주 기능에 쓰던 개인 정보와 기록을 지운다: 생일·사주 계산 결과·사주/타로 풀이·사주 이용권, 오행 채우기 기록.
  update public.profiles set birth = null, birth_date = null, saju = null, saju_tickets = 0;
  drop table if exists public.saju_readings;
  delete from public.daily_picks where spot like 'el:%' or spot like 'els:%';

  insert into public.schema_migrations (name) values ('20261106000000_mbti_town.sql') on conflict (name) do nothing;
end $body$;
