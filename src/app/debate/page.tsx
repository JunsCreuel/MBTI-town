import type { Metadata } from 'next';
import { DebateClient } from '@/components/debate/DebateClient';

export const metadata: Metadata = { title: '오늘의 토론 · MBTI 마을' };

export default function DebatePage() {
  return <DebateClient />;
}
