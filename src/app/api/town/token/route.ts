import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { allow, clientIp } from '@/server/rateLimit';
import { getSceneService } from '@/server/scene';
import { SceneError } from '@/server/scene/service';

export const dynamic = 'force-dynamic';

/**
 * 실시간 마을 입장 토큰. 가입을 마치지 않았으면 손님 토큰을 준다.
 * 손님 토큰을 한 곳에서 마구 받아 마을 자리를 채우지 못하게, 로그인 안 한 요청은 한 곳(IP)에서 10분에 60번까지
 */
export async function POST(request: Request) {
  return handle(async () => {
    const viewer = await currentUser();
    if (!viewer && !allow(`town-token:${clientIp(request)}`, 60, 10 * 60_000)) throw new SceneError('limit', '잠시 뒤에 다시 들어와 주세요.');
    return (await getSceneService()).townTicket(viewer);
  });
}
