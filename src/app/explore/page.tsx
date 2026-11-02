import type { Metadata } from 'next';
import { ExploreClient } from '@/components/explore/ExploreClient';

export const metadata: Metadata = { title: '마을 · SCENE' };

export default function ExplorePage() {
  return <ExploreClient />;
}
