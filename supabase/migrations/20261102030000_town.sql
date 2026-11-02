-- 마을: 지역마다 정해진 집터에 주민의 집이 선다 (PROJECT_GUIDE.md 3장).
-- house_lot = 그 지역 집터 번호 (0부터, 마을 맵 lots 레이어의 이름 "<지역>.<번호>"와 같다).
-- 집터가 다 찬 지역으로 오면 house_lot이 비어 있다 (마을에 집은 없고 방은 그대로 쓴다).
alter table public.profiles add column if not exists house_lot integer check (house_lot >= 0);
create unique index if not exists profiles_house_lot_key on public.profiles (district, house_lot) where house_lot is not null;

-- 이미 가입한 주민에게 가입 순서대로 집터를 준다. 지역마다 20곳 (src/config/game.ts townConfig.lotsPerDistrict와 같다).
-- 그 지역에 집터를 받은 사람이 아직 없을 때만 채우므로 다시 실행해도 겹치지 않는다.
update public.profiles p
set house_lot = r.n
from (
  select id, district, (row_number() over (partition by district order by onboarded_at, id) - 1)::int as n
  from public.profiles
  where onboarded_at is not null and district is not null and house_lot is null
) r
where p.id = r.id
  and r.n < 20
  and not exists (select 1 from public.profiles q where q.district = r.district and q.house_lot is not null);
