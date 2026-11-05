import { recordConfig } from '@/config/game';
import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { getSceneService } from '@/server/scene';
import { SceneError } from '@/server/scene/service';

/** 내 사진 목록 (액자에 걸 사진 고르기) */
export async function GET() {
  return handle(async () => ({ photos: await (await getSceneService()).myPhotos(await currentUser()) }));
}

/** 사진 올리기: 본문 = 이미지 파일 그대로. 화면에서 미리 줄여 보낸다. ?w=&h= 는 크기 */
export async function POST(request: Request) {
  return handle(async () => {
    // 로그인부터 확인하고 본문을 읽는다 (로그인 안 한 요청이 큰 본문으로 서버를 붙잡지 않게)
    const viewer = await currentUser();
    if (!viewer) throw new SceneError('login_required', '로그인이 필요해요.');
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > recordConfig.photoMaxBytes) throw new SceneError('too_large', '사진이 너무 커요.');
    const bytes = new Uint8Array(await request.arrayBuffer());
    const q = new URL(request.url).searchParams;
    return (await getSceneService()).uploadPhoto(viewer, bytes, { width: Number(q.get('w')), height: Number(q.get('h')) });
  });
}
