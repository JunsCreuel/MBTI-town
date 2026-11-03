-- 오늘의 토론을 지역(오행) 대결로 바꾼다 (PROJECT_GUIDE.md 10장).
-- 논거·판정에 지역을 남긴다. MBTI는 토론과 상관없는 프로필 태그라 논거에 선택으로만 남는다.
alter table public.arguments add column if not exists author_district text
  check (author_district in ('wood', 'fire', 'earth', 'metal', 'water'));
alter table public.arguments alter column author_mbti drop not null;
alter table public.votes add column if not exists voter_district text
  check (voter_district in ('wood', 'fire', 'earth', 'metal', 'water'));
alter table public.votes alter column voter_mbti drop not null;

-- 아직 끝나지 않은 MBTI 대결 경기는 지운다 (지금 칸의 경기는 지역 대결로 새로 만들어진다). 끝난 경기 기록은 남긴다.
delete from public.matches where status <> 'done' and coalesce(team_a ->> 'kind', '') <> 'district';
