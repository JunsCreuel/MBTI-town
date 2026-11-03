import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { getSceneService } from '@/server/scene';

/** 주민 찾기 (운영자만): ?q=이름·핸들 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q');
  return handle(async () => ({ users: await (await getSceneService()).adminUsers(await currentUser(), q) }));
}
