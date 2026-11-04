-- 사주상담소 타로: 오늘의 카드(한 장)와 과거·현재·미래(세 장, 주제별)도 본 풀이로 저장한다.
-- 같은 날 같은 점은 다시 봐도 복채를 또 내지 않고 같은 카드가 나온다.
alter table public.saju_readings drop constraint if exists saju_readings_kind_check;
alter table public.saju_readings add constraint saju_readings_kind_check
  check (kind in ('today', 'tomorrow', 'week', 'month', 'premium', 'tarot_one', 'tarot_three'));
