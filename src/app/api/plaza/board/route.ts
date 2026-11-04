import { handle } from '@/server/http';
import { plazaBoard } from '@/server/plazaBoard';

export const dynamic = 'force-dynamic';

/** 광장 전광판: 대항전 순위·지난주 우승, 오늘의 토론 (누구나 본다, 로그인 필요 없음) */
export async function GET() {
  return handle(() => plazaBoard());
}
