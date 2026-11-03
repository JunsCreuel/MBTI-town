import type { Metadata } from 'next';
import { ResetPasswordClient } from '@/components/debate/ResetPasswordClient';

export const metadata: Metadata = { title: '새 비밀번호 · SCENE' };

/** 비밀번호 재설정 메일의 링크로 들어오는 곳 (/auth/callback이 세션을 만든 뒤) */
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/home';
  return <ResetPasswordClient next={safeNext} />;
}
