import { currentUser } from '@/server/auth';
import { getDebateService } from '@/server/debate';
import { handle } from '@/server/http';

/** 오늘의 경기. 판정 시간이 끝났으면 바로 집계한 결과를 돌려준다. */
export async function GET() {
  return handle(async () => {
    const service = await getDebateService();
    return service.view(await service.withResult(await service.currentMatch()), await currentUser());
  });
}
