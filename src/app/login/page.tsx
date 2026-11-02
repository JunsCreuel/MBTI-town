import type { Metadata } from 'next';
import { LoginClient } from '@/components/debate/LoginClient';
import { authMode } from '@/lib/authConfig';
import { devLoginEnabled } from '@/server/auth';

export const metadata: Metadata = { title: '로그인 · MBTI 마을' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/debate';
  return <LoginClient mode={authMode()} devLogin={devLoginEnabled()} next={safeNext} failed={!!error} />;
}
