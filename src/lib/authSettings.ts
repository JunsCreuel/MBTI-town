// Supabase Auth 공개 설정 (/auth/v1/settings): 새 가입을 받는지, 가입할 때 인증 메일을 보내는지.
// 로그인 화면(가입 버튼 문구)과 운영 화면(가입 설정 점검)이 같이 쓴다. 공개 키만으로 읽힌다.

export interface AuthSettings {
  /** 새 가입을 받는지 */
  signup: boolean;
  /** 가입할 때 인증 메일을 보내는지 (대시보드 Confirm email) */
  confirmEmail: boolean;
}

export function parseAuthSettings(v: unknown): AuthSettings | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as { disable_signup?: unknown; mailer_autoconfirm?: unknown };
  if (typeof s.mailer_autoconfirm !== 'boolean') return null;
  return { signup: s.disable_signup !== true, confirmEmail: !s.mailer_autoconfirm };
}

/** 못 읽으면 null (주소·키가 없거나, 응답이 없거나, 모양이 다르면) */
export async function fetchAuthSettings(url: string, anonKey: string, timeoutMs = 4000): Promise<AuthSettings | null> {
  if (!url || !anonKey) return null;
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey }, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
    return res.ok ? parseAuthSettings(await res.json()) : null;
  } catch {
    return null;
  }
}
