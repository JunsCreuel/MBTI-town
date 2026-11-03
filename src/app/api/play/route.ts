import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { getSceneService } from '@/server/scene';

export const dynamic = 'force-dynamic';

/** 오늘 딴 나무, 남은 낚시 횟수, 모은 것 (도감) */
export async function GET() {
  return handle(async () => (await getSceneService()).playState(await currentUser()));
}
