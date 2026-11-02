// 마을 클라이언트와 실시간 서버가 함께 쓰는 메시지 규약.
// 자유 채팅은 없다. 소통은 동작과 이모티콘으로만 한다.
import type { District } from './districts';

export const ACTIONS = ['cheer', 'clap'] as const;
export type ActionKind = (typeof ACTIONS)[number];

export const EMOTES = ['clap', 'heart', 'question', 'wow'] as const;
export type EmoteKind = (typeof EMOTES)[number];

/** 들어가서 처음 설 곳. home = 내 집 문 앞 (집이 없으면 내 지역 입구, 손님은 중앙광장) */
export type TownPlace = 'home' | 'plaza' | District;

export interface JoinOptions {
  /** /api/town/token 으로 받은 입장 토큰 */
  token: string;
  at?: TownPlace;
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
