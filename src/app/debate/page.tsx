import type { Metadata } from 'next';
import { DebateClient } from '@/components/debate/DebateClient';

export const metadata: Metadata = { title: '오늘의 토론 · SCENE' };

export default function DebatePage() {
  return <DebateClient />;
}
