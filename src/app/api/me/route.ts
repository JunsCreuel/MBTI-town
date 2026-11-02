import { authMode } from '@/lib/authConfig';
import { currentUser, devLoginEnabled } from '@/server/auth';
import { getDebateService } from '@/server/debate';
import { DebateError } from '@/server/debate/service';
import { handle, readJson } from '@/server/http';
import { getSceneService } from '@/server/scene';
import type { MyProfile } from '@/server/scene/service';
import type { RoomLayout } from '@/shared/room';

export interface MeResponse {
  authMode: 'supabase' | 'dev';
  devLogin: boolean;
  loggedIn: boolean;
  profile: MyProfile | null;
  room: { layout: RoomLayout; bgm: string | null } | null;
  /** 오늘의 토론에 쓰는 MBTI */
  mbti: string | null;
  mbtiChangeableAt: string | null;
}

export async function GET() {
  return handle(async (): Promise<MeResponse> => {
    const user = await currentUser();
    const debate = await getDebateService();
    const me = user ? await (await getSceneService()).me(user) : null;
    const debateProfile = user ? await debate.profile(user.id) : null;
    return {
      authMode: authMode(),
      devLogin: devLoginEnabled(),
      loggedIn: !!user,
      profile: me?.profile ?? null,
      room: me?.room ?? null,
      mbti: debateProfile?.mbti ?? null,
      mbtiChangeableAt: debate.mbtiChangeableAt(debateProfile)?.toISOString() ?? null,
    };
  });
}

/** 프로필·설정 바꾸기 (보낸 칸만) */
export async function PATCH(request: Request) {
  return handle(async () => (await getSceneService()).updateProfile(await currentUser(), await readJson(request)));
}

/** MBTI 정하기·바꾸기 (7일에 한 번) */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await currentUser();
    if (!user) throw new DebateError('login_required', '로그인이 필요해요.');
    const { mbti } = await readJson(request);
    await (await getDebateService()).setMbti(user, String(mbti ?? ''));
  });
}
