import { getDebateService } from '@/server/debate';
import { handle } from '@/server/http';

/** 마을 땅 지분 (전체 지도와 땅 색칠에 쓴다). 토론 결과가 나오면 바뀐다. */
export async function GET() {
  return handle(async () => (await getDebateService()).town());
}
