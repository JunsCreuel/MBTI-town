import { after } from 'next/server';
import { currentUser } from '@/server/auth';
import { getDebateService } from '@/server/debate';
import { handle } from '@/server/http';

/** 오늘의 경기. 투표가 끝난 경기가 있으면 응답을 보낸 뒤 채점한다. */
export async function GET() {
  return handle(async () => {
    const service = await getDebateService();
    const view = await service.view(await service.currentMatch(), await currentUser());
    if (view.phase === 'judging') after(() => service.judgeDue());
    return view;
  });
}
