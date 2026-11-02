import type { Metadata, Viewport } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { assetUrl } from '@/assets/manifest';
import { tokens, tokensToCssVars } from '@/design/tokens';
import './globals.css';

export const metadata: Metadata = {
  title: 'MBTI 마을',
  description: 'MBTI 16개 유형이 모여 사는 3D 마을. 광장에서 만나고, 토론 이벤트로 마을 땅을 넓힌다.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: tokens.color.bg,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" style={tokensToCssVars() as CSSProperties}>
      <head>
        {/* eslint-disable-next-line @next/next/no-css-tags -- 자체 호스팅 폰트 (manifest 키로 찾음) */}
        <link rel="stylesheet" href={assetUrl('font.pretendard')} />
      </head>
      <body>{children}</body>
    </html>
  );
}
