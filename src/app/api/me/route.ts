import { authMode } from '@/lib/authConfig';
import { currentUser, devLoginEnabled } from '@/server/auth';
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
  /** MBTI (= 사는 마을, 토론 편) */
  mbti: string | null;
  mbtiChangeableAt: string | null;
}

export async function GET() {
  return handle(async (): Promise<MeResponse> => {
    const user = await currentUser();
    const me = user ? await (await getSceneService()).me(user) : null;
    return {
      authMode: authMode(),
      devLogin: devLoginEnabled(),
      loggedIn: !!user,
      profile: me?.profile ?? null,
      room: me?.room ?? null,
      mbti: me?.profile.mbti ?? null,
      mbtiChangeableAt: me?.profile.mbtiChangeableAt ?? null,
    };
  });
}

/** 프로필·설정 바꾸기 (보낸 칸만) */
export async function PATCH(request: Request) {
  return handle(async () => (await getSceneService()).updateProfile(await currentUser(), await readJson(request)));
}

/** MBTI 정하기·바꾸기 = 그 유형 마을로 이사 (바꾼 뒤 7일에 한 번) */
export async function POST(request: Request) {
  return handle(async () => {
    const { mbti } = await readJson(request);
    return (await getSceneService()).changeMbti(await currentUser(), mbti);
  });
}
