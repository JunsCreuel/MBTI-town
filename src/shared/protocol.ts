// 마을 클라이언트와 실시간 서버가 함께 쓰는 메시지 규약.
// 자유 채팅은 없다. 소통은 동작과 이모티콘으로만 한다.
import { townConfig } from '../config/game';
import type { ClubLine } from './clubMusic';
import { isDistrict, type District } from './districts';
import { isPetPose, type PetPose } from './pets';
import { cleanPlacedItem, type PlacedItem } from './room';

/** 몸짓 (캐릭터 동작). 이름은 캐릭터 애니메이션 클립과 같다 (shared/character.ts) */
/** 몸짓. fish(낚시)는 낚시터에서 낚싯대를 던질 때만, pet(쓰다듬기)은 강아지를 쓰다듬을 때만 쓰고 몸짓 고르기에는 없다 */
export const ACTIONS = ['cheer', 'clap', 'wave', 'bow', 'dance', 'jump', 'think', 'fish', 'pet'] as const;
export type ActionKind = (typeof ACTIONS)[number];

/** 머리 위 이모티콘 (clap은 박수 동작에 같이 뜬다) */
export const EMOTES = ['clap', 'heart', 'question', 'wow', 'joy', 'sad', 'flutter', 'tired', 'sparkle', 'music'] as const;
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
export type RoomPlace = 'town' | Spot | `${District}.${number}`;

/** 놀이터: 중앙광장 비콘으로 가는 낚시터·클럽·상가 (집터 없는 작은 섬) */
export const SPOTS = ['fishing', 'club', 'market'] as const;
export type Spot = (typeof SPOTS)[number];
export const SPOT_NAME: Record<Spot, string> = { fishing: '낚시터', club: '클럽', market: '상가' };

export function parseSpot(v: unknown): Spot | null {
  return typeof v === 'string' && (SPOTS as readonly string[]).includes(v) ? (v as Spot) : null;
}

export interface Hood {
  district: District;
  /** 동네 번호 (2부터. 1동은 본섬) */
  hood: number;
}

/** 방 이름을 읽는다. 본섬이면 null, 올바르지 않으면 undefined */
export function parseRoomPlace(v: unknown): Hood | null | undefined {
  if (v === undefined || v === 'town') return null;
  if (typeof v !== 'string') return undefined;
  const m = /^([A-Z]{4})\.(\d{1,3})$/.exec(v);
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
  /** 데리고 다니는 펫 (src/shared/pets.ts의 id, 없으면 ''). 집이 있는 주민만 */
  pet?: string;
}

/** 집 안 방에 들어갈 때 보내는 값 */
export interface HouseJoinOptions {
  /** /api/house/token 으로 받은 입장 토큰 (house가 담겨 있다) */
  token: string;
  /** 들어갈 집 (주인의 pid). 토큰의 house와 같아야 한다 */
  house: string;
  /** 화면이 먼저 세운 내 자리 (방 안이면 그대로 쓴다) */
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
  /** 클럽: 지금 DJ가 트는 곡 (서버 → 모두) */
  music: 'music',
  /** 클럽: DJ에게 신청곡 (화면 → 서버) */
  musicRequest: 'music_request',
  /** 클럽: 신청곡을 받았는지 (서버 → 신청한 사람, MusicResult) */
  musicResult: 'music_result',
  /** 클럽: 운영자만 지금 곡 넘기기·신청곡 빼기 (화면 → 서버, MusicAdmin) */
  musicAdmin: 'music_admin',
  /** 서버 전체 공지 (서버 → 모두, AnnounceBroadcast) */
  announce: 'announce',
  /** 펫 불러오기·돌려보내기 (화면 → 서버, PetMessage). 서버는 Player.pet으로 모두에게 알린다 */
  pet: 'pet',
  /** 집: 방 꾸미기 실시간 (주인 화면 → 서버 → 같은 방 사람들, FurniMessage / FurniBroadcast) */
  furni: 'furni',
  /** 집: 방 강아지 자리·자세 (강아지를 맡은 화면 → 서버 → 다른 사람들, DogMessage) */
  dog: 'dog',
  /** 집: 강아지를 맡을 화면인지 (서버 → 그 사람, DogLeadMessage) */
  dogLead: 'dog_lead',
  /** 집: 같이 꾸미기 켜고 끄기 (주인 화면 → 서버 → 모두, CoEditMessage) */
  coedit: 'coedit',
} as const;

