import type { Metadata } from 'next';
import { DebateClient } from '@/components/debate/DebateClient';

export const metadata: Metadata = { title: '지난 토론 · MBTI 마을' };

export default async function PastDebatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DebateClient matchId={id} />;
}
