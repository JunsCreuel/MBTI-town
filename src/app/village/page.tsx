import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { VillageClient } from '@/components/village/VillageClient';
import { currentUser } from '@/server/auth';
import { getSceneService } from '@/server/scene';
import { hoodPlace, isTownPlace, parseRoomPlace, parseSpot, type RoomPlace, type TownPlace } from '@/shared/protocol';

export const metadata: Metadata = { title: '마을 · SCENE' };
export const dynamic = 'force-dynamic';

/**
 * 마을: 로그인하지 않았으면 손님으로 구경한다. 로그인했는데 집이 없으면 첫 가입부터.
 * ?hood=water.2 = 2동부터의 동네, ?at= 처음 설 곳 (기본: 내 집 문 앞. 집이 다른 동네에 있으면 그 동네로 간다)
 */
export default async function VillagePage({
  searchParams,
}: {
  searchParams: Promise<{ at?: string; hood?: string; place?: string; welcome?: string }>;
}) {
  const user = await currentUser();
  const me = user ? await (await getSceneService()).me(user).catch(() => null) : null;
  if (me && !me.profile.onboarded) redirect('/onboarding');
  const sp = await searchParams;
  const at: TownPlace = isTownPlace(sp.at) ? sp.at : 'home';
  // ?place=fishing|club: 광장 비콘으로 가는 놀이터
  const spot = parseSpot(sp.place);
  const hood = parseRoomPlace(sp.hood);
  let place: RoomPlace = spot ?? (hood ? hoodPlace(hood.district, hood.hood) : 'town');
  const profile = me?.profile;
  if (!spot && !hood && at === 'home' && profile?.district && profile.houseLot !== null) place = hoodPlace(profile.district, profile.houseHood);
  return <VillageClient key={`${place}|${at}`} place={place} at={at} welcome={sp.welcome === '1'} />;
}
