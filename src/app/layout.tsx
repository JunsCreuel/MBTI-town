import type { Metadata, Viewport } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { assetUrl } from '@/assets/manifest';
import { RealtimeWarmup } from '@/components/app/RealtimeWarmup';
import { tokens, tokensToCssVars } from '@/design/tokens';
import './globals.css';

export const metadata: Metadata = {
  title: 'SCENE',
  description: '나의 취향과 일상을 하나의 공간에 담는 미니홈피. 방을 꾸미고, 음악과 기록을 남기고, 친구 방에 놀러 가요.',
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
      <body>
        {children}
        <RealtimeWarmup />
      </body>
    </html>
  );
}
