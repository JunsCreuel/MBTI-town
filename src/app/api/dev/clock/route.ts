import { NextResponse } from 'next/server';
import { clockOffsetMs, setClockOffsetMs } from '@/server/debate';
import { handle, readJson } from '@/server/http';

/** 개발용: 서버 시계를 앞으로 돌려 작성 → 투표 → 발표 흐름을 바로 확인한다 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return handle(async () => {
    const { addMinutes, reset } = await readJson(request);
    setClockOffsetMs(reset ? 0 : clockOffsetMs() + Number(addMinutes ?? 0) * 60_000);
    return { offsetMinutes: clockOffsetMs() / 60_000, now: new Date(Date.now() + clockOffsetMs()).toISOString() };
  });
}
