import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { getSceneService } from '@/server/scene';

/** 내게 온 알림을 꺼낸다 (운영자 코인 선물·방문). 꺼낸 것은 본 것으로 표시한다 */
export async function POST() {
  return handle(async () => ({ notices: await (await getSceneService()).takeNotices(await currentUser()) }));
}
