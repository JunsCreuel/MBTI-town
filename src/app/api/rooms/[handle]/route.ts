import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { getSceneService } from '@/server/scene';

/** 방 보기 (공개 범위·차단은 서버가 검사한다) */
export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  return handle(async () => (await getSceneService()).roomView(await currentUser(), (await params).handle));
}
