import { currentUser } from '@/server/auth';
import { handle, readJson } from '@/server/http';
import { getSceneService } from '@/server/scene';

/** 신고 처리 (운영자만): { action: 'dismiss' | 'remove' } */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { action } = await readJson(request);
    await (await getSceneService()).adminResolveReport(await currentUser(), (await params).id, action);
  });
}
