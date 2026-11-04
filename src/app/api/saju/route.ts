import { currentUser } from '@/server/auth';
import { handle, readJson } from '@/server/http';
import { getSceneService } from '@/server/scene';

export const dynamic = 'force-dynamic';

/** 사주상담소: 내 코인·이용권, 복채, 이미 본 풀이 */
export async function GET() {
  return handle(async () => (await getSceneService()).sajuOffice(await currentUser()));
}

/** 풀이 보기: { kind: 'today' | 'tomorrow' | 'week' | 'month' | 'premium', useTicket? } */
export async function POST(request: Request) {
  return handle(async () => (await getSceneService()).readSaju(await currentUser(), await readJson(request)));
}
