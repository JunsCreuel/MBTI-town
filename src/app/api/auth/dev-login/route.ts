import { NextResponse } from 'next/server';
import { devLogin, devLoginEnabled } from '@/server/auth';
import { handle } from '@/server/http';

/** 개발용 로그인 (Supabase 설정이 없는 로컬에서만) */
export async function POST() {
  if (!devLoginEnabled()) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return handle(async () => {
    await devLogin();
  });
}
