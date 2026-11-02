import { currentUser } from '@/server/auth';
import { getDebateService } from '@/server/debate';
import { handle, readJson } from '@/server/http';

export async function POST(request: Request) {
  return handle(async () => {
    const { body } = await readJson(request);
    const arg = await (await getDebateService()).submitArgument(await currentUser(), body);
    return { id: arg.id };
  });
}
