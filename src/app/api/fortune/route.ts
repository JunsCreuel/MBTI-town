import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { getSceneService } from '@/server/scene';

export const dynamic = 'force-dynamic';

/** 오늘의 일진 편지 (내 방 우편함) */
export async function GET() {
  return handle(async () => (await getSceneService()).fortune(await currentUser()));
}
