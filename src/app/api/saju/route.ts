import { currentUser } from '@/server/auth';
import { handle, readJson } from '@/server/http';
import { getSceneService } from '@/server/scene';

export const dynamic = 'force-dynamic';

/** 사주상담소: 내 코인·이용권, 복채, 이미 본 풀이 */
export async function GET() {
  return handle(async () => (await getSceneService()).sajuOffice(await currentUser()));
}

/**
 * 풀이 보기: { kind: 'today' | 'tomorrow' | 'week' | 'month' | 'premium', useTicket? }
 * 예전 화면(가입·MY의 사주 미리 보기)은 이 주소로 생일을 보냈다: 생일이 오면 미리 보기로 답한다 (새 화면은 /api/saju/preview)
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request);
    const service = await getSceneService();
    if (!('kind' in body) && ('date' in body || 'calendar' in body)) return service.previewSaju(body);
    return service.readSaju(await currentUser(), body);
  });
}
