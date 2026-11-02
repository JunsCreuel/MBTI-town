import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { VillageClient } from '@/components/village/VillageClient';
import { currentUser } from '@/server/auth';
import { getSceneService } from '@/server/scene';
import { isDistrict } from '@/shared/districts';
import type { TownPlace } from '@/shared/protocol';

export const metadata: Metadata = { title: '마을 · SCENE' };
export const dynamic = 'force-dynamic';

/** 마을: 로그인하지 않았으면 손님으로 구경한다. 로그인했는데 집이 없으면 첫 가입부터. */
export default async function VillagePage({ searchParams }: { searchParams: Promise<{ at?: string; welcome?: string }> }) {
  const user = await currentUser();
  if (user) {
    const me = await (await getSceneService()).me(user).catch(() => null);
    if (me && !me.profile.onboarded) redirect('/onboarding');
  }
  const sp = await searchParams;
  const at: TownPlace = sp.at === 'plaza' || isDistrict(sp.at) ? sp.at : 'home';
  return <VillageClient at={at} welcome={sp.welcome === '1'} />;
}
