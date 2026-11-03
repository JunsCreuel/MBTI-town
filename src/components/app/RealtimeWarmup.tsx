'use client';

// 어느 화면에 들어오든 실시간 서버를 미리 깨운다 (마을로 갈 때 기다리지 않게).
// 같은 탭에서는 몇 분에 한 번만 깨운다. 서버는 15분 동안 아무도 없으면 잠든다.
import { useEffect } from 'react';
import { wakeRealtime } from '@/lib/realtime';

const KEY = 'scene:realtime-woken';
const EVERY_MS = 4 * 60_000;

export function RealtimeWarmup() {
  useEffect(() => {
    // 실시간 서버 주소가 없는 개발 환경에서도 같은 주소 규칙(:2567)으로 깨운다
    try {
      const last = Number(sessionStorage.getItem(KEY) ?? 0);
      if (Date.now() - last < EVERY_MS) return;
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch {
      // 저장소를 못 쓰면 그냥 깨운다
    }
    void wakeRealtime();
  }, []);
  return null;
}
