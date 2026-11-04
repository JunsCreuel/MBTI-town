import type { Metadata } from 'next';
import { BagClient } from '@/components/play/BagClient';

export const metadata: Metadata = { title: '가방 · SCENE' };

export default function Page() {
  return <BagClient />;
}
