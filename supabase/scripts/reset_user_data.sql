-- 기존 사용자 데이터 초기화 (한 번만 쓰는 스크립트, 마이그레이션 아님). 되돌릴 수 없다.
-- Supabase 대시보드 → SQL Editor에 붙여 넣고 Run.
--
-- 지우는 것: 모든 계정(auth.users)과 사용자가 만든 모든 것
--   프로필·집터·사주, 방 배치, 사진, 기록, 친구, 방명록, 차단, 신고, 방문 기록,
--   열매·물고기 도감, 하루 기록, 토론 경기·글·추천·투표
-- 남기는 것: 표 구조, 토론 주제(topics). 토론 경기는 다음 접속 때 첫 회부터 다시 만들어진다.

begin;

-- 토론: 경기를 지우면 글·추천·투표가 같이 지워진다 (글은 작성자가 지워져도 남게 되어 있어 먼저 지운다)
delete from public.matches;
delete from public.arguments;

-- 신고: 신고한 사람이 지워져도 남게 되어 있어 따로 지운다
delete from public.reports;

-- 계정: 지우면 프로필과 프로필에 딸린 것(방·사진·기록·친구·방명록·차단·방문·도감·하루 기록)이 같이 지워진다.
-- 로그인 정보(identities, sessions, refresh_tokens 등)도 Supabase가 같이 지운다.
delete from auth.users;

commit;

-- 확인: 모두 0이어야 한다 (topics는 그대로)
select
  (select count(*) from auth.users) as users,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.rooms) as rooms,
  (select count(*) from public.photos) as photos,
  (select count(*) from public.records) as records,
  (select count(*) from public.collections) as collections,
  (select count(*) from public.matches) as matches,
  (select count(*) from public.arguments) as arguments,
  (select count(*) from public.topics) as topics_kept;
