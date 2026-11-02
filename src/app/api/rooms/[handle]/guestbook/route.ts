import { currentUser } from '@/server/auth';
import { handle, readJson } from '@/server/http';
import { getSceneService } from '@/server/scene';

/** 방명록 쓰기 */
export async function POST(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  return handle(async () => {
    const { body, visibility } = await readJson(request);
    await (await getSceneService()).writeGuestbook(await currentUser(), (await params).handle, { body, visibility });
  });
}