/**
 * 방 꾸미기 실시간 알림 (집 주인만 보낸다). 손님 화면은 저장하기 전에도 가구가 움직이는 것을 본다.
 * - carry: 가구를 들었다 (떠오르고, 주인 캐릭터가 들어 올린다) / move: 든 가구를 옮겼다 / drop: 내려놓았다
 * - set: 들지 않고 놓거나 바꿨다 (새로 두기·돌리기) / remove: 치웠다
 * - reset: 꾸미기를 끝냈다 (저장·취소·액자). 손님 화면은 저장된 방을 다시 받는다
 */
export type FurniMessage =
  | { op: 'carry' | 'move' | 'drop' | 'set'; item: PlacedItem }
  | { op: 'remove'; id: string }
  | { op: 'reset' };
/** by = 보낸 사람 (세션 id) */
export type FurniBroadcast = FurniMessage & { by: string };

/** 실시간 서버가 받은 방 꾸미기 알림을 검사한다 (모양이 틀리면 null) */
export function parseFurniMessage(v: unknown): FurniMessage | null {
  const m = v as { op?: unknown; item?: unknown; id?: unknown } | null;
  if (!m || typeof m !== 'object') return null;
  if (m.op === 'reset') return { op: 'reset' };
  if (m.op === 'remove') return typeof m.id === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(m.id) ? { op: 'remove', id: m.id } : null;
  if (m.op === 'carry' || m.op === 'move' || m.op === 'drop' || m.op === 'set') {
    const item = cleanPlacedItem(m.item);
    return item ? { op: m.op, item } : null;
  }
  return null;
}

/**
 * 방 강아지: 방에 먼저 들어온 사람의 화면이 강아지를 걷게 하고 자리를 알린다 (다른 화면은 따라 그린다).
 * pose = 쓰다듬어 줘서 하는 자세 (없으면 서 있기·걷기)
 */
export interface DogMessage {
  x: number;
  z: number;
  rot: number;
  moving: boolean;
  pose: PetPose | null;
}

/** 같이 꾸미기: 켜면 방에 있는 손님도 가구를 들고 옮길 수 있다 (새로 두기·빼기·저장은 주인만) */
export interface CoEditMessage {
  on: boolean;
}

/** 손님이 같이 꾸미기로 보낼 수 있는 방 꾸미기 알림 */
export const COEDIT_OPS = ['carry', 'move', 'drop'] as const;

export interface DogLeadMessage {
  lead: boolean;
}

export function isDogMessage(v: unknown): v is DogMessage {
  const m = v as DogMessage | null;
  return (
    !!m && typeof m === 'object' && typeof m.x === 'number' && typeof m.z === 'number' && typeof m.rot === 'number'
    && Number.isFinite(m.x) && Number.isFinite(m.z) && Number.isFinite(m.rot) && typeof m.moving === 'boolean'
    && (m.pose === null || isPetPose(m.pose))
  );
}

/** 데리고 다닐 펫 (pets.ts의 id, 돌려보내면 '') */
export interface PetMessage {
  pet: string;
}

/**
 * 클럽 채널의 곡 흐름 (src/shared/clubMusic.ts의 ClubLine): 지금 곡을 startedAt(서버 시각, ms)부터 틀고,
 * 끝나면 신청곡 대기열(queue)을 차례대로, 그 뒤로는 목록 순서로 이어 간다.
 * serverNow = 보낸 순간의 서버 시각 (화면이 자기 시계와의 차이를 맞춘다). by = 지금 곡을 신청한 사람 이름.
 */
export interface MusicState extends ClubLine {
  serverNow: number;
}

/**
 * 클럽 운영자 명령. skip = 지금 곡을 끝내고 다음 곡(대기열 첫 곡, 없으면 목록 다음 곡)을 지금부터.
 * remove = 대기열 at번째(0부터) 곡을 뺀다. key는 그 곡이 맞는지 확인하는 값 (queueKey)
 */
export type MusicAdmin = { action: 'skip' } | { action: 'remove'; at: number; key: string };

/** 신청곡을 받았는지 (신청한 사람에게만). position = 대기열에서 몇 번째인지 (1부터) */
export type MusicResult = { ok: true; position: number } | { ok: false; reason: 'full' | 'mine' | 'cooldown' | 'closed' };
