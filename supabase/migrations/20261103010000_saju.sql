-- 사주로 거주 지역 자동 배정 (PROJECT_GUIDE.md 3장).
-- birth = 사용자가 넣은 생일 그대로 {calendar: solar|lunar, date, leap, time|null}. 본인만 본다.
-- saju  = 계산한 네 기둥과 오행 (화면 표시용). 거주 지역(district)은 saju의 일간 오행이다.
-- birth_date는 양력으로 바꾼 생일을 그대로 쓴다.
alter table public.profiles add column if not exists birth jsonb;
alter table public.profiles add column if not exists saju jsonb;
