import { currentUser } from '@/server/auth';
import { handle, readJson } from '@/server/http';
import { getSceneService } from '@/server/scene';
import type { OnboardingInput } from '@/server/scene/service';

/** 첫 가입 7단계를 한 번에 저장한다 */
export async function POST(request: Request) {
  return handle(async () =>
    (await getSceneService()).completeOnboarding(await currentUser(), (await readJson(request)) as unknown as OnboardingInput),
  );
}
