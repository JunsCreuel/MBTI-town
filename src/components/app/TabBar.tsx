'use client';

// 하단 탭: 마을(기본 틀) · 나의 방(마을 속 내 집) · 가방 · 도감 · 캐릭터 · 기록 · MY. SHOP은 2차.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';

const TABS = [
  // 이웃 방 둘러보기(/explore)도 마을 탭에 속한다
  { href: '/village', label: '마을', icon: 'map', also: ['/explore'] },
  { href: '/home', label: '나의 방', icon: 'home', also: [] },
  { href: '/bag', label: '가방', icon: 'basket', also: [] },
  { href: '/dex', label: '도감', icon: 'dex', also: [] },
  { href: '/character', label: '캐릭터', icon: 'character', also: [] },
  { href: '/archive', label: '기록', icon: 'archive', also: [] },
  { href: '/my', label: 'MY', icon: 'my', also: [] },
] as const;

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="메뉴">
      {TABS.map((t) => {
        const on = [t.href, ...t.also].some((h: string) => path === h || path.startsWith(`${h}/`));
        return (
          <Link key={t.href} href={t.href} className={`tabbar__item${on ? ' tabbar__item--on' : ''}`} aria-current={on ? 'page' : undefined}>
            <Icon name={t.icon} size={20} />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
