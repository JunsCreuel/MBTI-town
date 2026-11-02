import { createContext, useContext } from 'react';
import type { PlazaMap } from '@/shared/plazaMap';
import type { Territory } from '@/shared/territory';
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
  /** 걷기 화면 / 전체 지도 (위에서 내려다보기) */
  view: 'walk' | 'map';
  /** 전체 지도로 넘어간 정도 (0 = 걷기, 1 = 지도). 카메라가 매 프레임 바꾼다. */
  mapBlend: number;
  /** 전체 지도 이름표 DOM. 장면이 매 프레임 화면 위치를 옮긴다. 키 = 유형 코드 또는 'plaza'. */
  labels: Map<string, HTMLElement>;
}

export interface PlazaContextValue {
  session: PlazaSession;
  selfId: string;
  map: PlazaMap;
  assets: PlazaAssets;
  input: PlazaInput;
  /** 땅따먹기: 칸별 땅 주인 */
  territory: Territory;
}

export const PlazaContext = createContext<PlazaContextValue | null>(null);

export function usePlaza(): PlazaContextValue {
  const v = useContext(PlazaContext);
  if (!v) throw new Error('PlazaContext가 없습니다');
  return v;
}
