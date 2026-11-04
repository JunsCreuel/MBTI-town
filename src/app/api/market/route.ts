import { currentUser } from '@/server/auth';
import { handle, readJson } from '@/server/http';
import { getSceneService } from '@/server/scene';

export const dynamic = 'force-dynamic';

/** 상가 점포 (누구나). 로그인했으면 내 코인·내 점포도 */
export async function GET() {
  return handle(async () => (await getSceneService()).marketView(await currentUser()));
}

/** 빈 점포 사기: { slot, name, intro?, color? } */
export async function POST(request: Request) {
  return handle(async () => (await getSceneService()).buyShop(await currentUser(), await readJson(request)));
}

/** 내 점포 이름·소개·색 바꾸기: { name, intro?, color? } */
export async function PATCH(request: Request) {
  return handle(async () => (await getSceneService()).updateShop(await currentUser(), await readJson(request)));
}

/** 점포 비우기: ?slot=번호 (주인은 내 점포, 운영자는 아무 점포) */
export async function DELETE(request: Request) {
  return handle(async () => (await getSceneService()).releaseShop(await currentUser(), new URL(request.url).searchParams.get('slot')));
}
