import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { getSceneService } from '@/server/scene';

export const dynamic = 'force-dynamic';

/** 마을에 서 있는 집들과, 화면에서 숨길 사람 (차단 관계) */
export async function GET() {
  return handle(async () => (await getSceneService()).town(await currentUser()));
}
