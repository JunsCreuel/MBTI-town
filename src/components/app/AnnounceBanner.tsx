'use client';

// 서버 전체 공지 띠: 실시간 방(마을·동네·놀이터·집 안)에서 공지가 오면 화면 위쪽에 몇 초 보인다.
// 방 세션이 showAnnouncement()를 부르면 이 띠가 받는다 (모든 화면에 하나, app/layout.tsx).
import { useEffect, useState } from 'react';
import type { AnnounceBroadcast } from '@/shared/announce';
import { Icon } from './Icon';
import { ItemIcon } from './Inventory';

const EVENT = 'scene:announce';
/** 띠가 보이는 시간 (ms) */
const SHOW_MS = 7000;

export function showAnnouncement(b: AnnounceBroadcast) {
  window.dispatchEvent(new CustomEvent<AnnounceBroadcast>(EVENT, { detail: b }));
}

export function AnnounceBanner() {
  const [queue, setQueue] = useState<AnnounceBroadcast[]>([]);
  const current = queue[0];

  useEffect(() => {
    const on = (e: Event) => {
      const b = (e as CustomEvent<AnnounceBroadcast>).detail;
      if (!b || typeof b.text !== 'string') return;
      // 같은 공지가 두 번 오면 (다시 연결 등) 한 번만
      setQueue((q) => (q.some((x) => x.at === b.at && x.text === b.text) ? q : [...q, b].slice(-5)));
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), SHOW_MS);
    return () => clearTimeout(t);
  }, [current]);

  if (!current) return null;
  return (
    <div className={`announce announce--${current.kind}`} role="status" aria-live="polite" key={`${current.at}:${current.text}`}>
      <span className="announce__icon" aria-hidden>
        {current.kind === 'golden_whale' ? (
          <ItemIcon kind="fish" id="golden_whale" size={34} />
        ) : current.kind === 'saju_ticket' ? (
          <ItemIcon kind="ticket" id="saju" size={34} />
        ) : current.kind === 'contest' ? (
          <Icon name="crown" size={22} />
        ) : (
          <Icon name="sparkle" size={20} />
        )}
      </span>
      <span className="announce__text">{current.text}</span>
      <button className="announce__close" onClick={() => setQueue((q) => q.slice(1))} aria-label="공지 닫기">
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
