import type { Metadata } from 'next';
import { safeNext as cleanNext } from '@/lib/safeNext';
import { LoginClient } from '@/components/debate/LoginClient';
import { authMode } from '@/lib/authConfig';
import { devLoginEnabled } from '@/server/auth';

export const metadata: Metadata = { title: '로그인 · SCENE' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const safeNext = cleanNext(next);
  return <LoginClient mode={authMode()} devLogin={devLoginEnabled()} next={safeNext} failed={error ?? null} />;
}
