import type { Metadata } from 'next';
import { DexClient } from '@/components/play/BagClient';

export const metadata: Metadata = { title: '도감 · SCENE' };

export default function Page() {
  return <DexClient />;
}
