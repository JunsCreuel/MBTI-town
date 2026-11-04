'use client';

// 가방 (아래 탭): 지금 가진 코인·열매·물고기.
import { useEffect, useState } from 'react';
import { call } from '@/lib/api';
import type { PlayState } from '@/server/scene/service';
import { BagContent, DexContent } from '../app/Inventory';
import { TabBar } from '../app/TabBar';
import { useMe } from '../app/useMe';

function usePlay(ready: boolean) {
  const [state, setState] = useState<PlayState | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!ready) return;
    call<PlayState>('GET', '/api/play').then(setState).catch(() => setError(true));
  }, [ready]);
  return { state, error };
}

export function BagClient() {
  const { me } = useMe({ require: 'onboarded' });
  const { state, error } = usePlay(!!me);
  return (
    <main className="page page--tabs">
      <header className="page__head">
        <h1>가방</h1>
      </header>
      {error ? <p className="notice">가방을 열지 못했어요. 잠시 뒤에 다시 열어 주세요.</p> : state ? <BagContent state={state} /> : <div className="loader" aria-hidden />}
      <TabBar />
    </main>
  );
}

export function DexClient() {
  const { me } = useMe({ require: 'onboarded' });
  const { state, error } = usePlay(!!me);
  return (
    <main className="page page--tabs">
      <header className="page__head">
        <h1>도감</h1>
      </header>
      {error ? <p className="notice">도감을 열지 못했어요. 잠시 뒤에 다시 열어 주세요.</p> : state ? <DexContent state={state} /> : <div className="loader" aria-hidden />}
      <TabBar />
    </main>
  );
}
