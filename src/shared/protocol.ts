// 마을 클라이언트와 실시간 서버가 함께 쓰는 메시지 규약.
// 자유 채팅은 없다. 소통은 동작과 이모티콘으로만 한다.
import type { MbtiType } from '../design/mbti';

export const ACTIONS = ['cheer', 'clap'] as const;
export type ActionKind = (typeof ACTIONS)[number];

export const EMOTES = ['clap', 'heart', 'question', 'wow'] as const;
export type EmoteKind = (typeof EMOTES)[number];

export interface JoinOptions {
  mbti: MbtiType;
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
  to: MbtiType | 'plaza';
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
