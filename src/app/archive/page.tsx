import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ArchiveRoute } from '@/components/archive/ArchiveClient';

export const metadata: Metadata = { title: '나의 기록 · SCENE' };

export default function ArchivePage() {
  return (
    <Suspense>
      <ArchiveRoute />
    </Suspense>
  );
}
