import { handle, readJson } from '@/server/http';
import { allow, clientIp } from '@/server/rateLimit';
import { getSceneService } from '@/server/scene';

/** 가입·로그인 화면에서 막혔을 때 알려 온다 ({ email, code, step }). 운영 화면 가입 도움에 모인다.
 * 로그인 전이라 누구나 부를 수 있으므로 한 곳에서 10분에 10번까지만 받는다 (넘으면 조용히 버린다) */
export async function POST(request: Request) {
  return handle(async () => {
    if (!allow(`signup-issue:${clientIp(request)}`, 10, 10 * 60_000)) return;
    await (await getSceneService()).reportSignupFailure(await readJson(request));
  });
}
