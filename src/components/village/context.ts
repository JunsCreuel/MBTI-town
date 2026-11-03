import { createContext, useContext } from 'react';
import type { HouseView } from '@/server/scene/service';
import type { AccessoryId, AvatarColor } from '@/shared/avatar';
import type { Lot, PropPlacement, TownMap } from '@/shared/townMap';
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
  /** 카메라 목표값. 버튼·단축키·휠·끌기가 바꾸고, 카메라가 매 프레임 부드럽게 따라간다. */
  camera: TownCamera;
}

export interface TownCamera {
  /** 바라보는 방향 (라디안). 0 = 남쪽에서 북쪽을 본다. 한 바퀴를 넘어도 그대로 더한다 (되감기지 않게) */
  yaw: number;
  /** 지금 카메라 방향. 방향키로 걸을 때 이 방향을 기준으로 위·아래·왼쪽·오른쪽을 정한다 */
  yawNow: number;
  /** 캐릭터와의 거리 (0 = 아직 안 정함 → 화면 방향에 맞는 기본 거리) */
  distance: number;
  /** 휠·두 손가락·끌기·단축키로 값이 바뀌면 부른다 (시점 버튼 글자를 맞춘다) */
  onChange?: () => void;
}

/** 집터 키: "wood.3" */
export const lotKey = (l: { district: string; lot?: number; index?: number }) => `${l.district}.${l.lot ?? l.index}`;

/** 내 캐릭터 모습 (입장 토큰에 적힌 것) */
export interface SelfLook {
  name: string;
  color: AvatarColor;
  acc: AccessoryId;
}

export interface TownContextValue {
  session: TownSession;
  /** 실시간 서버에서 받은 내 번호 (아직 붙지 않았으면 '') */
  selfId: string;
  /** 처음 설 자리 (실시간 서버를 기다리지 않고 화면이 정한다, src/shared/spawn.ts) */
  spawn: { x: number; z: number };
  look: SelfLook;
  map: TownMap;
  assets: TownAssets;
  input: TownInput;
  /** 지금 있는 동네 번호 (1 = 본섬) */
  hood: number;
  /** 집터 키 → 그 자리에 선 집 (지금 동네 것만, 빈 집터는 없음) */
  houses: ReadonlyMap<string, HouseView>;
  /** 화면에서 숨길 마을 사람 번호 (차단 관계) */
  hidden: ReadonlySet<string>;
  /** 집을 눌렀을 때 */
  onHouse: (lot: Lot) => void;
  /** 동네 길 아치를 눌렀을 때 */
  onGate: (gate: PropPlacement) => void;
}

export const TownContext = createContext<TownContextValue | null>(null);

export function useTown(): TownContextValue {
  const v = useContext(TownContext);
  if (!v) throw new Error('TownContext가 없습니다');
  return v;
}
