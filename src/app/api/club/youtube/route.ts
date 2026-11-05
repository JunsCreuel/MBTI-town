import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { SceneError } from '@/server/scene/service';
import { getSceneService } from '@/server/scene';
import { allow } from '@/server/rateLimit';
import { lookupYoutube } from '@/server/youtube';

export const dynamic = 'force-dynamic';

/** 클럽 유튜브 신청곡 확인: ?url=유튜브 링크 → 서명한 신청표 (로그인한 주민만) */
export async function GET(request: Request) {
  return handle(async () => {
    const viewer = await currentUser();
    if (!viewer) throw new SceneError('login_required', '로그인한 주민만 유튜브 곡을 신청할 수 있어요.');
    const service = await getSceneService();
    await service.requireResident(viewer);
    // YouTube API 하루 한도를 한 사람이 다 쓰지 못하게 (10분에 20번)
    if (!allow(`yt:${viewer.id}`, 20, 10 * 60_000)) throw new SceneError('limit', '유튜브 곡 확인을 너무 자주 했어요. 잠시 뒤에 다시 해 주세요.');
    return lookupYoutube(new URL(request.url).searchParams.get('url'), Date.now(), service.youtubeLimits());
  });
}
