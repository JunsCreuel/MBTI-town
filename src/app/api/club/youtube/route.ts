import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { SceneError } from '@/server/scene/service';
import { lookupYoutube } from '@/server/youtube';

export const dynamic = 'force-dynamic';

/** 클럽 유튜브 신청곡 확인: ?url=유튜브 링크 → 서명한 신청표 (로그인한 주민만) */
export async function GET(request: Request) {
  return handle(async () => {
    if (!(await currentUser())) throw new SceneError('login_required', '로그인한 주민만 유튜브 곡을 신청할 수 있어요.');
    return lookupYoutube(new URL(request.url).searchParams.get('url'));
  });
}
