import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { getSceneService } from '@/server/scene';

/** 운영 요약 (운영자만) */
export async function GET() {
  return handle(async () => (await getSceneService()).adminOverview(await currentUser()));
}
