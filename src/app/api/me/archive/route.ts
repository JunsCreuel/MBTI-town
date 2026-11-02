import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { getSceneService } from '@/server/scene';

/** 기록과 사진 모두 지우기 */
export async function DELETE() {
  return handle(async () => (await getSceneService()).deleteArchive(await currentUser()));
}
