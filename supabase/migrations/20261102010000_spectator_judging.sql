-- 관전 판정: AI 채점을 빼고 관전자가 승패를 정한다.
-- 관전자는 양 팀 대표 논거 중 가장 설득력 있는 하나를 고르고, 그 논거의 팀에 한 표가 간다.
alter table public.votes
  add column if not exists argument_id uuid references public.arguments (id) on delete set null;

create index if not exists votes_match_argument_idx on public.votes (match_id, argument_id);

-- 논거 검사는 금지어 목록으로 한다. 검사 기록 칸은 더 쓰지 않는다.
alter table public.arguments drop column if exists moderation;
