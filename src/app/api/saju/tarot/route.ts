import { currentUser } from '@/server/auth';
import { handle, readJson } from '@/server/http';
import { getSceneService } from '@/server/scene';

export const dynamic = 'force-dynamic';

/** 타로 보기: { spread: 'one' | 'three', topic?: 'general' | 'love' | 'work' | 'money', picks: number[] } */
export async function POST(request: Request) {
  return handle(async () => (await getSceneService()).readTarot(await currentUser(), await readJson(request)));
}
