import { currentUser } from '@/server/auth';
import { handle, readJson } from '@/server/http';
import { getSceneService } from '@/server/scene';

/** 나의 방 저장 (배치와 대표 BGM) */
export async function PUT(request: Request) {
  return handle(async () => {
    const { layout, bgm } = await readJson(request);
    return (await getSceneService()).saveRoom(await currentUser(), { layout, bgm });
  });
}
