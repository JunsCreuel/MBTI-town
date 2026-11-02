import { currentUser } from '@/server/auth';
import { handle, readJson } from '@/server/http';
import { getSceneService } from '@/server/scene';

/** 신고 (방명록·기록·사용자). 신고 내용은 운영자만 본다. */
export async function POST(request: Request) {
  return handle(async () => {
    const { kind, targetId, reason } = await readJson(request);
    await (await getSceneService()).report(await currentUser(), { kind, targetId, reason });
  });
}
