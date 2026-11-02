// 로그인 방식. Supabase 주소와 공개 키가 있으면 Supabase Auth, 없으면 개발용 로그인(로컬 전용).
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export type AuthMode = 'supabase' | 'dev';

export function authMode(): AuthMode {
  return supabaseUrl && supabaseAnonKey ? 'supabase' : 'dev';
}

/** 로그인 화면에 보여 줄 소셜 로그인 (Supabase 대시보드에서 켠 것만 둔다) */
export const OAUTH_PROVIDERS = [
  { id: 'kakao', label: '카카오로 계속하기' },
  { id: 'google', label: 'Google로 계속하기' },
] as const;
