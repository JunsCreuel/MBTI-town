// 광장 전광판·대항전 칩이 같이 쓰는 자료 (대항전 순위, 지난주 우승, 오늘의 토론). 1분마다 새로 받는다.
import { useEffect, useSyncExternalStore } from 'react';
import type { PlazaBoard } from '@/server/plazaBoard';

export type { PlazaBoard };

const REFRESH_MS = 60_000;
let board: PlazaBoard | null = null;
/** 서버 시각 - 내 시각 (남은 시간을 서버 시계로 센다) */
let offsetMs = 0;
const listeners = new Set<() => void>();
let users = 0;
let timer: ReturnType<typeof setInterval> | undefined;

export async function refreshBoard(): Promise<void> {
  try {
    const res = await fetch('/api/plaza/board', { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as PlazaBoard;
    offsetMs = new Date(data.serverNow).getTime() - Date.now();
    board = data;
    listeners.forEach((fn) => fn());
  } catch {
    // 다음 차례에 다시 받는다
  }
}

/** 서버 시계로 지금 */
export const boardNow = () => new Date(Date.now() + offsetMs);
/** 서버 시계로 지금 (ms). 전광판 자료를 아직 못 받았으면 내 시계 */
export const serverNowMs = () => Date.now() + offsetMs;

/** 전광판 자료 (화면에 하나라도 쓰는 곳이 있으면 1분마다 받는다) */
export function usePlazaBoard(enabled = true): PlazaBoard | null {
  const value = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    () => board,
    () => null,
  );
  useEffect(() => {
    if (!enabled) return;
    if (users++ === 0) {
      void refreshBoard();
      timer = setInterval(() => void refreshBoard(), REFRESH_MS);
    }
    return () => {
      if (--users === 0) clearInterval(timer);
    };
  }, [enabled]);
  return value;
}

/** 지금 들고 있는 자료 (3D 화면이 그릴 때 읽는다) */
export const currentBoard = () => board;
