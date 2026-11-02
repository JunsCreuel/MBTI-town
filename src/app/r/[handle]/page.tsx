import type { Metadata } from 'next';
import { VisitClient } from '@/components/room/VisitClient';

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  return { title: `@${(await params).handle}의 방 · SCENE` };
}

export default async function VisitPage({ params }: { params: Promise<{ handle: string }> }) {
  return <VisitClient handle={(await params).handle} />;
}
