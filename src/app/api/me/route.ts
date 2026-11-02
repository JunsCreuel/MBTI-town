import { authMode } from '@/lib/authConfig';
import { currentUser, devLoginEnabled } from '@/server/auth';
import { getDebateService } from '@/server/debate';
import { DebateError } from '@/server/debate/service';
import { handle, readJson } from '@/server/http';

export interface MeResponse {
  authMode: 'supabase' | 'dev';
  devLogin: boolean;
  loggedIn: boolean;
  mbti: string | null;
  mbtiChangeableAt: string | null;
}

export async function GET() {
  return handle(async (): Promise<MeResponse> => {
    const user = await currentUser();
    const service = await getDebateService();
    const profile = user ? await service.profile(user.id) : null;
    return {
      authMode: authMode(),
      devLogin: devLoginEnabled(),
      loggedIn: !!user,
      mbti: profile?.mbti ?? null,
      mbtiChangeableAt: service.mbtiChangeableAt(profile)?.toISOString() ?? null,
    };
  });
}

/** 내 MBTI 정하기 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await currentUser();
    if (!user) throw new DebateError('login_required', '로그인이 필요해요.');
    const { mbti } = await readJson(request);
    await (await getDebateService()).setMbti(user, String(mbti ?? ''));
  });
}
