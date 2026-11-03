import { currentUser } from '@/server/auth';
import { handle, readJson } from '@/server/http';
import { getSceneService } from '@/server/scene';

export const dynamic = 'force-dynamic';

/** 나무에서 열매 따기. body: { spot: "fruit.wood.0" | "fortune" } */
export async function POST(request: Request) {
  return handle(async () => (await getSceneService()).pickTree(await currentUser(), (await readJson(request)).spot));
}
