import { NextResponse } from 'next/server';
import { getDebateService } from '@/server/debate';
import { handle } from '@/server/http';

/**
 * 예약 작업용: 오늘 경기를 만들고, 투표가 끝난 경기를 채점한다.
 * 채점 시각(투표 마감) 직후에 부르도록 예약한다. Authorization: Bearer $CRON_SECRET
 */
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return handle(async () => {
    const service = await getDebateService();
    const current = await service.currentMatch();
    const judged = await service.judgeDue();
    return { current: current.key, judged: judged.map((m) => m.key) };
  });
}

export const GET = run;
export const POST = run;
