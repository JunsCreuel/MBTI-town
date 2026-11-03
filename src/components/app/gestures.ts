// 몸짓·이모티콘 이름과 아이콘 (마을과 방이 같이 쓴다). 아이콘은 manifest 키다.
import { tokens } from '@/design/tokens';
import type { ActionKind, EmoteKind } from '@/shared/protocol';

export interface GestureInfo {
  label: string;
  /** manifest 키 (ui.icon.* 또는 ui.emotion.*) */
  icon: string;
  /** 머리 위 말풍선 안 아이콘 색 */
  color: string;
}

export const ACTION_INFO: Record<ActionKind, GestureInfo> = {
  cheer: { label: '응원', icon: 'ui.icon.cheer', color: tokens.color.accent },
  clap: { label: '박수', icon: 'ui.icon.clap', color: tokens.color.accent },
  wave: { label: '안녕', icon: 'ui.icon.wave', color: tokens.color.accent },
  bow: { label: '꾸벅', icon: 'ui.icon.bow', color: tokens.color.accent },
  dance: { label: '춤', icon: 'ui.icon.dance', color: tokens.color.accent },
  jump: { label: '폴짝', icon: 'ui.icon.jump', color: tokens.color.accent },
  think: { label: '갸웃', icon: 'ui.icon.think', color: tokens.color.accent },
};

export const EMOTE_INFO: Record<EmoteKind, GestureInfo> = {
  clap: { label: '박수', icon: 'ui.icon.clap', color: tokens.color.accent },
  heart: { label: '하트', icon: 'ui.icon.heart', color: tokens.scene.heart },
  question: { label: '궁금', icon: 'ui.icon.question', color: tokens.color.accent },
  wow: { label: '놀람', icon: 'ui.icon.wow', color: tokens.color.accent },
  joy: { label: '웃음', icon: 'ui.emotion.joy', color: tokens.emotion.joy },
  sad: { label: '눈물', icon: 'ui.emotion.sad', color: tokens.emotion.sad },
  flutter: { label: '설렘', icon: 'ui.emotion.flutter', color: tokens.emotion.flutter },
  tired: { label: '졸려', icon: 'ui.emotion.tired', color: tokens.emotion.tired },
  sparkle: { label: '반짝', icon: 'ui.icon.sparkle', color: tokens.emotion.joy },
  music: { label: '음표', icon: 'ui.icon.music', color: tokens.color.accent },
};

/** 고르는 화면에 보이는 이모티콘 (박수 이모티콘은 박수 동작에 같이 뜬다) */
export const PICKABLE_EMOTES = (Object.keys(EMOTE_INFO) as EmoteKind[]).filter((e) => e !== 'clap');
