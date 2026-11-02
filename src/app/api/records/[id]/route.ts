import { currentUser } from '@/server/auth';
import { handle, readJson } from '@/server/http';
import { getSceneService } from '@/server/scene';

/** 공개 범위 바꾸기 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { visibility } = await readJson(request);
    await (await getSceneService()).setRecordVisibility(await currentUser(), (await params).id, visibility);
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => (await getSceneService()).deleteRecord(await currentUser(), (await params).id));
}
