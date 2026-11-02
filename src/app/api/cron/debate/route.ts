import { NextResponse } from 'next/server';
import { getDebateService } from '@/server/debate';
import { handle } from '@/server/http';

/**
 * 예약 작업용(선택): 오늘 경기를 미리 만들고, 판정이 끝난 경기를 집계한다.
 * 예약하지 않아도 첫 방문 때 같은 일이 일어난다. Authorization: Bearer $CRON_SECRET
 */
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return handle(async () => {
    const service = await getDebateService();
    const current = await service.currentMatch();
    const finalized = await service.finalizeDue();
    return { current: current.key, finalized: finalized.map((m) => m.key) };
  });
}

export const GET = run;
export const POST = run;
