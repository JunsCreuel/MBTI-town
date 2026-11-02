import { NextResponse } from 'next/server';
import { supabaseServer } from '@/server/auth';

/** Supabase 소셜·이메일 로그인에서 돌아오는 주소. 받은 코드를 세션으로 바꾼다. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/debate';
  // 다른 사이트로 보내지 않게 경로만 받는다
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/debate';
  if (code) {
    const { error } = await (await supabaseServer()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL('/login?error=1', url.origin));
}
