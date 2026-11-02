import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { getSceneService } from '@/server/scene';

export const dynamic = 'force-dynamic';

/** 실시간 마을 입장 토큰. 가입을 마치지 않았으면 손님 토큰을 준다. */
export async function POST() {
  return handle(async () => (await getSceneService()).townTicket(await currentUser()));
}
