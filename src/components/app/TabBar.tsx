'use client';

// 하단 탭: HOME(나의 방) · EXPLORE(마을) · ARCHIVE(나의 기록) · MY(설정). SHOP은 2차.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';

const TABS = [
  { href: '/home', label: '나의 방', icon: 'home' },
  { href: '/explore', label: '마을', icon: 'map' },
  { href: '/archive', label: '기록', icon: 'archive' },
  { href: '/my', label: 'MY', icon: 'my' },
] as const;

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="메뉴">
      {TABS.map((t) => {
        const on = path === t.href || path.startsWith(`${t.href}/`);
        return (
          <Link key={t.href} href={t.href} className={`tabbar__item${on ? ' tabbar__item--on' : ''}`} aria-current={on ? 'page' : undefined}>
            <Icon name={t.icon} size={22} />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
