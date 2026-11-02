import { NextResponse } from 'next/server';
import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { getSceneService } from '@/server/scene';

/** 내 기록 내보내기 (JSON 파일로 받는다) */
export async function GET() {
  let data: Record<string, unknown> | null = null;
  const res = await handle(async () => {
    data = await (await getSceneService()).exportData(await currentUser());
  });
  if (!data) return res;
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="scene-archive-${new Date().toISOString().slice(0, 10)}.json"`,
      'cache-control': 'no-store',
    },
  });
}
