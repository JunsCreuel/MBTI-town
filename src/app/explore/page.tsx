import type { Metadata } from 'next';
import { ExploreClient } from '@/components/explore/ExploreClient';

export const metadata: Metadata = { title: '둘러보기 · SCENE' };

export default function ExplorePage() {
  return <ExploreClient />;
}
