import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { getSceneService } from '@/server/scene';

/** 신고 목록 (운영자만, 처리 안 된 것 먼저) */
export async function GET() {
  return handle(async () => ({ reports: await (await getSceneService()).adminReports(await currentUser()) }));
}
