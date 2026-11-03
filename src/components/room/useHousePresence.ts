'use client';

// 방 화면에서 같은 방 연결을 만들고, 연결 상태와 함께 있는 사람 수를 돌려준다.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { HousePresence } from './presence';

const noopSubscribe = () => () => {};

/** handle: 들어갈 집 주소 (방을 볼 수 없으면 null을 넘겨 연결하지 않는다) */
export function useHousePresence(handle: string | null) {
  const presence = useMemo(() => (handle ? new HousePresence(handle) : null), [handle]);
  useEffect(() => {
    if (!presence) return;
    void presence.prepare();
    return () => presence.dispose();
  }, [presence]);
  const snap = useSyncExternalStore(
    presence?.subscribe ?? noopSubscribe,
    () => presence?.getSnapshot() ?? null,
    () => null,
  );
  const others = useMemo(() => (presence && snap ? presence.others(snap).length : 0), [presence, snap]);
  return { presence, snap, others };
}
