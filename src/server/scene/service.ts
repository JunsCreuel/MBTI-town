// 미니홈피 규칙을 지키며 저장소를 다룬다. 화면(API)은 이 클래스만 쓴다.
// 공개 범위와 차단은 여기서 검사한다. 화면에서 숨기는 것만으로 끝내지 않는다 (PROJECT_GUIDE.md 3부 9번).
import 'server-only';
import { randomBytes } from 'node:crypto';
import { recordConfig, socialConfig, townConfig } from '@/config/game';
import { isMbtiType, type MbtiType } from '@/design/mbti';
import { NOTICE_MAX, parseAnnouncement, type Announcement } from '@/shared/announce';
import { AVATAR_COLORS, cleanAvatar, type Avatar } from '@/shared/avatar';
import { isShopColor, isShopSlot, refundFor, shopLabel, type MarketView, type ShopColor } from '@/shared/market';
import { bgmTrack } from '@/shared/bgm';
import { cleanTaste, isDistrict, type District, type Taste } from '@/shared/districts';
import { moderate } from '@/shared/moderation';
import {
  VISIBILITIES, canView, isVisibility, validateRecord, visibleLevels,
  type Emotion, type RecordKind, type Relation, type Visibility,
} from '@/shared/records';
import { framedPhotoIds, starterLayout, validateLayout, type RoomLayout } from '@/shared/room';
import { guestPid, signTownPass, townPid, type TownPass } from '@/shared/townToken';
import { localDate } from '@/shared/debate';
import {
  FORTUNE_FRUIT, GOLDEN_WHALE_ID, fishDef, fortuneFor, fruitOf, parseTreeSpot, rollCatch, treeSpotId,
  type FishDef, type FortuneFruit,
} from '@/shared/play';
import { youtubeIdOf } from '@/shared/clubMusic';
import { coinConfig, contestConfig, debateConfig, marketConfig, playConfig } from '@/config/game';
import { contestLeader, previousContestWeek, type ContestDistrictScore, type ContestKind, type ContestStandings } from '@/shared/contest';
import type { AdminCounts, ProfileRow, RecordRow, RoomCardRow, SceneStore } from './store';

export type SceneErrorCode =
  | 'login_required' | 'onboarding_required' | 'not_found' | 'forbidden' | 'bad_request' | 'conflict' | 'blocked' | 'rejected'
  | 'too_large';

const STATUS: Record<SceneErrorCode, number> = {
  login_required: 401, onboarding_required: 409, not_found: 404, forbidden: 403, bad_request: 400, conflict: 409,
  blocked: 403, rejected: 400, too_large: 413,
};

export class SceneError extends Error {
  readonly status: number;
  /** 사용자에게 그대로 보여 줄 오류 표시 (http.ts가 읽는다). 모듈 사본이 달라도 instanceof 없이 알아본다 */
  readonly userFacing = true;
  constructor(readonly code: SceneErrorCode, message: string) {
    super(message);
    this.name = 'SceneError';
    this.status = STATUS[code];
  }
}

export interface Viewer {
  id: string;
}

const HANDLE = /^[a-z0-9_]{3,20}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ───────────────────────── 화면에 내보내는 모양 ─────────────────────────

/** 다른 사람에게 보여 줘도 되는 프로필 */
export interface PublicProfile {
  handle: string;
  displayName: string;
  bio: string;
  district: District | null;
  avatar: Avatar;
  /** MBTI = 사는 마을 */
  mbti: MbtiType | null;
}

/** 운영자 화면: 신고 하나 */
export interface AdminReport {
  id: string;
  kind: 'guestbook' | 'record' | 'user';
  targetId: string;
  reason: string | null;
  createdAt: string;
  /** 처리했으면 어떻게 (dismissed = 문제없음, removed = 지움) */
  resolved: 'dismissed' | 'removed' | null;
  reporter: { handle: string; displayName: string } | null;
  /** 신고된 글·기록 내용 또는 사용자 이름 */
  preview: string | null;
  /** 그 방(주인) 핸들: 방 보기 링크 */
  roomHandle: string | null;
  gone: boolean;
}

/** 운영자 화면: 주민 한 명 */
export interface AdminUser {
  id: string;
  handle: string | null;
  displayName: string;
  district: District | null;
  joinedAt: string | null;
  lastSeenAt: string | null;
  admin: boolean;
  records: number;
  /** 가진 코인 */
  coins: number;
}

/** 운영자가 한 번에 주거나 뺄 수 있는 코인 한도 */
export const ADMIN_WALLET_MAX = { coins: 1_000_000 };

/** 내 프로필 (설정 화면용) */
export interface MyProfile extends PublicProfile {
  onboarded: boolean;
  /** 운영자 (모든 방·기록을 보고 신고를 처리한다, /admin) */
  admin: boolean;
  /** 가입한 날 (YYYY-MM-DD, 한국 날짜). 주민증에 쓴다 */
  joinedAt: string | null;
  /** 주민증 취미 한 줄 (선택) */
  hobby: string;
  taste: Taste;
  /** MBTI를 다시 바꿀 수 있는 때 (지금 바꿀 수 있으면 null). 바꾸면 그 유형 마을로 이사한다 */
  mbtiChangeableAt: string | null;
  roomVisibility: Visibility;
  showVisits: boolean;
  discoverable: boolean;
  /** 집이 있는 동네 번호 (1 = 본섬 1동, 2부터 = 새로 열린 동네) */
  houseHood: number;
  /** 동네 안 집터 번호 (가입 전이면 null) */
  houseLot: number | null;
}

/** 마을에 서 있는 집 하나. 이름은 볼 수 있는 사람에게만 붙는다. */
export interface HouseView {
  district: District;
  /** 동네 번호 (1 = 본섬) */
  hood: number;
  lot: number;
  /** 이름표 (내 집, 친구 집, 공개·발견 켠 집만. 나머지는 null = 이름 없는 집) */
  name: string | null;
  /** 들어가 볼 수 있는 방 주소 (이름이 붙은 집만) */
  handle: string | null;
  mine: boolean;
  friend: boolean;
}

export interface TownView {
  houses: HouseView[];
  /** 화면에서 숨길 마을 사람 번호 (차단 관계) */
  hidden: string[];
}

/** 입장 토큰과, 토큰에 담은 내 정보 */
export interface TownTicket {
  token: string;
  pass: TownPass;
  guest: boolean;
}

export interface PickResult {
  /** 오늘 이미 딴 나무 */
  already: boolean;
  fruit: { id: string; name: string; color: string };
  /** 이번에 바구니에 들어간 수 */
  added: number;
  /** 지금까지 모은 수 */
  count: number;
  /** 운세 나무면 오늘의 운세 열매 */
  fortune: FortuneFruit | null;
  /** 이번에 받은 코인 */
  earned: number;
  /** 이번에 내 마을에 올린 대항전 점수 */
  contest?: number;
}

export interface FishResult {
  /** 잡은 것. null = 꽝 (아무것도 안 걸렸다) */
  fish: FishDef | null;
  /** cm (장화·병·꽝은 0) */
  size: number;
  /** 도감에 쌓인 수 (꽝이면 0) */
  count: number;
  /** 오늘 남은 횟수 (화면에는 보여 주지 않는다) */
  left: number;
  /** 황금 고래를 낚아 서버 전체에 공지했는지 */
  announced?: boolean;
  /** 이번에 받은 코인 (꽝이면 0) */
  earned: number;
  /** 이번에 내 마을에 올린 대항전 점수 */
  contest?: number;
}

export interface PlayState {
  day: string;
  /** 오늘 딴 나무 자리 ("fruit.ENFP.0", "fortune") */
  pickedTrees: string[];
  fishLeft: number;
  /** 열매 id → 개수 */
  fruits: Record<string, number>;
  /** 물고기 id → 마리 수 */
  fish: Record<string, number>;
  /** 게임 코인 */
  coins: number;
}

/** 집 안 입장 토큰: 그 방을 볼 수 있는 사람에게만 준다 */
export interface HouseTicket extends TownTicket {
  /** 들어갈 집 (주인의 pid) */
  house: string;
  /** 내 화면에서 숨길 사람 번호 (차단 관계) */
  hidden: string[];
}

export interface RecordView {
  id: string;
  kind: RecordKind;
  emotion: Emotion | null;
  body: string;
  photoId: string | null;
  visibility: Visibility;
  createdAt: string;
}

