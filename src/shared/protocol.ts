// 마을 클라이언트와 실시간 서버가 함께 쓰는 메시지 규약.
// 자유 채팅은 없다. 소통은 동작과 이모티콘으로만 한다.
import { townConfig } from '../config/game';
import { isDistrict, type District } from './districts';

export const ACTIONS = ['cheer', 'clap'] as const;
export type ActionKind = (typeof ACTIONS)[number];

export const EMOTES = ['clap', 'heart', 'question', 'wow'] as const;
export type EmoteKind = (typeof EMOTES)[number];

/**
 * 들어가서 처음 설 곳. home = 내 집 문 앞 (손님은 중앙광장), gate.<지역> = 본섬 동네 길 아치 앞.
 * 2동·3동…에서는 home이 아니면 동네 입구(아치 앞)에 선다.
 */
export type TownPlace = 'home' | 'plaza' | District | `gate.${District}`;

export function isTownPlace(v: unknown): v is TownPlace {
  return v === 'home' || v === 'plaza' || isDistrict(v) || (typeof v === 'string' && v.startsWith('gate.') && isDistrict(v.slice(5)));
}

/**
 * 실시간 방이 맡는 곳: 'town' = 본섬(중앙광장 + 다섯 지역의 1동), '<지역>.<번호>' = 2동부터의 동네.
 * 같은 곳의 방끼리만 채널이 나뉜다.
 */
export type RoomPlace = 'town' | `${District}.${number}`;

export interface Hood {
  district: District;
  /** 동네 번호 (2부터. 1동은 본섬) */
  hood: number;
}

/** 방 이름을 읽는다. 본섬이면 null, 올바르지 않으면 undefined */
export function parseRoomPlace(v: unknown): Hood | null | undefined {
  if (v === undefined || v === 'town') return null;
  if (typeof v !== 'string') return undefined;
  const m = /^([a-z]+)\.(\d{1,3})$/.exec(v);
  if (!m || !isDistrict(m[1])) return undefined;
  const hood = Number(m[2]);
  return hood >= 2 && hood <= townConfig.maxHoods ? { district: m[1], hood } : undefined;
}

export const hoodPlace = (district: District, hood: number): RoomPlace => (hood <= 1 ? 'town' : `${district}.${hood}`);

export interface JoinOptions {
  /** /api/town/token 으로 받은 입장 토큰 */
  token: string;
  /** 들어갈 곳 (기본 본섬) */
  place?: RoomPlace;
  at?: TownPlace;
  /** 화면이 서버를 기다리지 않고 먼저 세운 내 자리 (걸을 수 있는 곳이면 서버도 이 자리를 쓴다) */
  start?: { x: number; z: number };
}

/** 클라이언트 → 서버 */
export interface MoveMessage {
  x: number;
  z: number;
  /** 바라보는 방향 (라디안). 0이면 +Z(남쪽)를 본다. */
  rot: number;
  moving: boolean;
}
export interface ActionMessage {
  kind: ActionKind;
}
export interface EmoteMessage {
  kind: EmoteKind;
}
/** 전체 지도에서 다른 곳을 눌러 바로 간다 */
export interface WarpMessage {
  to: TownPlace;
}

/** 서버 → 클라이언트 */
export interface SnapMessage {
  x: number;
  z: number;
}
export interface ActionBroadcast {
  id: string;
  kind: ActionKind;
}
export interface EmoteBroadcast {
  id: string;
  kind: EmoteKind;
}

export const MSG = {
  move: 'move',
  action: 'action',
  emote: 'emote',
  warp: 'warp',
  snap: 'snap',
} as const;
