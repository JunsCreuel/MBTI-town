import { currentUser } from '@/server/auth';
import { handle, readJson } from '@/server/http';
import { getSceneService } from '@/server/scene';

export const dynamic = 'force-dynamic';

/** 집 안(방) 실시간 입장 토큰. 그 방을 볼 수 있을 때만 준다. body: { handle } */
export async function POST(request: Request) {
  return handle(async () => {
    const body = (await readJson(request)) as { handle?: unknown };
    return (await getSceneService()).houseTicket(await currentUser(), String(body?.handle ?? ''));
  });
}
