import { NextResponse } from 'next/server';
import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { getSceneService } from '@/server/scene';

/** 사진 보기. 볼 수 없는 사진은 없는 것처럼 404. 공개 범위가 바뀔 수 있어 공용 캐시에 두지 않는다. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  let photo: { mime: string; bytes: Uint8Array } | null = null;
  const res = await handle(async () => {
    photo = await (await getSceneService()).photo(await currentUser(), id);
  });
  if (!photo) return res;
  const { mime, bytes } = photo as { mime: string; bytes: Uint8Array };
  return new NextResponse(Buffer.from(bytes), {
    headers: { 'content-type': mime, 'cache-control': 'private, max-age=300', 'x-content-type-options': 'nosniff' },
  });
}
