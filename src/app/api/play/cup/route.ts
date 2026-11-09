import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { getSceneService } from '@/server/scene';

export const dynamic = 'force-dynamic';

/** 주간 낚시 대회: 이번 주 순위·내 기록·지난주 낚시왕 (준비 전이면 null) */
export async function GET() {
  return handle(async () => ({ cup: await (await getSceneService()).fishingCup(await currentUser()) }));
}