export interface GuestbookView {
  id: string;
  body: string;
  visibility: 'friends' | 'public';
  createdAt: string;
  author: { handle: string | null; displayName: string; avatar: Avatar };
  /** 내가 지울 수 있는지 (방 주인 또는 쓴 사람) */
  canDelete: boolean;
}

export interface RoomCard {
  handle: string;
  displayName: string;
  bio: string;
  district: District | null;
  avatar: Avatar;
  bgm: string | null;
}

export type FriendState = 'none' | 'friends' | 'sent' | 'received';

export interface RoomView {
  owner: PublicProfile;
  relation: Relation;
  /** 방을 볼 수 없으면 null (나만 보기, 친구만) */
  room: { layout: RoomLayout; bgm: string | null } | null;
  roomVisibility: Visibility;
  records: RecordView[];
  guestbook: GuestbookView[];
  friend: FriendState;
  canWriteGuestbook: boolean;
  /** 방 주인에게만: 최근 방문자 */
  visitors: (RoomCard & { lastAt: string })[] | null;
}

export interface OnboardingInput {
  /** MBTI (직접 고르거나 간단 테스트로). 사는 마을이 이 유형 마을이다 */
  mbti: unknown;
  taste?: unknown;
  avatar: unknown;
  starter: unknown;
  wallpaper?: unknown;
  floor?: unknown;
  bgm: unknown;
  displayName: unknown;
  bio?: unknown;
  /** 주민증 취미 (선택) */
  hobby?: unknown;
}

function displayNameOf(p: Pick<ProfileRow, 'display_name' | 'handle'>): string {
  return p.display_name || p.handle || '이름 없는 주민';
}

function toPublic(p: ProfileRow): PublicProfile {
  return {
    handle: p.handle ?? '',
    displayName: displayNameOf(p),
    bio: p.bio ?? '',
    district: p.district,
    avatar: cleanAvatar(p.avatar),
    mbti: p.mbti,
  };
}

function toCard(r: RoomCardRow): RoomCard {
  return {
    handle: r.handle,
    displayName: r.display_name || r.handle,
    bio: r.bio ?? '',
    district: r.district,
    avatar: cleanAvatar(r.avatar),
    bgm: r.bgm,
  };
}

