import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { getSceneService } from '@/server/scene';

/** 방명록 지우기 (방 주인 또는 쓴 사람) */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => (await getSceneService()).deleteGuestbook(await currentUser(), (await params).id));
}
