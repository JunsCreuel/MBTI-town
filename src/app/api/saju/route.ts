import { handle, readJson } from '@/server/http';
import { getSceneService } from '@/server/scene';

export const dynamic = 'force-dynamic';

/** 가입 화면 미리 보기: 생일 → 사주 네 기둥과 거주 지역 (저장하지 않는다) */
export async function POST(request: Request) {
  return handle(async () => (await getSceneService()).previewSaju(await readJson(request)));
}
