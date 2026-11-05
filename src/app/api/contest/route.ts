import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { settleContestIfDue } from '@/server/plazaBoard';
import { getSceneService } from '@/server/scene';

export const dynamic = 'force-dynamic';

/** MBTI 마을 대항전: 이번 주 순위, 지난주 결과, 내가 올린 점수 (손님도 순위는 본다) */
export async function GET() {
  return handle(async () => {
    await settleContestIfDue().catch((e) => console.error('[contest] 지난주 결과 정하기 실패', e));
    return (await getSceneService()).contestView(await currentUser());
  });
}
