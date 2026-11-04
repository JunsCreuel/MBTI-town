import type { Metadata } from 'next';
import { CharacterClient } from '@/components/character/CharacterClient';

export const metadata: Metadata = { title: '내 캐릭터 · SCENE' };

export default function Page() {
  return <CharacterClient />;
}
