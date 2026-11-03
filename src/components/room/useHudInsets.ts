'use client';

// 방 화면에서 위·아래 HUD가 실제로 가리는 높이를 잰다. 3D 방이 그 사이 가운데에 오게 맞추는 데 쓴다.
// HUD 요소에는 data-hud="top" / data-hud="bottom"을 붙인다. 없으면 fallback 값을 쓴다.
import { useEffect, useState } from 'react';

const GAP = 8;

export function useHudInsets(key: unknown, fallback: { top: number; bottom: number }) {
  const [insets, setInsets] = useState(fallback);
  useEffect(() => {
    const measure = () => {
      const top = document.querySelector<HTMLElement>('[data-hud="top"]');
      const bottom = document.querySelector<HTMLElement>('[data-hud="bottom"]');
      const next = {
        top: top ? Math.round(top.getBoundingClientRect().bottom + GAP) : fallback.top,
        bottom: bottom ? Math.round(window.innerHeight - bottom.getBoundingClientRect().top + GAP) : fallback.bottom,
      };
      setInsets((cur) => (cur.top === next.top && cur.bottom === next.bottom ? cur : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    document.querySelectorAll('[data-hud]').forEach((el) => ro.observe(el));
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
    // key: 모드가 바뀌어 HUD가 바뀌면 다시 잰다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return insets;
}
