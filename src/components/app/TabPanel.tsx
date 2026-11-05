'use client';

// 마을·방 위에 여는 탭 창: 가방·도감·캐릭터·기록·MY를 장면을 떠나지 않고 열고 닫는다.
// 내 캐릭터는 그 자리에 그대로 있다 (실시간 방도 그대로). 닫기·같은 탭 다시 누르기·Esc로 닫는다.
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { Icon } from './Icon';
import { setPanelOpen, type PanelTab } from './panelState';

const loading = () => <main className="page page--center"><div className="loader" aria-hidden /></main>;
const BagClient = dynamic(() => import('../play/BagClient').then((m) => m.BagClient), { ssr: false, loading });
const DexClient = dynamic(() => import('../play/BagClient').then((m) => m.DexClient), { ssr: false, loading });
const CharacterClient = dynamic(() => import('../character/CharacterClient').then((m) => m.CharacterClient), { ssr: false, loading });
const ArchiveClient = dynamic(() => import('../archive/ArchiveClient').then((m) => m.ArchiveClient), { ssr: false, loading });
const MyClient = dynamic(() => import('../my/MyClient').then((m) => m.MyClient), { ssr: false, loading });

export const PANEL_LABEL: Record<PanelTab, string> = { bag: '가방', dex: '도감', character: '캐릭터', archive: '기록', my: 'MY' };

export function TabPanel({ tab, startNew, onClose }: { tab: PanelTab; startNew?: boolean; onClose: () => void }) {
  useEffect(() => {
    setPanelOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      setPanelOpen(false);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="tab-panel" role="dialog" aria-modal="true" aria-label={PANEL_LABEL[tab]}>
      <button className="icon-btn tab-panel__close" aria-label={`${PANEL_LABEL[tab]} 닫기`} onClick={onClose}>
        <Icon name="close" size={20} />
      </button>
      {tab === 'bag' && <BagClient embedded />}
      {tab === 'dex' && <DexClient embedded />}
      {tab === 'character' && <CharacterClient embedded />}
      {tab === 'archive' && <ArchiveClient embedded startNew={startNew} />}
      {tab === 'my' && <MyClient embedded />}
    </div>
  );
}
