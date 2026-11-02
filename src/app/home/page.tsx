import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HomeClient } from '@/components/home/HomeClient';

export const metadata: Metadata = { title: '나의 방 · SCENE' };

export default function HomePage() {
  return (
    <Suspense>
      <HomeClient />
    </Suspense>
  );
}
