import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDebateService } from '@/server/debate';
import { getSceneService } from '@/server/scene';
import { handle } from '@/server/http';
import { settleContestIfDue } from '@/server/plazaBoard';

/**
 * 예약 작업 (매일 21:01): 오늘 경기를 미리 만들고, 판정이 끝난 경기를 집계한다. 일요일이면 MBTI 마을 대항전 결과도 정하고 발표한다.
 * 다시 읽지 않는 오래된 기록(하루 열매·낚시, 방문, 지난 대항전 점수, 가입 막힘)도 정리한다.
 * 예약하지 않아도 첫 방문 때 같은 일이 일어난다. Authorization: Bearer $CRON_SECRET
 */
/** 비밀값 비교: 걸리는 시간으로 값을 알아내지 못하게 (해시 길이를 맞춰 비교) */
function sameSecret(a: string, b: string): boolean {
  const h = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(h(a), h(b));
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !sameSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return handle(async () => {
    const service = await getDebateService();
    const current = await service.currentMatch();
    const finalized = await service.finalizeDue();
    const contest = await settleContestIfDue();
    // 오래된 기록 정리 (실패해도 위 일은 그대로 끝난 것으로)
    const cleaned = await (await getSceneService()).cleanup().catch((e: unknown) => {
      console.error('[cron] cleanup', e);
      return null;
    });
    return { current: current.key, finalized: finalized.map((m) => m.key), contest, cleaned };
  });
}

export const GET = run;
export const POST = run;
