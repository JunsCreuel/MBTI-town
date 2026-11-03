-- 새 동네: 지역 1동(본섬) 집터가 다 차면 2동, 2동이 다 차면 3동… 이 열린다 (PROJECT_GUIDE.md 3장).
-- house_hood = 집이 있는 동네 번호 (1 = 본섬). 집터 번호(house_lot)는 동네마다 0부터 센다.
alter table public.profiles add column if not exists house_hood integer not null default 1 check (house_hood >= 1);
drop index if exists public.profiles_house_lot_key;
create unique index if not exists profiles_house_slot_key on public.profiles (district, house_hood, house_lot) where house_lot is not null;
