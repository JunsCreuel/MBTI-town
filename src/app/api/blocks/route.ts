import { currentUser } from '@/server/auth';
import { handle, readJson } from '@/server/http';
import { getSceneService } from '@/server/scene';

export async function GET() {
  return handle(async () => ({ blocked: await (await getSceneService()).blocked(await currentUser()) }));
}

/** action: block | unblock */
export async function POST(request: Request) {
  return handle(async () => {
    const { handle: h, action } = await readJson(request);
    const service = await getSceneService();
    const user = await currentUser();
    if (action === 'unblock') return service.unblock(user, String(h ?? ''));
    return service.block(user, String(h ?? ''));
  });
}
