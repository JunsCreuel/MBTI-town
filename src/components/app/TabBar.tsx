'use client';

// 하단 탭: 마을(기본 틀) · 나의 방(마을 속 내 집) · 가방 · 도감 · 캐릭터 · 기록 · MY. SHOP은 2차.
// stay: 마을·방 화면에서는 가방·도감·캐릭터·기록·MY를 다른 화면으로 옮기지 않고 그 위에 창으로 열고 닫는다
// (내 캐릭터는 그 자리 그대로. 같은 탭을 다시 누르거나 닫기를 누르면 닫힌다).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from './Icon';
import { PANEL_CLOSED_EVENT, onOpenPanel, type PanelTab } from './panelState';
import { TabPanel } from './TabPanel';

const TABS = [
  // 이웃 방 둘러보기(/explore)도 마을 탭에 속한다
  { href: '/village', label: '마을', icon: 'map', also: ['/explore'] },
  { href: '/home', label: '나의 방', icon: 'home', also: [] },
  { href: '/bag', label: '가방', icon: 'basket', also: [], panel: 'bag' },
  { href: '/dex', label: '도감', icon: 'dex', also: [], panel: 'dex' },
  { href: '/character', label: '캐릭터', icon: 'character', also: [], panel: 'character' },
  { href: '/archive', label: '기록', icon: 'archive', also: [], panel: 'archive' },
  { href: '/my', label: 'MY', icon: 'my', also: [], panel: 'my' },
] as const;

export function TabBar({ stay = false }: { stay?: boolean }) {
  const path = usePathname();
  const [panel, setPanel] = useState<{ tab: PanelTab; startNew?: boolean } | null>(null);
  const close = useCallback(() => {
    setPanel(null);
    window.dispatchEvent(new Event(PANEL_CLOSED_EVENT));
  }, []);
  // 방의 책상처럼 화면 안에서 창을 열 때
  useEffect(() => (stay ? onOpenPanel((tab, opts) => setPanel({ tab, ...opts })) : undefined), [stay]);

  return (
    <>
      {panel && <TabPanel tab={panel.tab} startNew={panel.startNew} onClose={close} />}
      <nav className="tabbar" aria-label="메뉴">
        {TABS.map((t) => {
          const p = 'panel' in t ? t.panel : null;
          const here = [t.href, ...t.also].some((h: string) => path === h || path.startsWith(`${h}/`));
          const on = panel ? panel.tab === p : here;
          const content = (
            <>
              <Icon name={t.icon} size={20} />
              <span>{t.label}</span>
            </>
          );
          if (stay && p) {
            return (
              <button
                key={t.href}
                type="button"
                className={`tabbar__item${on ? ' tabbar__item--on' : ''}`}
                aria-pressed={on}
                onClick={() => (panel?.tab === p ? close() : setPanel({ tab: p }))}
              >
                {content}
              </button>
            );
          }
          // 지금 있는 화면의 탭을 누르면 열린 창만 닫는다
          if (stay && here && panel) {
            return (
              <button key={t.href} type="button" className="tabbar__item" onClick={close}>
                {content}
              </button>
            );
          }
          return (
            <Link key={t.href} href={t.href} className={`tabbar__item${on ? ' tabbar__item--on' : ''}`} aria-current={on ? 'page' : undefined}>
              {content}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
