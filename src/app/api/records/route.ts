import { currentUser } from '@/server/auth';
import { handle, readJson } from '@/server/http';
import { getSceneService } from '@/server/scene';

/** 내 기록 (최신순, ?before=시각 으로 더 불러온다) */
export async function GET(request: Request) {
  return handle(async () => {
    const before = new URL(request.url).searchParams.get('before') ?? undefined;
    return { records: await (await getSceneService()).myRecords(await currentUser(), before) };
  });
}

export async function POST(request: Request) {
  return handle(async () => (await getSceneService()).createRecord(await currentUser(), await readJson(request)));
}
