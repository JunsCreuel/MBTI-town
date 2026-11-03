import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { getSceneService } from '@/server/scene';

/** 계정 삭제 (운영자만, 되돌릴 수 없다) */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => (await getSceneService()).adminDeleteUser(await currentUser(), (await params).id));
}
