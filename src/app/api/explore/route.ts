import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { getSceneService } from '@/server/scene';

/** 마을 둘러보기: ?district=wood 처럼 지역을 고른다 */
export async function GET(request: Request) {
  return handle(async () => {
    const district = new URL(request.url).searchParams.get('district');
    return (await getSceneService()).explore(await currentUser(), district);
  });
}
