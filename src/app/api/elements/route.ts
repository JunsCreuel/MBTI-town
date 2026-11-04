import { currentUser } from '@/server/auth';
import { handle, readJson } from '@/server/http';
import { getSceneService } from '@/server/scene';

export const dynamic = 'force-dynamic';

/** 오늘의 오행 채우기: 타고난 오행, 오늘 채울 칸·채운 칸, 보상 */
export async function GET() {
  return handle(async () => (await getSceneService()).elementsView(await currentUser()));
}

/** 화면이 알려 오는 놀이: { element: 'fire', source: 'dance' | 'request' | 'drink' } | { element: 'earth', source: 'market' } (하루에 한 번씩) */
export async function POST(request: Request) {
  return handle(async () => (await getSceneService()).reportElement(await currentUser(), await readJson(request)));
}
