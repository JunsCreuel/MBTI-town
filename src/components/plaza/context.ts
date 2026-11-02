import { createContext, useContext } from 'react';
import type { PlazaMap } from '@/shared/plazaMap';
import type { PlazaSession } from './session';
import type { PlazaAssets } from './assets';

/** 장면 안에서 공유하는 입력 상태. React 상태가 아니라 매 프레임 읽고 쓰는 값이다. */
export interface PlazaInput {
  /** 누르고 있는 방향키 */
  keys: Set<string>;
  /** 바닥을 눌러 정한 목적지 (처리하면 null) */
  tapTarget: { x: number; z: number } | null;
  /** 내 캐릭터 위치 (카메라가 따라간다) */
  self: { x: number; z: number; ready: boolean };
  /** 탭 표시 위치와 시각 */
  marker: { x: number; z: number; at: number };
}

export interface PlazaContextValue {
  session: PlazaSession;
  selfId: string;
  map: PlazaMap;
  assets: PlazaAssets;
  input: PlazaInput;
}

export const PlazaContext = createContext<PlazaContextValue | null>(null);

export function usePlaza(): PlazaContextValue {
  const v = useContext(PlazaContext);
  if (!v) throw new Error('PlazaContext가 없습니다');
  return v;
}
