// UI 아이콘 (SVG, currentColor). 키는 manifest의 ui.icon.* / ui.emotion.*
import type { CSSProperties } from 'react';
import { assetUrl } from '@/assets/manifest';

export function Icon({ name, size = 22, emotion = false, className = '' }: { name: string; size?: number; emotion?: boolean; className?: string }) {
  const url = assetUrl(emotion ? `ui.emotion.${name}` : `ui.icon.${name}`);
  return (
    <span
      className={`icon ${className}`}
      style={{ '--icon': `url(${url})`, width: size, height: size } as CSSProperties}
      aria-hidden
    />
  );
}
