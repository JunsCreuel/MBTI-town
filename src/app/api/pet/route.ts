import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { getSceneService } from '@/server/scene';
import { PET_CARE_ACTIONS, type PetCareAction } from '@/shared/petCare';
import { SceneError } from '@/server/scene/service';

export const dynamic = 'force-dynamic';

/** 내 강아지 친밀도 (준비 전이면 care: null) */
export async function GET() {
  return handle(async () => ({ care: await (await getSceneService()).petCare(await currentUser()) }));
}

/** 밥 주기·쓰다듬기·산책 { action } */
export async function POST(req: Request) {
  return handle(async () => {
    const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
    const action = body?.action;
    if (!PET_CARE_ACTIONS.includes(action as PetCareAction)) throw new SceneError('bad_request', '알 수 없는 돌보기예요.');
    return (await getSceneService()).careForPet(await currentUser(), action as PetCareAction);
  });
}
