// 지금 요청한 사람이 누구인지. Supabase Auth 세션 또는 개발용 로그인 쿠키를 읽는다.
import 'server-only';
import { randomUUID } from 'node:crypto';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { authMode, supabaseAnonKey, supabaseUrl } from '@/lib/authConfig';
import { ensureDevAuthUser, getSql } from './db';

const DEV_COOKIE = 'mt_dev_uid';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface SessionUser {
  id: string;
}

/**
 * 개발용 로그인은 Supabase가 없고, 운영이 아닐 때만 쓴다.
 * 쿠키에 적힌 계정 번호를 그대로 믿으므로 실제 DB(DATABASE_URL)나 Vercel 배포에서는 어떤 설정으로도 켜지지 않는다
 */
export function devLoginEnabled(): boolean {
  if (authMode() !== 'dev' || process.env.DATABASE_URL || process.env.VERCEL) return false;
  return process.env.NODE_ENV !== 'production' || process.env.DEBATE_ALLOW_DEV_LOGIN === '1';
}

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 라우트 핸들러에서만 세션이 갱신된다.
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {}
      },
    },
  });
}

export async function currentUser(): Promise<SessionUser | null> {
  if (authMode() === 'supabase') {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    return data.user ? { id: data.user.id } : null;
  }
  if (!devLoginEnabled()) return null;
  const id = (await cookies()).get(DEV_COOKIE)?.value;
  return id && UUID.test(id) ? { id } : null;
}

export async function devLogin(): Promise<SessionUser> {
  if (!devLoginEnabled()) throw new Error('개발용 로그인을 쓸 수 없습니다');
  const store = await cookies();
  const existing = store.get(DEV_COOKIE)?.value;
  const id = existing && UUID.test(existing) ? existing : randomUUID();
  await ensureDevAuthUser(await getSql(), id);
  store.set(DEV_COOKIE, id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return { id };
}

export async function logout(): Promise<void> {
  if (authMode() === 'supabase') {
    await (await supabaseServer()).auth.signOut();
    return;
  }
  (await cookies()).delete(DEV_COOKIE);
}
