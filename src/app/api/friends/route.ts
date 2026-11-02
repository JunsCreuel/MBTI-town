import { currentUser } from '@/server/auth';
import { handle, readJson } from '@/server/http';
import { getSceneService } from '@/server/scene';
import { SceneError } from '@/server/scene/service';

export async function GET() {
  return handle(async () => (await getSceneService()).friends(await currentUser()));
}

/** action: request(신청) | accept(수락) | remove(취소·거절·끊기) */
export async function POST(request: Request) {
  return handle(async () => {
    const { handle: h, action } = await readJson(request);
    const service = await getSceneService();
    const user = await currentUser();
    const target = String(h ?? '');
    if (action === 'request') return { state: await service.requestFriend(user, target) };
    if (action === 'accept') return service.acceptFriend(user, target);
    if (action === 'remove') return service.removeFriend(user, target);
    throw new SceneError('bad_request', '알 수 없는 요청이에요.');
  });
}
