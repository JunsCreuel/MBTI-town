import type { Metadata } from 'next';
import { DebateClient } from '@/components/debate/DebateClient';

export const metadata: Metadata = { title: '지난 토론 · SCENE' };

export default async function PastDebatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DebateClient matchId={id} />;
}
