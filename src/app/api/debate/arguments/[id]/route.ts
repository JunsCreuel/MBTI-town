import { currentUser } from '@/server/auth';
import { getDebateService } from '@/server/debate';
import { handle } from '@/server/http';

/** 논거 지우기 (운영자만) */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => (await getDebateService()).adminDeleteArgument(await currentUser(), (await params).id));
}