function toRecord(r: RecordRow): RecordView {
  return {
    id: r.id,
    kind: r.kind,
    emotion: r.emotion,
    body: r.body,
    photoId: r.photo_id,
    visibility: r.visibility,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

/** 주민증 취미: 짧게, 거친 말·링크는 안 된다 */
function cleanHobby(v: unknown): string {
  const s = cleanText(v, socialConfig.hobbyMax, '취미');
  if (s && !moderate(s).allowed) throw new SceneError('rejected', '취미에는 거친 표현이나 링크·연락처를 넣을 수 없어요.');
  return s;
}

/** 점포 이름·소개·차양 색: 짧게, 거친 말·링크는 안 된다 */
function cleanShopInput(input: Record<string, unknown>): { name: string; intro: string; color: ShopColor } {
  const name = cleanText(input.name, marketConfig.nameMax, '점포 이름', true).replace(/\s+/g, ' ');
  const intro = cleanText(input.intro, marketConfig.introMax, '점포 소개').replace(/\s+/g, ' ');
  for (const s of [name, intro]) {
    if (s && !moderate(s).allowed) throw new SceneError('rejected', '점포 이름·소개에는 거친 표현이나 링크·연락처를 넣을 수 없어요.');
  }
  const color = input.color === undefined ? 'mint' : input.color;
  if (!isShopColor(color)) throw new SceneError('bad_request', '차양 색이 올바르지 않아요.');
  return { name, intro, color };
}

function cleanText(v: unknown, max: number, what: string, required = false): string {
  const s = typeof v === 'string' ? v.trim().replace(/\s+\n/g, '\n') : '';
  if (required && !s) throw new SceneError('bad_request', `${what}을(를) 써 주세요.`);
  if (s.length > max) throw new SceneError('bad_request', `${what}은(는) ${max}자까지 쓸 수 있어요.`);
  return s;
}

/** MBTI를 다시 바꿀 수 있는 때 (처음 정한 MBTI는 바로 한 번 바꿀 수 있다). 지금 바꿀 수 있으면 null */
export function mbtiChangeableAt(p: Pick<ProfileRow, 'mbti' | 'mbti_changed_at'>, now: Date): Date | null {
  if (!p.mbti || !p.mbti_changed_at) return null;
  const at = new Date(new Date(p.mbti_changed_at).getTime() + debateConfig.mbtiChangeCooldownDays * 86_400_000);
  return at > now ? at : null;
}

/** 이미지 파일 앞부분으로 형식을 확인한다 (보낸 사람이 적은 형식을 믿지 않는다) */
export function sniffImage(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

/** 운영 화면: 클럽 유튜브 신청 */
export interface AdminYoutube {
  on: boolean;
  blocks: { kind: 'video' | 'channel'; id: string; label: string; createdAt: string }[];
}

/** 대항전 화면 */
export interface ContestView {
  standings: ContestStandings;
  /** 지난주 결과 (우승 지역이 없으면 null: 모두 0점이거나 같은 점수) */
  last: { week: string; winner: District | null; districts: ContestDistrictScore[] };
  /** 내 지역과 이번 주 내가 올린 점수 (주민이 아니면 null) */
  me: { district: District; week: number; today: Record<ContestKind, number> } | null;
}

/** 서버 전체 공지를 보내는 길 (웹 서버에서는 실시간 서버로, 테스트에서는 기록만). 보냈으면 true */
export type Announcer = (a: Announcement) => Promise<boolean>;

export class SceneService {
  /** 결과를 정해 둔 지난주 (같은 주를 또 묻지 않게) */
  private settledWeek = '';
  constructor(
    private readonly store: SceneStore,
    private readonly now: () => Date = () => new Date(),
    private readonly announce: Announcer = async () => false,
  ) {}

  // ───────────────────────── 나 ─────────────────────────

  async me(viewer: Viewer): Promise<{ profile: MyProfile; room: { layout: RoomLayout; bgm: string | null } | null }> {
    await this.store.ensureProfile(viewer.id);
    await this.store.touch(viewer.id, this.now());
    const p = await this.ensureHouse((await this.store.getProfile(viewer.id))!);
    const room = await this.store.getRoom(viewer.id);
    return { profile: this.toMine(p, await this.store.isAdmin(viewer.id)), room: room ? { layout: room.layout, bgm: room.bgm } : null };
  }

  /** 운영자인지 (로그인하지 않았으면 아니다) */
  private async isAdmin(viewer: Viewer | null): Promise<boolean> {
    return !!viewer && (await this.store.isAdmin(viewer.id));
  }

  /**
   * 가입을 마쳤는데 내 MBTI 마을에 집이 없으면 (예전 오행 지역에 살던 주민, 집터가 다 찼던 마을) 지금 빈 집터를 준다.
   * MBTI가 없는 예전 주민은 그대로 둔다 (화면이 MBTI를 먼저 고르게 한다).
   */
  private async ensureHouse(p: ProfileRow): Promise<ProfileRow> {
    if (!p.onboarded_at || !p.mbti || (p.district === p.mbti && p.house_lot !== null)) return p;
    await this.store.moveHouse(p.id, p.mbti, townConfig.lotsPerDistrict, townConfig.hoodLots);
    return (await this.store.getProfile(p.id))!;
  }

  private toMine(p: ProfileRow, admin = false): MyProfile {
    return {
      ...toPublic(p),
      onboarded: !!p.onboarded_at,
      admin,
      joinedAt: p.onboarded_at ? localDate(new Date(p.onboarded_at)) : null,
      hobby: p.hobby ?? '',
      taste: cleanTaste(p.taste),
      mbtiChangeableAt: mbtiChangeableAt(p, this.now())?.toISOString() ?? null,
      roomVisibility: p.room_visibility,
      showVisits: p.show_visits,
      discoverable: p.discoverable,
      houseHood: p.house_hood,
      houseLot: p.house_lot,
    };
  }

  private async requireOnboarded(viewer: Viewer | null): Promise<ProfileRow> {
    if (!viewer) throw new SceneError('login_required', '로그인이 필요해요.');
    const p = await this.store.getProfile(viewer.id);
    if (!p?.onboarded_at) throw new SceneError('onboarding_required', '먼저 나의 방을 만들어 주세요.');
    return p;
  }

  private async newHandle(id: string): Promise<string> {
    for (let i = 0; i < 20; i++) {
      const h = `room${randomBytes(4).readUInt32BE(0).toString(36).slice(0, 6)}`;
      if (HANDLE.test(h) && !(await this.store.handleTaken(h, id))) return h;
    }
    throw new SceneError('conflict', '잠시 후 다시 시도해 주세요.');
  }

  /** 첫 가입 7단계를 한 번에 저장한다 */
  async completeOnboarding(viewer: Viewer | null, input: OnboardingInput): Promise<MyProfile> {
    if (!viewer) throw new SceneError('login_required', '로그인이 필요해요.');
    await this.store.ensureProfile(viewer.id);
    const p = (await this.store.getProfile(viewer.id))!;
    const now = this.now();
    // 사는 마을은 MBTI 유형 마을이다
    if (!isMbtiType(input.mbti)) throw new SceneError('bad_request', 'MBTI를 골라 주세요. 모르면 간단 테스트로 정할 수 있어요.');
    const mbti = input.mbti;
    const bgm = bgmTrack(typeof input.bgm === 'string' ? input.bgm : null);
    if (!bgm) throw new SceneError('bad_request', '대표 BGM을 골라 주세요.');
    const displayName = cleanText(input.displayName, socialConfig.displayNameMax, '이름', true);
    const bio = cleanText(input.bio, socialConfig.bioMax, '프로필 문구');
    const hobby = cleanHobby(input.hobby);
    const layout = starterLayout(String(input.starter ?? ''), String(input.wallpaper ?? ''), String(input.floor ?? ''));
    await this.store.updateProfile(viewer.id, {
      handle: p.handle ?? (await this.newHandle(viewer.id)),
      display_name: displayName,
      bio,
      taste: cleanTaste(input.taste),
      avatar: cleanAvatar(input.avatar),
      hobby,
      onboarded_at: p.onboarded_at ?? now,
    });
    // 처음 정한 MBTI는 바꾸기 대기 시간을 세지 않는다 (테스트 결과가 마음에 안 들면 한 번은 바로 고칠 수 있게)
    if (p.mbti !== mbti) await this.store.setMbti(viewer.id, mbti, p.mbti ? now : null);
    // 그 유형 마을의 빈 집터에 집이 선다 (1동이 다 찼으면 2동, 3동… 새 동네가 열린다)
    if (p.district !== mbti || p.house_lot === null) {
      await this.store.moveHouse(viewer.id, mbti, townConfig.lotsPerDistrict, townConfig.hoodLots);
    }
    if (!(await this.store.getRoom(viewer.id))) await this.store.saveRoom(viewer.id, layout, bgm.key, now);
    return this.toMine((await this.store.getProfile(viewer.id))!);
  }

  /** 프로필·설정 바꾸기. 보낸 칸만 바꾼다. */
  async updateProfile(viewer: Viewer | null, patch: Record<string, unknown>): Promise<MyProfile> {
    const p = await this.requireOnboarded(viewer);
    const id = p.id;
    const next: Parameters<SceneStore['updateProfile']>[1] = {};
    if ('displayName' in patch) next.display_name = cleanText(patch.displayName, socialConfig.displayNameMax, '이름', true);
    if ('bio' in patch) next.bio = cleanText(patch.bio, socialConfig.bioMax, '프로필 문구');
    if ('hobby' in patch) next.hobby = cleanHobby(patch.hobby);
    if ('handle' in patch) {
      const h = String(patch.handle ?? '').trim().toLowerCase();
      if (!HANDLE.test(h)) throw new SceneError('bad_request', '주소는 영문 소문자·숫자·밑줄 3~20자로 정해 주세요.');
      if (await this.store.handleTaken(h, id)) throw new SceneError('conflict', '이미 쓰는 주소예요.');
      next.handle = h;
    }
    // 사는 마을은 따로 고르지 않는다. MBTI를 바꾸면 그 유형 마을로 이사한다 (changeMbti)
    if ('district' in patch) {
      throw new SceneError('bad_request', '사는 마을은 MBTI로 정해져요. MBTI를 바꾸면 그 마을로 이사해요.');
    }
    if ('avatar' in patch) next.avatar = cleanAvatar(patch.avatar);
    if ('taste' in patch) next.taste = cleanTaste(patch.taste);
    if ('roomVisibility' in patch) {
      if (!isVisibility(patch.roomVisibility)) throw new SceneError('bad_request', '공개 범위가 올바르지 않아요.');
      next.room_visibility = patch.roomVisibility;
    }
    if ('showVisits' in patch) next.show_visits = patch.showVisits === true;
    if ('discoverable' in patch) next.discoverable = patch.discoverable === true;
    await this.store.updateProfile(id, next);
    return this.toMine((await this.store.getProfile(id))!);
  }

  /**
   * MBTI 바꾸기 = 그 유형 마을로 이사. 바꾼 뒤 debateConfig.mbtiChangeCooldownDays일 동안은 다시 못 바꾼다
   * (토론 편을 옮겨 다니지 못하게). 가입 때 처음 정한 MBTI는 한 번 바로 고칠 수 있다.
   */
  async changeMbti(viewer: Viewer | null, mbti: unknown): Promise<MyProfile> {
    if (!viewer) throw new SceneError('login_required', '로그인이 필요해요.');
    const p = await this.store.getProfile(viewer.id);
    if (!p?.onboarded_at) throw new SceneError('onboarding_required', '먼저 가입을 마쳐 주세요.');
    if (!isMbtiType(mbti)) throw new SceneError('bad_request', 'MBTI 유형이 올바르지 않아요.');
    if (p.mbti !== mbti) {
      if (mbtiChangeableAt(p, this.now())) {
        throw new SceneError('conflict', `MBTI는 ${debateConfig.mbtiChangeCooldownDays}일에 한 번 바꿀 수 있어요.`);
      }
      // 기존 주민(예전에 MBTI 없이 가입한 사람)이 처음 정하는 것도 바로 고칠 수 있게 처음 한 번은 세지 않는다
      await this.store.setMbti(p.id, mbti, p.mbti ? this.now() : null);
    }
    if (p.district !== mbti || p.house_lot === null) {
      await this.store.moveHouse(p.id, mbti, townConfig.lotsPerDistrict, townConfig.hoodLots);
    }
    return this.toMine((await this.store.getProfile(p.id))!, await this.store.isAdmin(p.id));
  }

  // ───────────────────────── 나의 방 ─────────────────────────

  async saveRoom(viewer: Viewer | null, input: { layout: unknown; bgm?: unknown }): Promise<{ layout: RoomLayout; bgm: string | null }> {
    const p = await this.requireOnboarded(viewer);
    const check = validateLayout(input.layout);
    if (!check.ok) throw new SceneError('bad_request', check.error);
    // 액자에는 내 사진만 걸 수 있다
    for (const photoId of framedPhotoIds(check.layout)) {
      const photo = await this.store.getPhotoMeta(photoId);
      if (photo?.owner_id !== p.id) throw new SceneError('forbidden', '내 사진만 액자에 걸 수 있어요.');
    }
    const current = await this.store.getRoom(p.id);
    let bgm = current?.bgm ?? null;
    if (input.bgm !== undefined) {
      const t = input.bgm === null ? null : bgmTrack(String(input.bgm));
      if (input.bgm !== null && !t) throw new SceneError('bad_request', '없는 BGM이에요.');
      bgm = t?.key ?? null;
    }
    await this.store.saveRoom(p.id, check.layout, bgm, this.now());
    return { layout: check.layout, bgm };
  }

  // ───────────────────────── 관계 ─────────────────────────

  private async relationTo(viewer: Viewer | null, owner: ProfileRow): Promise<Relation> {
    if (!viewer) return 'other';
    if (viewer.id === owner.id) return 'self';
    const f = await this.store.getFriendship(viewer.id, owner.id);
    return f?.status === 'accepted' ? 'friend' : 'other';
  }

  /** 핸들로 주인을 찾는다. 차단 관계면 없는 것처럼 보인다. */
  private async ownerFor(viewer: Viewer | null, handle: string): Promise<ProfileRow> {
    const owner = HANDLE.test(handle) ? await this.store.getProfileByHandle(handle) : null;
    if (!owner?.onboarded_at) throw new SceneError('not_found', '방을 찾을 수 없어요.');
    if (viewer && viewer.id !== owner.id && (await this.store.isBlockedEither(viewer.id, owner.id)) && !(await this.isAdmin(viewer))) {
      throw new SceneError('not_found', '방을 찾을 수 없어요.');
    }
    return owner;
  }

  private async friendState(viewer: Viewer | null, owner: ProfileRow): Promise<FriendState> {
    if (!viewer || viewer.id === owner.id) return 'none';
    const f = await this.store.getFriendship(viewer.id, owner.id);
    if (!f) return 'none';
    if (f.status === 'accepted') return 'friends';
    return f.requester === viewer.id ? 'sent' : 'received';
  }

  /** 다른 사람(또는 내) 방 보기. 볼 수 있으면 방문을 기록한다. */
  async roomView(viewer: Viewer | null, handle: string): Promise<RoomView> {
    const owner = await this.ownerFor(viewer, handle);
    const relation = await this.relationTo(viewer, owner);
    // 운영자는 공개 범위와 상관없이 다 본다 (방문 기록은 남기지 않는다)
    const admin = relation !== 'self' && (await this.isAdmin(viewer));
    const canSeeRoom = admin || canView(owner.room_visibility, relation);
    const room = canSeeRoom ? await this.store.getRoom(owner.id) : null;
    const levels = admin ? [...VISIBILITIES] : visibleLevels(relation);
    const records = canSeeRoom ? (await this.store.listRecords(owner.id, levels, 10)).map(toRecord) : [];
    const guestbook = canSeeRoom ? await this.guestbookFor(viewer, owner, relation, admin) : [];
    const now = this.now();
    if (viewer && relation !== 'self' && canSeeRoom && owner.show_visits && !admin) {
      await this.store.recordVisit(owner.id, viewer.id, now, now.toISOString().slice(0, 10));
    }
    // 방문 기록을 끄면 새로 남기지도, 보여 주지도 않는다
    const visitors =
      relation === 'self' && !owner.show_visits
        ? []
        : relation === 'self'
        ? (await this.store.listVisitors(owner.id, new Date(now.getTime() - socialConfig.visitDays * 86400_000), 20)).map((v) => ({
            ...toCard(v),
            lastAt: new Date(v.last_at).toISOString(),
          }))
        : null;
    const viewerProfile = viewer && relation !== 'self' ? await this.store.getProfile(viewer.id) : null;
    return {
      owner: toPublic(owner),
      relation,
      room: room ? { layout: room.layout, bgm: room.bgm } : null,
      roomVisibility: owner.room_visibility,
      records,
      guestbook,
      friend: await this.friendState(viewer, owner),
      canWriteGuestbook: !!viewer && relation !== 'self' && canSeeRoom && !!viewerProfile?.onboarded_at,
      visitors,
    };
  }

  private async guestbookFor(viewer: Viewer | null, owner: ProfileRow, relation: Relation, admin = false): Promise<GuestbookView[]> {
    const levels = relation === 'other' && !admin ? (['public'] as Visibility[]) : (['public', 'friends'] as Visibility[]);
    const rows = await this.store.listGuestbook(owner.id, levels, viewer?.id ?? null, socialConfig.guestbookPageSize);
    return rows.map((g) => ({
      id: g.id,
      body: g.body,
      visibility: g.visibility,
      createdAt: new Date(g.created_at).toISOString(),
      author: {
        handle: g.author_handle,
        displayName: g.author_name || g.author_handle || '이름 없는 주민',
        avatar: cleanAvatar(g.author_avatar),
      },
      canDelete: !!viewer && (admin || viewer.id === owner.id || viewer.id === g.author_id),
    }));
  }

  // ───────────────────────── 기록 ─────────────────────────

  async myRecords(viewer: Viewer | null, before?: string): Promise<RecordView[]> {
    const p = await this.requireOnboarded(viewer);
    const b = before && !Number.isNaN(Date.parse(before)) ? new Date(before) : undefined;
    return (await this.store.listRecords(p.id, ['private', 'friends', 'public'], recordConfig.pageSize, b)).map(toRecord);
  }

  async createRecord(viewer: Viewer | null, input: unknown): Promise<RecordView> {
    const p = await this.requireOnboarded(viewer);
    const check = validateRecord(input);
    if (!check.ok) throw new SceneError('bad_request', check.error);
    if (check.record.photoId) {
      const photo = await this.store.getPhotoMeta(check.record.photoId);
      if (photo?.owner_id !== p.id) throw new SceneError('forbidden', '내 사진만 붙일 수 있어요.');
    }
    return toRecord(await this.store.insertRecord(p.id, check.record, this.now()));
  }

  async setRecordVisibility(viewer: Viewer | null, id: string, visibility: unknown): Promise<void> {
    const p = await this.requireOnboarded(viewer);
    const r = UUID.test(id) ? await this.store.getRecord(id) : null;
    if (!r || r.owner_id !== p.id) throw new SceneError('not_found', '기록을 찾을 수 없어요.');
    if (!isVisibility(visibility)) throw new SceneError('bad_request', '공개 범위가 올바르지 않아요.');
    if (r.kind === 'memo' && visibility !== 'private') throw new SceneError('bad_request', '메모는 나만 볼 수 있어요.');
    await this.store.setRecordVisibility(id, visibility);
  }

  async deleteRecord(viewer: Viewer | null, id: string): Promise<void> {
    const p = await this.requireOnboarded(viewer);
    const r = UUID.test(id) ? await this.store.getRecord(id) : null;
    if (!r || r.owner_id !== p.id) throw new SceneError('not_found', '기록을 찾을 수 없어요.');
    await this.store.deleteRecord(id);
  }

  // ───────────────────────── 사진 ─────────────────────────

  async uploadPhoto(viewer: Viewer | null, bytes: Uint8Array, size?: { width?: number; height?: number }): Promise<{ id: string }> {
    const p = await this.requireOnboarded(viewer);
    if (bytes.length > recordConfig.photoMaxBytes) throw new SceneError('too_large', '사진이 너무 커요.');
    const mime = sniffImage(bytes);
    if (!mime) throw new SceneError('bad_request', 'JPEG, PNG, WebP 사진만 올릴 수 있어요.');
    const dim = (n: unknown) => (Number.isInteger(n) && (n as number) > 0 && (n as number) <= 10000 ? (n as number) : null);
    return { id: await this.store.insertPhoto(p.id, mime, bytes, dim(size?.width), dim(size?.height)) };
  }

  async myPhotos(viewer: Viewer | null): Promise<{ id: string; createdAt: string }[]> {
    const p = await this.requireOnboarded(viewer);
    return (await this.store.listPhotos(p.id, 120)).map((x) => ({ id: x.id, createdAt: new Date(x.created_at).toISOString() }));
  }

  /**
   * 사진 보기 권한: 주인이거나, 그 사진이 붙은 기록을 볼 수 있거나, 그 사진이 걸린 방을 볼 수 있으면.
   * 볼 수 없으면 없는 사진처럼 404.
   */
  async photo(viewer: Viewer | null, id: string): Promise<{ mime: string; bytes: Uint8Array }> {
    const meta = UUID.test(id) ? await this.store.getPhotoMeta(id) : null;
    if (!meta) throw new SceneError('not_found', '사진을 찾을 수 없어요.');
    const ok = await this.canSeePhoto(viewer, meta.owner_id, id);
    if (!ok) throw new SceneError('not_found', '사진을 찾을 수 없어요.');
    return { mime: meta.mime, bytes: (await this.store.getPhotoBytes(id))! };
  }

  private async canSeePhoto(viewer: Viewer | null, ownerId: string, photoId: string): Promise<boolean> {
    if (viewer?.id === ownerId) return true;
    if (await this.isAdmin(viewer)) return true;
    if (viewer && (await this.store.isBlockedEither(viewer.id, ownerId))) return false;
    const owner = await this.store.getProfile(ownerId);
    if (!owner) return false;
    const relation = await this.relationTo(viewer, owner);
    const viaRecord = (await this.store.photoRecordVisibilities(photoId)).some((v) => canView(v, relation));
    if (viaRecord) return true;
    if (!canView(owner.room_visibility, relation)) return false;
    const room = await this.store.getRoom(ownerId);
    return !!room && framedPhotoIds(room.layout).includes(photoId);
  }

  // ───────────────────────── 친구 ─────────────────────────

  async friends(viewer: Viewer | null): Promise<{ friends: RoomCard[]; received: RoomCard[]; sent: RoomCard[] }> {
    const p = await this.requireOnboarded(viewer);
    const rows = await this.store.listFriendships(p.id);
    const out = { friends: [] as RoomCard[], received: [] as RoomCard[], sent: [] as RoomCard[] };
    for (const r of rows) {
      if (!r.handle) continue;
      const card = toCard(r);
      if (r.status === 'accepted') out.friends.push(card);
      else if (r.addressee === p.id) out.received.push(card);
      else out.sent.push(card);
    }
    return out;
  }

  /** 친구 신청. 상대가 이미 나에게 신청했으면 바로 친구가 된다. */
  async requestFriend(viewer: Viewer | null, handle: string): Promise<FriendState> {
    const me = await this.requireOnboarded(viewer);
    const other = await this.ownerFor(viewer, handle);
    if (other.id === me.id) throw new SceneError('bad_request', '나에게는 친구 신청을 할 수 없어요.');
    const f = await this.store.getFriendship(me.id, other.id);
    if (f?.status === 'accepted') return 'friends';
    if (f && f.requester === other.id) {
      await this.store.acceptFriend(other.id, me.id, this.now());
      return 'friends';
    }
    if (!f) await this.store.requestFriend(me.id, other.id, this.now());
    return 'sent';
  }

  async acceptFriend(viewer: Viewer | null, handle: string): Promise<void> {
    const me = await this.requireOnboarded(viewer);
    const other = await this.ownerFor(viewer, handle);
    if (!(await this.store.acceptFriend(other.id, me.id, this.now()))) throw new SceneError('not_found', '받은 친구 신청이 없어요.');
  }

  /** 신청 취소·거절·친구 끊기 */
  async removeFriend(viewer: Viewer | null, handle: string): Promise<void> {
    const me = await this.requireOnboarded(viewer);
    const other = await this.store.getProfileByHandle(handle);
    if (other) await this.store.deleteFriendship(me.id, other.id);
  }

  // ───────────────────────── 방명록 ─────────────────────────

  async writeGuestbook(viewer: Viewer | null, handle: string, input: { body: unknown; visibility?: unknown }): Promise<void> {
    const me = await this.requireOnboarded(viewer);
    const owner = await this.ownerFor(viewer, handle);
    if (owner.id === me.id) throw new SceneError('bad_request', '내 방명록에는 쓸 수 없어요.');
    const relation = await this.relationTo(viewer, owner);
    if (!canView(owner.room_visibility, relation) && !(await this.isAdmin(viewer))) throw new SceneError('forbidden', '이 방에는 방명록을 쓸 수 없어요.');
    const body = cleanText(input.body, socialConfig.guestbookMax, '방명록', true);
    if (!moderate(body).allowed) throw new SceneError('rejected', '거친 표현이나 링크·연락처는 남길 수 없어요.');
    const visibility = input.visibility === 'friends' ? 'friends' : 'public';
    await this.store.insertGuestbook(owner.id, me.id, body, visibility, this.now());
  }

  async deleteGuestbook(viewer: Viewer | null, id: string): Promise<void> {
    const me = await this.requireOnboarded(viewer);
    const g = UUID.test(id) ? await this.store.getGuestbook(id) : null;
    if (!g || (g.owner_id !== me.id && g.author_id !== me.id && !(await this.isAdmin(viewer)))) throw new SceneError('not_found', '글을 찾을 수 없어요.');
    await this.store.deleteGuestbook(id);
  }

  // ───────────────────────── 차단·신고 ─────────────────────────

  /** 차단하면 친구도 끊긴다 */
  async block(viewer: Viewer | null, handle: string): Promise<void> {
    const me = await this.requireOnboarded(viewer);
    const other = HANDLE.test(handle) ? await this.store.getProfileByHandle(handle) : null;
    if (!other || other.id === me.id) throw new SceneError('not_found', '사용자를 찾을 수 없어요.');
    await this.store.block(me.id, other.id);
    await this.store.deleteFriendship(me.id, other.id);
  }

  async unblock(viewer: Viewer | null, handle: string): Promise<void> {
    const me = await this.requireOnboarded(viewer);
    const other = await this.store.getProfileByHandle(handle);
    if (other) await this.store.unblock(me.id, other.id);
  }

  async blocked(viewer: Viewer | null): Promise<{ handle: string; displayName: string }[]> {
    const me = await this.requireOnboarded(viewer);
    return (await this.store.listBlocked(me.id))
      .filter((b) => b.handle)
      .map((b) => ({ handle: b.handle!, displayName: displayNameOf(b) }));
  }

  async report(viewer: Viewer | null, input: { kind: unknown; targetId: unknown; reason?: unknown }): Promise<void> {
    const me = await this.requireOnboarded(viewer);
    const kind = input.kind;
    if (kind !== 'guestbook' && kind !== 'record' && kind !== 'user') throw new SceneError('bad_request', '신고 대상이 올바르지 않아요.');
    let targetId = String(input.targetId ?? '');
    if (kind === 'user') {
      const u = HANDLE.test(targetId) ? await this.store.getProfileByHandle(targetId) : null;
      if (!u) throw new SceneError('not_found', '사용자를 찾을 수 없어요.');
      targetId = u.id;
    } else if (!UUID.test(targetId)) {
      throw new SceneError('bad_request', '신고 대상이 올바르지 않아요.');
    }
    await this.store.report(me.id, kind, targetId, cleanText(input.reason, 300, '신고 이유') || null);
  }

  // ───────────────────────── 운영자 ─────────────────────────

  /** 운영자인지 (운영 화면 /admin이 쓴다) */
  async isAdminViewer(viewer: Viewer | null): Promise<boolean> {
    return this.isAdmin(viewer);
  }

  /** 운영자가 아니면 운영 기능이 있다는 것도 알리지 않는다 (없는 것처럼 404) */
  private async requireAdmin(viewer: Viewer | null): Promise<string> {
    if (!viewer || !(await this.store.isAdmin(viewer.id))) throw new SceneError('not_found', '찾을 수 없어요.');
    return viewer.id;
  }

  /** 운영 요약: 주민 수, 오늘 가입·접속, 기록·사진·방명록 수, 처리 안 된 신고 */
  async adminOverview(viewer: Viewer | null): Promise<AdminCounts> {
    await this.requireAdmin(viewer);
    // 오늘 = 한국 날짜 0시부터
    const day = localDate(this.now());
    return this.store.adminCounts(new Date(`${day}T00:00:00+09:00`));
  }

  async adminReports(viewer: Viewer | null): Promise<AdminReport[]> {
    await this.requireAdmin(viewer);
    const rows = await this.store.listReports(100);
    return rows.map((r) => ({
      id: r.id,
      kind: r.target_kind,
      targetId: r.target_id,
      reason: r.reason,
      createdAt: new Date(r.created_at).toISOString(),
      resolved: r.resolved_at ? (r.resolution ?? 'dismissed') : null,
      reporter: r.reporter_handle ? { handle: r.reporter_handle, displayName: r.reporter_name || r.reporter_handle } : null,
      preview: r.preview,
      roomHandle: r.room_handle,
      // 이미 지워진 글·기록
      gone: r.target_kind !== 'user' && r.preview === null,
    }));
  }

  /**
   * 신고 처리: dismiss = 문제없음으로 닫기, remove = 신고된 방명록·기록을 지우고 닫기.
   * 같은 대상의 다른 신고도 함께 닫힌다. 사용자 신고를 지우려면 계정 삭제(adminDeleteUser)를 쓴다.
   */
  async adminResolveReport(viewer: Viewer | null, id: string, action: unknown): Promise<void> {
    const by = await this.requireAdmin(viewer);
    if (action !== 'dismiss' && action !== 'remove') throw new SceneError('bad_request', '처리 방법이 올바르지 않아요.');
    const r = UUID.test(id) ? await this.store.getReport(id) : null;
    if (!r) throw new SceneError('not_found', '신고를 찾을 수 없어요.');
    if (action === 'remove') {
      if (r.target_kind === 'guestbook') await this.store.deleteGuestbook(r.target_id);
      else if (r.target_kind === 'record') await this.store.deleteRecord(r.target_id);
      else throw new SceneError('bad_request', '사용자 신고는 주민 목록에서 계정을 지워 주세요.');
    }
    await this.store.resolveReports(r.target_kind, r.target_id, by, action === 'remove' ? 'removed' : 'dismissed', this.now());
  }

  async adminUsers(viewer: Viewer | null, q: unknown): Promise<AdminUser[]> {
    await this.requireAdmin(viewer);
    const query = typeof q === 'string' ? q.trim().slice(0, 30) : '';
    const rows = await this.store.searchProfiles(query, 50);
    return rows.map((u) => ({
      id: u.id,
      handle: u.handle,
      displayName: u.display_name || u.handle || '이름 없는 주민',
      district: u.district && isDistrict(u.district) ? u.district : null,
      joinedAt: u.onboarded_at ? localDate(new Date(u.onboarded_at)) : null,
      lastSeenAt: u.last_seen_at ? new Date(u.last_seen_at).toISOString() : null,
      admin: u.is_admin,
      records: Number(u.records),
      coins: Number(u.coins ?? 0),
    }));
  }

  /** 운영자: 주민에게 코인을 주거나 뺀다 (음수면 뺀다, 0 밑으로는 안 내려간다). 새 잔액 */
  async adminAdjustWallet(viewer: Viewer | null, userId: unknown, input: Record<string, unknown>): Promise<{ coins: number }> {
    await this.requireAdmin(viewer);
    const int = (v: unknown, max: number) => {
      if (v === undefined || v === null || v === '') return 0;
      const n = Number(v);
      if (!Number.isInteger(n) || Math.abs(n) > max) throw new SceneError('bad_request', `한 번에 ${max.toLocaleString('ko-KR')}까지 주거나 뺄 수 있어요.`);
      return n;
    };
    const coins = int(input.coins, ADMIN_WALLET_MAX.coins);
    if (!coins) throw new SceneError('bad_request', '줄 코인을 적어 주세요.');
    if (typeof userId !== 'string' || !/^[0-9a-f-]{36}$/i.test(userId)) throw new SceneError('not_found', '주민을 찾지 못했어요.');
    const r = await this.store.adjustWallet(userId, coins);
    if (!r) throw new SceneError('not_found', '주민을 찾지 못했어요.');
    return r;
  }

  /** 운영자 공지: 지금 실시간 서버에 접속한 모두에게 위쪽 띠로 보인다 (저장하지 않는다) */
  async adminNotice(viewer: Viewer | null, text: unknown): Promise<{ sent: boolean }> {
    await this.requireAdmin(viewer);
    const a = parseAnnouncement({ kind: 'notice', text });
    if (!a) throw new SceneError('bad_request', `공지 내용을 ${NOTICE_MAX}자 안으로 적어 주세요.`);
    const sent = await this.announce(a).catch(() => false);
    if (!sent) throw new SceneError('conflict', '실시간 서버에 공지를 보내지 못했어요. 잠시 뒤에 다시 보내 주세요.');
    return { sent };
  }

  /** 계정 삭제 (되돌릴 수 없다). 나와 다른 운영자는 지울 수 없다 */
  async adminDeleteUser(viewer: Viewer | null, id: string): Promise<void> {
    const me = await this.requireAdmin(viewer);
    if (!UUID.test(id)) throw new SceneError('bad_request', '사용자가 올바르지 않아요.');
    if (id === me || (await this.store.isAdmin(id))) throw new SceneError('forbidden', '운영자 계정은 여기서 지울 수 없어요.');
    if (!(await this.store.getProfile(id))) throw new SceneError('not_found', '사용자를 찾을 수 없어요.');
    await this.store.deleteAccount(id);
  }

  // ───────────────────────── 둘러보기 ─────────────────────────

  async explore(viewer: Viewer | null, district: string | null): Promise<{
    rooms: RoomCard[];
    newcomers: RoomCard[];
    counts: Partial<Record<District, number>>;
  }> {
    const d = district && isDistrict(district) ? district : null;
    const [rooms, newcomers, counts] = await Promise.all([
      this.store.discoverable(viewer?.id ?? null, d, 'recent', socialConfig.exploreLimit),
      this.store.discoverable(viewer?.id ?? null, null, 'new', 8),
      this.store.districtCounts(),
    ]);
    return { rooms: rooms.map(toCard), newcomers: newcomers.map(toCard), counts };
  }

  // ───────────────────────── 마을 ─────────────────────────

  /** 마을에 서 있는 집들. 이름은 내 집·친구 집·공개 방만, 차단 관계인 사람 집은 이름 없이 둔다. */
  async town(viewer: Viewer | null): Promise<TownView> {
    const [houses, friends, blocks] = await Promise.all([
      this.store.houses(),
      viewer ? this.store.friendIds(viewer.id) : Promise.resolve([]),
      viewer ? this.store.blockRelations(viewer.id) : Promise.resolve([]),
    ]);
    const friendSet = new Set(friends);
    const blockSet = new Set(blocks);
    return {
      houses: houses.map((h) => {
        const mine = h.id === viewer?.id;
        const friend = friendSet.has(h.id) && !blockSet.has(h.id);
        const named =
          !!h.handle && !blockSet.has(h.id) &&
          (mine || (friend && h.room_visibility !== 'private') || (h.room_visibility === 'public' && h.discoverable));
        return {
          district: h.district,
          hood: Number(h.house_hood),
          lot: h.house_lot,
          name: named ? displayNameOf(h) : null,
          handle: named ? h.handle : null,
          mine,
          friend,
        };
      }),
      hidden: blocks.map((id) => townPid(id)),
    };
  }

  /**
   * 실시간 마을 입장 토큰. 가입을 마친 사람은 이름·지역·집터·모습을, 아니면 손님으로 담는다.
   * 방 주소는 방을 찾아갈 수 있게 한 사람(공개 + 발견 켜기)만 담는다.
   */
  async townTicket(viewer: Viewer | null): Promise<TownTicket> {
    const found = viewer ? await this.store.getProfile(viewer.id) : null;
    const p = found && (await this.ensureHouse(found));
    // 만료는 실시간 서버 시계와 맞춰야 하므로 개발용 시계가 아니라 실제 시각으로 정한다
    const exp = Math.floor(Date.now() / 1000) + townConfig.tokenTtlSeconds;
    let pass: TownPass;
    if (p?.onboarded_at && p.mbti && p.district === p.mbti) {
      const avatar = cleanAvatar(p.avatar);
      pass = {
        pid: townPid(p.id),
        name: displayNameOf(p),
        handle: p.handle && p.room_visibility === 'public' && p.discoverable ? p.handle : '',
        district: p.district,
        hood: p.house_hood,
        lot: p.house_lot ?? -1,
        body: avatar.body,
        color: avatar.color,
        acc: avatar.accessory,
        exp,
        // 이름표 둘째 줄: MBTI
        ...(p.mbti ? { mbti: p.mbti } : {}),
        ...((await this.isAdmin(viewer)) ? { admin: true as const } : {}),
      };
    } else {
      pass = {
        pid: guestPid(), name: '손님', handle: '', district: '', hood: 1, lot: -1, body: 'male',
        color: AVATAR_COLORS[randomBytes(1)[0] % AVATAR_COLORS.length], acc: 'none', exp,
      };
    }
    // 하루 첫 방문: 대항전 출석 점수 (하루 상한이 한 번 값이라 여러 번 들어와도 한 번)
    if (p?.onboarded_at && p.mbti && p.district === p.mbti) await this.contest(p, 'checkin', contestConfig.points.checkin);
    return { token: signTownPass(pass), pass, guest: pass.district === '' };
  }

  /**
   * 집 안(방) 실시간 입장 토큰. 방을 볼 수 있는 사람(공개 범위, 차단)에게만 준다.
   * 주인과 손님이 같은 집 방에 들어가 서로 보인다. 내 모습은 마을 토큰과 같다 (손님은 손님 모습).
   */
  async houseTicket(viewer: Viewer | null, handle: string): Promise<HouseTicket> {
    const owner = await this.ownerFor(viewer, handle);
    const relation = await this.relationTo(viewer, owner);
    if (!canView(owner.room_visibility, relation) && !(await this.isAdmin(viewer))) throw new SceneError('forbidden', '이 방에는 들어갈 수 없어요.');
    const base = await this.townTicket(viewer);
    const pass: TownPass = { ...base.pass, house: townPid(owner.id) };
    const hidden = viewer ? (await this.store.blockRelations(viewer.id)).map((id) => townPid(id)) : [];
    return { token: signTownPass(pass), pass, guest: base.guest, house: pass.house!, hidden };
  }

  // ───────────────────────── 놀거리: 열매·운세 열매·낚시 ─────────────────────────

  /**
   * 나무에서 열매 따기. 나무마다 하루 한 번 (열매 나무는 playConfig.fruitsPerTree개, 운세 나무는 운세 열매 하나).
   * 이미 땄으면 already: true (운세 나무는 그날 운세를 다시 보여 준다).
   */
  async pickTree(viewer: Viewer | null, spotRaw: unknown): Promise<PickResult> {
    const p = await this.requireOnboarded(viewer);
    const spot = parseTreeSpot(spotRaw);
    if (!spot) throw new SceneError('bad_request', '나무를 찾지 못했어요.');
    const day = localDate(this.now());
    const fortune = spot.kind === 'fortune' ? fortuneFor(`${p.id}:${day}`) : null;
    const fruit = spot.kind === 'fortune' ? FORTUNE_FRUIT : fruitOf(spot.district);
    const n = spot.kind === 'fortune' ? 1 : playConfig.fruitsPerTree;
    const fresh = await this.store.takeDailySpot(p.id, day, `tree:${treeSpotId(spot)}`, fruit.id);
    const count = fresh ? await this.store.addToCollection(p.id, 'fruit', fruit.id, n) : await this.countOf(p.id, 'fruit', fruit.id);
    const earned = fresh ? (spot.kind === 'fortune' ? coinConfig.fortune : coinConfig.fruit * n) : 0;
    if (earned) await this.store.addCoins(p.id, earned);
    const contest = fresh ? await this.contest(p, 'fruit', spot.kind === 'fortune' ? contestConfig.points.fortune : contestConfig.points.fruit) : 0;
    return { already: !fresh, fruit: { id: fruit.id, name: fruit.name, color: fruit.color }, added: fresh ? n : 0, count, fortune, earned, contest };
  }

  /** 낚시 한 번. 하루 playConfig.fishPerDay번 */
  async castLine(viewer: Viewer | null): Promise<FishResult> {
    const p = await this.requireOnboarded(viewer);
    const day = localDate(this.now());
    for (let attempt = 0; attempt < 3; attempt++) {
      const used = (await this.store.dailySpots(p.id, day, 'fish:')).length;
      // 화면에는 횟수를 보여 주지 않는다. 자동으로 계속 던지는 것만 막는 넉넉한 상한
      if (used >= playConfig.fishPerDay) throw new SceneError('conflict', '물고기들이 오늘은 쉬고 싶대요. 내일 또 와요!');
      // 황금 고래(rWhale) → 꽝·물고기 순서로 본다
      const rWhale = Math.random();
      const caught = rollCatch(Math.random(), Math.random(), Math.random(), rWhale);
      // 같은 번호를 동시에 쓰면 다시 센다
      if (!(await this.store.takeDailySpot(p.id, day, `fish:${used + 1}`, caught?.fish.id ?? null))) continue;
      const left = playConfig.fishPerDay - used - 1;
      if (!caught) return { fish: null, size: 0, count: 0, left, earned: 0, contest: 0 };
      const count = await this.store.addToCollection(p.id, 'fish', caught.fish.id, 1);
      const earned = coinConfig.fish[caught.fish.rarity];
      await this.store.addCoins(p.id, earned);
      const contest = await this.contest(p, 'fish', contestConfig.points.fish[caught.fish.rarity]);
      // 황금 고래: 마을 모두에게 알린다
      if (caught.fish.id === GOLDEN_WHALE_ID) {
        const announced = await this.announce({ kind: 'golden_whale', name: displayNameOf(p) }).catch(() => false);
        return { fish: caught.fish, size: caught.size, count, left, announced, earned, contest };
      }
      return { fish: caught.fish, size: caught.size, count, left, earned, contest };
    }
    throw new SceneError('conflict', '잠깐 뒤에 다시 던져 주세요.');
  }

  /** 오늘 딴 나무, 남은 낚시 횟수, 모은 것 (도감) */
  async playState(viewer: Viewer | null): Promise<PlayState> {
    const p = await this.requireOnboarded(viewer);
    const day = localDate(this.now());
    const [trees, fish, items, coins] = await Promise.all([
      this.store.dailySpots(p.id, day, 'tree:'),
      this.store.dailySpots(p.id, day, 'fish:'),
      this.store.collection(p.id),
      this.store.coinsOf(p.id),
    ]);
    return {
      day,
      pickedTrees: trees.map((t) => t.spot.slice('tree:'.length)),
      fishLeft: Math.max(0, playConfig.fishPerDay - fish.length),
      fruits: Object.fromEntries(items.filter((i) => i.kind === 'fruit').map((i) => [i.item, i.count])),
      fish: Object.fromEntries(items.filter((i) => i.kind === 'fish' && fishDef(i.item)).map((i) => [i.item, i.count])),
      coins,
    };
  }

  // ───────────────────────── 클럽 유튜브 신청 제한 ─────────────────────────

  /** 유튜브 신청을 확인할 때 쓰는 제한 (켜고 끄기, 막은 영상·채널) */
  youtubeLimits() {
    return {
      on: () => this.store.youtubeRequestsOn(),
      blocked: (videoId: string, channelId: string | null) => this.store.youtubeBlocked(videoId, channelId),
    };
  }

  /** 운영자: 유튜브 신청 켜기·끄기와 막은 영상·채널 목록 */
  async adminYoutube(viewer: Viewer | null): Promise<AdminYoutube> {
    await this.requireAdmin(viewer);
    const [on, blocks] = await Promise.all([this.store.youtubeRequestsOn(), this.store.listYoutubeBlocks()]);
    return { on, blocks };
  }

  /**
   * 운영자: { on } 켜기·끄기, { block: { url, scope: 'video' | 'channel' } } 막기, { unblock: { kind, id } } 풀기.
   * resolve = 영상 id로 제목·채널을 알아오는 길 (YouTube API, 라우트가 넣어 준다)
   */
  async adminYoutubeUpdate(
    viewer: Viewer | null,
    input: Record<string, unknown>,
    resolve: (videoId: string) => Promise<{ title: string; channelId: string; channelTitle: string } | null>,
  ): Promise<AdminYoutube> {
    await this.requireAdmin(viewer);
    const now = this.now();
    if (typeof input.on === 'boolean') await this.store.setYoutubeRequestsOn(input.on, now);
    const block = input.block as { url?: unknown; scope?: unknown } | undefined;
    if (block) {
      const url = typeof block.url === 'string' ? block.url.trim() : '';
      const channel = /youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/.exec(url)?.[1] ?? (/^UC[A-Za-z0-9_-]{22}$/.test(url) ? url : null);
      if (channel) await this.store.addYoutubeBlock('channel', channel, channel, now);
      else {
        const id = youtubeIdOf(url);
        if (!id) throw new SceneError('bad_request', '유튜브 영상 링크나 채널 주소(youtube.com/channel/…)를 넣어 주세요.');
        const info = await resolve(id).catch(() => null);
        if (block.scope === 'channel') {
          if (!info?.channelId) throw new SceneError('conflict', '이 영상의 채널을 알아내지 못했어요. 잠시 뒤에 다시 해 주세요.');
          await this.store.addYoutubeBlock('channel', info.channelId, info.channelTitle || info.channelId, now);
        } else {
          await this.store.addYoutubeBlock('video', id, info?.title || id, now);
        }
      }
    }
    const unblock = input.unblock as { kind?: unknown; id?: unknown } | undefined;
    if (unblock && (unblock.kind === 'video' || unblock.kind === 'channel') && typeof unblock.id === 'string') {
      await this.store.removeYoutubeBlock(unblock.kind, unblock.id);
    }
    return this.adminYoutube(viewer);
  }

  // ───────────────────────── MBTI 마을 대항전 ─────────────────────────

  /** 대항전 점수를 내 지역에 더한다 (하루 상한까지). 기록에 실패해도 놀이는 그대로 된다. 더해진 점수 */
  private async contest(p: { id: string; district: string | null }, kind: ContestKind, points: number): Promise<number> {
    return this.store.addContestPoints(p.id, p.district, kind, points, this.now()).catch((e) => {
      console.error('[contest] 점수 기록 실패', e);
      return 0;
    });
  }

  /** 지난주 결과를 아직 정하지 않았는지 (정하기 전에 일요일 토론 결과부터 집계한다) */
  async contestUnsettled(): Promise<boolean> {
    const week = previousContestWeek(this.now()).week;
    if (this.settledWeek === week) return false;
    const done = !!(await this.store.getContestResult(week));
    if (done) this.settledWeek = week;
    return !done;
  }

  /**
   * 지난주 결과를 처음 한 번 정해 둔다 (그 뒤로는 다시 계산하지 않는다). 처음 정한 요청이 서버 전체에 우승 지역을 발표한다.
   * 발표는 일요일 21시에서 6시간 안에만 한다 (오래 아무도 오지 않다가 늦게 정해지면 조용히 정해 둔다).
   */
  async settleContest(): Promise<{ week: string; winner: District | null; announced: boolean } | null> {
    const now = this.now();
    const prev = previousContestWeek(now);
    if (!(await this.contestUnsettled())) return null;
    const s = await this.store.contestStandings(now, prev);
    const winner = contestLeader(s.districts);
    const first = await this.store.insertContestResult(prev.week, winner, s.districts, now);
    this.settledWeek = prev.week;
    if (!first) return null;
    const fresh = now.getTime() - prev.closesAt.getTime() < 6 * 3600_000;
    const announced = winner && fresh ? await this.announce({ kind: 'contest', district: winner }).catch(() => false) : false;
    return { week: prev.week, winner, announced };
  }

  /** 대항전 순위 (누구나 본다): 이번 주와 지난주 결과 */
  async contestBoard(): Promise<Pick<ContestView, 'standings' | 'last'>> {
    const now = this.now();
    const prev = previousContestWeek(now);
    const [standings, saved] = await Promise.all([this.store.contestStandings(now), this.store.getContestResult(prev.week)]);
    let last: { winner: District | null; districts: ContestDistrictScore[] };
    if (saved) last = saved;
    else {
      const x = await this.store.contestStandings(now, prev);
      last = { winner: contestLeader(x.districts), districts: x.districts };
    }
    return { standings, last: { week: prev.week, ...last } };
  }

  /** 대항전 화면: 이번 주 순위, 지난주 결과, (주민이면) 내 지역과 내가 올린 점수 */
  async contestView(viewer: Viewer | null): Promise<ContestView> {
    const now = this.now();
    const [board, p] = await Promise.all([this.contestBoard(), viewer ? this.store.getProfile(viewer.id) : Promise.resolve(null)]);
    const resident = p?.onboarded_at && p.district && isDistrict(p.district) ? p : null;
    return { ...board, me: resident ? { district: resident.district as District, ...(await this.store.myContestPoints(resident.id, now)) } : null };
  }

  // ───────────────────────── 상가 ─────────────────────────

  /** 상가 점포 (누구나 본다). 로그인했으면 내 코인과 내 점포 번호도 */
  async marketView(viewer: Viewer | null): Promise<MarketView> {
    const rows = await this.store.listShops();
    const me = viewer ? await this.store.getProfile(viewer.id) : null;
    const signedIn = !!me?.onboarded_at;
    return {
      shops: rows.map((r) => ({
        slot: r.slot,
        name: r.name,
        intro: r.intro,
        color: isShopColor(r.color) ? r.color : 'mint',
        owner: { displayName: r.display_name || r.handle || '이름 없는 주민', handle: r.handle },
        mine: r.owner_id === viewer?.id,
      })),
      price: marketConfig.price,
      coins: signedIn ? await this.store.coinsOf(me!.id) : null,
      myShop: rows.find((r) => r.owner_id === viewer?.id)?.slot ?? null,
      admin: await this.isAdmin(viewer),
    };
  }

  /** 빈 점포를 코인으로 산다. 한 사람에 한 칸 */
  async buyShop(viewer: Viewer | null, input: Record<string, unknown>): Promise<MarketView> {
    const p = await this.requireOnboarded(viewer);
    const slot = input.slot;
    if (!isShopSlot(slot)) throw new SceneError('bad_request', '점포 번호가 올바르지 않아요.');
    const shop = cleanShopInput(input);
    const shops = await this.store.listShops();
    const mine = shops.find((r) => r.owner_id === p.id);
    if (mine) throw new SceneError('conflict', `이미 ${shopLabel(mine.slot)} 점포 주인이에요. 점포는 한 사람에 한 칸이에요.`);
    if (shops.some((r) => r.slot === slot)) throw new SceneError('conflict', '방금 다른 주민이 산 점포예요.');
    if ((await this.store.spendCoins(p.id, marketConfig.price)) === null) {
      const have = await this.store.coinsOf(p.id);
      throw new SceneError('conflict', `코인이 모자라요. ${marketConfig.price.toLocaleString('ko-KR')}코인이 필요한데 ${have.toLocaleString('ko-KR')}코인 있어요.`);
    }
    // 동시에 같은 칸을 사거나 두 칸을 사려 하면 한쪽만 들어간다. 못 들어가면 코인을 돌려준다
    if (!(await this.store.insertShop(slot, p.id, shop.name, shop.intro, shop.color, this.now()))) {
      await this.store.addCoins(p.id, marketConfig.price);
      throw new SceneError('conflict', '방금 다른 주민이 산 점포예요.');
    }
    await this.contest(p, 'market', contestConfig.points.shop);
    return this.marketView(viewer);
  }

  /** 내 점포 이름·소개·차양 색 바꾸기 */
  async updateShop(viewer: Viewer | null, input: Record<string, unknown>): Promise<MarketView> {
    const p = await this.requireOnboarded(viewer);
    const shop = cleanShopInput(input);
    if (!(await this.store.updateShop(p.id, shop.name, shop.intro, shop.color, this.now()))) throw new SceneError('not_found', '내 점포가 없어요.');
    return this.marketView(viewer);
  }

  /**
   * 점포 비우기. 주인은 내 점포를 내놓고 값의 절반을 돌려받는다.
   * 운영자는 남의 점포도 비울 수 있다 (이름이 문제일 때 등. 주인에게 같은 몫을 돌려준다).
   */
  async releaseShop(viewer: Viewer | null, slotRaw: unknown): Promise<MarketView> {
    const p = await this.requireOnboarded(viewer);
    const slot = typeof slotRaw === 'string' ? Number(slotRaw) : slotRaw;
    if (!isShopSlot(slot)) throw new SceneError('bad_request', '점포 번호가 올바르지 않아요.');
    const owner = (await this.store.listShops()).find((r) => r.slot === slot)?.owner_id;
    if (!owner) throw new SceneError('not_found', '빈 점포예요.');
    if (owner !== p.id && !(await this.isAdmin(viewer))) throw new SceneError('forbidden', '내 점포만 내놓을 수 있어요.');
    if ((await this.store.deleteShop(slot)) === owner) await this.store.addCoins(owner, refundFor());
    return this.marketView(viewer);
  }

  private async countOf(userId: string, kind: 'fruit' | 'fish', item: string): Promise<number> {
    return (await this.store.collection(userId)).find((c) => c.kind === kind && c.item === item)?.count ?? 0;
  }

  // ───────────────────────── 내보내기·삭제 ─────────────────────────

  /** 내 기록 내보내기 (사진은 id만, 파일은 사진 주소로 받는다) */
  async exportData(viewer: Viewer | null): Promise<Record<string, unknown>> {
    const p = await this.requireOnboarded(viewer);
    const [room, records, photos, friends, guestbook] = await Promise.all([
      this.store.getRoom(p.id),
      this.store.allRecords(p.id),
      this.store.listPhotos(p.id, 10000),
      this.friends(viewer),
      this.store.guestbookWrittenBy(p.id),
    ]);
    return {
      exportedAt: this.now().toISOString(),
      profile: this.toMine(p),
      room,
      records: records.map(toRecord),
      photos: photos.map((x) => ({ id: x.id, url: `/api/photos/${x.id}`, createdAt: new Date(x.created_at).toISOString() })),
      friends: friends.friends.map((f) => f.handle),
      guestbookWritten: guestbook.map((g) => ({ body: g.body, createdAt: new Date(g.created_at).toISOString() })),
    };
  }

  /** 기록과 사진을 모두 지운다. 액자에 걸린 사진도 내린다. */
  async deleteArchive(viewer: Viewer | null): Promise<void> {
    const p = await this.requireOnboarded(viewer);
    await this.store.deleteArchive(p.id);
    const room = await this.store.getRoom(p.id);
    if (room && framedPhotoIds(room.layout).length) {
      const layout = { ...room.layout, items: room.layout.items.map(({ photoId: _drop, ...rest }) => rest) };
      await this.store.saveRoom(p.id, layout, room.bgm, this.now());
    }
  }
}
