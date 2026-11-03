import { NextResponse } from 'next/server';
import { supabaseServer } from '@/server/auth';

/**
 * Supabase 소셜 로그인·가입 인증 메일·비밀번호 재설정 메일에서 돌아오는 주소. 받은 코드를 세션으로 바꾼다.
 * 실패하면 왜 실패했는지 로그인 화면에 알려 준다 (/login?error=…):
 * - expired: 링크가 만료됐거나 이미 쓰였다
 * - browser: 링크를 요청한 브라우저가 아닌 곳에서 열었다 (가입 인증은 이미 끝났으니 비밀번호로 로그인하면 된다)
 * - reset_browser: 비밀번호 재설정 링크를 다른 브라우저에서 열었다
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/home';
  // 다른 사이트로 보내지 않게 경로만 받는다
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/home';
  const reset = safeNext.startsWith('/login/reset');
  const fail = (kind: string) => NextResponse.redirect(new URL(`/login?error=${kind}`, url.origin));

  const linkError = url.searchParams.get('error_code') ?? url.searchParams.get('error');
  if (!code) return fail(linkError === 'otp_expired' ? 'expired' : '1');
  const { error } = await (await supabaseServer()).auth.exchangeCodeForSession(code);
  if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  const verifierMissing = error.name === 'AuthPKCECodeVerifierMissingError' || error.code === 'bad_code_verifier' || /code verifier/i.test(error.message);
  if (verifierMissing) return fail(reset ? 'reset_browser' : 'browser');
  if (error.code === 'flow_state_expired' || error.code === 'flow_state_not_found' || error.code === 'otp_expired') return fail('expired');
  return fail('1');
}
