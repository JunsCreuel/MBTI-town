import { currentUser } from '@/server/auth';
import { getDebateService } from '@/server/debate';
import { handle, readJson } from '@/server/http';

export async function POST(request: Request) {
  return handle(async () => {
    const { argumentId, on } = await readJson(request);
    await (await getDebateService()).recommend(await currentUser(), argumentId, on);
  });
}
