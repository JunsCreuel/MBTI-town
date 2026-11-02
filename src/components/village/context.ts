import { createContext, useContext } from 'react';
import type { HouseView } from '@/server/scene/service';
import type { Lot, TownMap } from '@/shared/townMap';
import type { TownSession } from './session';
import type { TownAssets } from './assets';

/** 장면 안에서 공유하는 입력 상태. React 상태가 아니라 매 프레임 읽고 쓰는 값이다. */
export interface TownInput {
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
  /** 전체 지도 이름표 DOM. 장면이 매 프레임 화면 위치를 옮긴다. 키 = 지역 id, 'plaza', 'home'. */
  labels: Map<string, HTMLElement>;
}

/** 집터 키: "wood.3" */
export const lotKey = (l: { district: string; lot?: number; index?: number }) => `${l.district}.${l.lot ?? l.index}`;

export interface TownContextValue {
  session: TownSession;
  selfId: string;
  map: TownMap;
  assets: TownAssets;
  input: TownInput;
  /** 집터 키 → 그 자리에 선 집 (빈 집터는 없음) */
  houses: ReadonlyMap<string, HouseView>;
  /** 화면에서 숨길 마을 사람 번호 (차단 관계) */
  hidden: ReadonlySet<string>;
  /** 집을 눌렀을 때 */
  onHouse: (lot: Lot) => void;
}

export const TownContext = createContext<TownContextValue | null>(null);

export function useTown(): TownContextValue {
  const v = useContext(TownContext);
  if (!v) throw new Error('TownContext가 없습니다');
  return v;
}
