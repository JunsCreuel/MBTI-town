import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { getSceneService } from '@/server/scene';

export const dynamic = 'force-dynamic';

/** 낚시 한 번 */
export async function POST() {
  return handle(async () => (await getSceneService()).castLine(await currentUser()));
}
