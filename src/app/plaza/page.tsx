import type { Viewport } from 'next';
import { PlazaClient } from '@/components/plaza/PlazaClient';
import { isMbtiType } from '@/design/mbti';

// 마을 화면에서는 두 손가락 확대를 카메라 줌으로 쓰므로 페이지 확대를 막는다
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function PlazaPage({ searchParams }: { searchParams: Promise<{ mbti?: string }> }) {
  const { mbti } = await searchParams;
  return <PlazaClient initialMbti={isMbtiType(mbti) ? mbti : null} />;
}
