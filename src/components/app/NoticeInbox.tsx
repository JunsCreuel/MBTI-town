'use client';

// 내게 온 알림 (운영자가 코인을 선물했다, 방에 다녀갔다): 들어올 때와 1분마다 확인해서 화면 위 공지 띠로 크게 보인다.
// 로그인 안 했으면 서버가 빈 목록을 준다. 다른 탭을 보는 동안에는 묻지 않는다.
import { useEffect } from 'react';
import { showAnnouncement } from './AnnounceBanner';

const EVERY_MS = 60_000;

export function NoticeInbox() {
  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch('/api/me/notices', { method: 'POST', cache: 'no-store' });
        if (!res.ok || !alive) return;
        const { notices } = (await res.json()) as { notices: { kind: 'gift' | 'visit'; text: string; at: string }[] };
        for (const n of notices) showAnnouncement({ kind: n.kind, text: n.text, at: Date.parse(n.at) });
      } catch {
        // 다음 번에 다시
      }
    };
    void check();
    const t = setInterval(() => void check(), EVERY_MS);
    const onVisible = () => !document.hidden && void check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return null;
}
