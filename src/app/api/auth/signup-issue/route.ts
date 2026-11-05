import { handle, readJson } from '@/server/http';
import { getSceneService } from '@/server/scene';

/** 가입·로그인 화면에서 막혔을 때 알려 온다 ({ email, code, step }). 운영 화면 가입 도움에 모인다 */
export async function POST(request: Request) {
  return handle(async () => {
    await (await getSceneService()).reportSignupFailure(await readJson(request));
  });
}
