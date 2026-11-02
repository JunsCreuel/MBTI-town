import { currentUser } from '@/server/auth';
import { getDebateService } from '@/server/debate';
import { DebateError } from '@/server/debate/service';
import { handle } from '@/server/http';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 지난 경기 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    if (!UUID.test(id)) throw new DebateError('not_found', '경기를 찾을 수 없어요.');
    const service = await getDebateService();
    return service.view(await service.getMatch(id), await currentUser());
  });
}
