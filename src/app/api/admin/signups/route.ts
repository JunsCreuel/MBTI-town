import { supabaseAnonKey, supabaseUrl } from '@/lib/authConfig';
import { fetchAuthSettings } from '@/lib/authSettings';
import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { getSceneService } from '@/server/scene';

/** 가입 도움 (운영자만): ?q=이메일 일부. 계정 목록·막힌 기록과 Supabase 가입 설정(메일 인증을 하는지) */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q');
  return handle(async () => {
    const data = await (await getSceneService()).adminSignups(await currentUser(), q);
    return { ...data, auth: await fetchAuthSettings(supabaseUrl, supabaseAnonKey) };
  });
}

/** 막힌 기록 비우기 (운영자만) */
export async function DELETE() {
  return handle(async () => (await getSceneService()).adminClearSignupFailures(await currentUser()));
}
