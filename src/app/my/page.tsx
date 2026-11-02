import type { Metadata } from 'next';
import { MyClient } from '@/components/my/MyClient';

export const metadata: Metadata = { title: 'MY · SCENE' };

export default function MyPage() {
  return <MyClient />;
}
