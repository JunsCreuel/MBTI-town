import { currentUser } from '@/server/auth';
import { handle, readJson } from '@/server/http';
import { getSceneService } from '@/server/scene';

export const dynamic = 'force-dynamic';

/** 운영자 공지: 지금 접속한 모두에게 (운영자만) */
export async function POST(req: Request) {
  return handle(async () => {
    const { text } = await readJson(req);
    return (await getSceneService()).adminNotice(await currentUser(), text);
  });
}
