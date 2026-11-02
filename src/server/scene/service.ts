// 미니홈피 규칙을 지키며 저장소를 다룬다. 화면(API)은 이 클래스만 쓴다.
// 공개 범위와 차단은 여기서 검사한다. 화면에서 숨기는 것만으로 끝내지 않는다 (PROJECT_GUIDE.md 3부 9번).
import 'server-only';
import { randomBytes } from 'node:crypto';
import { recordConfig, socialConfig } from '@/config/game';
import { isMbtiType, type MbtiType } from '@/design/mbti';
import { cleanAvatar, type Avatar } from '@/shared/avatar';
import { bgmTrack } from '@/shared/bgm';
import { cleanTaste, isDistrict, type District, type Taste } from '@/shared/districts';
import { moderate } from '@/shared/moderation';
import {
  canView, isVisibility, validateRecord, visibleLevels,
  type Emotion, type RecordKind, type Relation, type Visibility,
} from '@/shared/records';
import { framedPhotoIds, starterLayout, validateLayout, type RoomLayout } from '@/shared/room';
import type { ProfileRow, RecordRow, RoomCardRow, SceneStore } from './store';

export type SceneErrorCode =
  | 'login_required' | 'onboarding_required' | 'not_found' | 'forbidden' | 'bad_request' | 'conflict' | 'blocked' | 'rejected'
  | 'too_large';

const STATUS: Record<SceneErrorCode, number> = {
  login_required: 401, onboarding_required: 409, not_found: 404, forbidden: 403, bad_request: 400, conflict: 409,
  blocked: 403, rejected: 400, too_large: 413,
};

export class SceneError extends Error {
  readonly status: number;
  constructor(readonly code: SceneErrorCode, message: string) {
    super(message);
    this.status = STATUS[code];
  }
}

export interface Viewer {
  id: string;
}

const HANDLE = /^[a-z0-9_]{3,20}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// ───────────────────────── 화면에 내보내는 모양 ─────────────────────────

/** 다른 사람에게 보여 줘도 되는 프로필 */
export interface PublicProfile {
  handle: string;
  displayName: string;
  bio: string;
  district: District | null;
  avatar: Avatar;
  mbti: MbtiType | null;
}

/** 내 프로필 (설정 화면용) */
export interface MyProfile extends PublicProfile {
  onboarded: boolean;
  taste: Taste;
  birthDate: string | null;
  roomVisibility: Visibility;
  showVisits: boolean;
  discoverable: boolean;
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
  taste: unknown;
  mbti?: unknown;
  birthDate?: unknown;
  district: unknown;
  avatar: unknown;
  starter: unknown;
  wallpaper?: unknown;
  floor?: unknown;
  bgm: unknown;
  displayName: unknown;
  bio?: unknown;
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

function cleanText(v: unknown, max: number, what: string, required = false): string {
  const s = typeof v === 'string' ? v.trim().replace(/\s+\n/g, '\n') : '';
  if (required && !s) throw new SceneError('bad_request', `${what}을(를) 써 주세요.`);
  if (s.length > max) throw new SceneError('bad_request', `${what}은(는) ${max}자까지 쓸 수 있어요.`);
  return s;
}

function cleanBirthDate(v: unknown, now: Date): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string' || !DATE.test(v)) throw new SceneError('bad_request', '생년월일은 YYYY-MM-DD로 적어 주세요.');
  const d = new Date(`${v}T00:00:00Z`);
  const year = Number(v.slice(0, 4));
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v || year < 1900 || d > now) {
    throw new SceneError('bad_request', '생년월일이 올바르지 않아요.');
  }
  return v;
}

/** 이미지 파일 앞부분으로 형식을 확인한다 (보낸 사람이 적은 형식을 믿지 않는다) */
export function sniffImage(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

export class SceneService {
  constructor(
    private readonly store: SceneStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // ───────────────────────── 나 ─────────────────────────

  async me(viewer: Viewer): Promise<{ profile: MyProfile; room: { layout: RoomLayout; bgm: string | null } | null }> {
    await this.store.ensureProfile(viewer.id);
    await this.store.touch(viewer.id, this.now());
    const p = (await this.store.getProfile(viewer.id))!;
    const room = await this.store.getRoom(viewer.id);
    return { profile: this.toMine(p), room: room ? { layout: room.layout, bgm: room.bgm } : null };
  }

  private toMine(p: ProfileRow): MyProfile {
    return {
      ...toPublic(p),
      onboarded: !!p.onboarded_at,
      taste: cleanTaste(p.taste),
      birthDate: p.birth_date,
      roomVisibility: p.room_visibility,
      showVisits: p.show_visits,
      discoverable: p.discoverable,
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
    if (!isDistrict(input.district)) throw new SceneError('bad_request', '거주 지역을 골라 주세요.');
    const bgm = bgmTrack(typeof input.bgm === 'string' ? input.bgm : null);
    if (!bgm) throw new SceneError('bad_request', '대표 BGM을 골라 주세요.');
    const displayName = cleanText(input.displayName, socialConfig.displayNameMax, '이름', true);
    const bio = cleanText(input.bio, socialConfig.bioMax, '프로필 문구');
    const now = this.now();
    const layout = starterLayout(String(input.starter ?? ''), String(input.wallpaper ?? ''), String(input.floor ?? ''));
    await this.store.updateProfile(viewer.id, {
      handle: p.handle ?? (await this.newHandle(viewer.id)),
      display_name: displayName,
      bio,
      district: input.district,
      birth_date: cleanBirthDate(input.birthDate, now),
      taste: cleanTaste(input.taste),
      avatar: cleanAvatar(input.avatar),
      onboarded_at: p.onboarded_at ?? now,
    });
    // MBTI는 선택 입력. 처음 정할 때만 여기서 저장한다 (바꾸기는 7일에 한 번, 설정 화면에서)
    if (input.mbti && isMbtiType(input.mbti) && !p.mbti) await this.store.setMbti(viewer.id, input.mbti, now);
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
    if ('handle' in patch) {
      const h = String(patch.handle ?? '').trim().toLowerCase();
      if (!HANDLE.test(h)) throw new SceneError('bad_request', '주소는 영문 소문자·숫자·밑줄 3~20자로 정해 주세요.');
      if (await this.store.handleTaken(h, id)) throw new SceneError('conflict', '이미 쓰는 주소예요.');
      next.handle = h;
    }
    if ('district' in patch) {
      if (!isDistrict(patch.district)) throw new SceneError('bad_request', '거주 지역이 올바르지 않아요.');
      next.district = patch.district;
    }
    if ('avatar' in patch) next.avatar = cleanAvatar(patch.avatar);
    if ('taste' in patch) next.taste = cleanTaste(patch.taste);
    if ('birthDate' in patch) next.birth_date = cleanBirthDate(patch.birthDate, this.now());
    if ('roomVisibility' in patch) {
      if (!isVisibility(patch.roomVisibility)) throw new SceneError('bad_request', '공개 범위가 올바르지 않아요.');
      next.room_visibility = patch.roomVisibility;
    }
    if ('showVisits' in patch) next.show_visits = patch.showVisits === true;
    if ('discoverable' in patch) next.discoverable = patch.discoverable === true;
    await this.store.updateProfile(id, next);
    return this.toMine((await this.store.getProfile(id))!);
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
    if (viewer && viewer.id !== owner.id && (await this.store.isBlockedEither(viewer.id, owner.id))) {
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
    const canSeeRoom = canView(owner.room_visibility, relation);
    const room = canSeeRoom ? await this.store.getRoom(owner.id) : null;
    const levels = visibleLevels(relation);
    const records = canSeeRoom ? (await this.store.listRecords(owner.id, levels, 10)).map(toRecord) : [];
    const guestbook = canSeeRoom ? await this.guestbookFor(viewer, owner, relation) : [];
    const now = this.now();
    if (viewer && relation !== 'self' && canSeeRoom && owner.show_visits) {
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

  private async guestbookFor(viewer: Viewer | null, owner: ProfileRow, relation: Relation): Promise<GuestbookView[]> {
    const levels = relation === 'other' ? (['public'] as Visibility[]) : (['public', 'friends'] as Visibility[]);
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
      canDelete: !!viewer && (viewer.id === owner.id || viewer.id === g.author_id),
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
    if (!canView(owner.room_visibility, relation)) throw new SceneError('forbidden', '이 방에는 방명록을 쓸 수 없어요.');
    const body = cleanText(input.body, socialConfig.guestbookMax, '방명록', true);
    if (!moderate(body).allowed) throw new SceneError('rejected', '거친 표현이나 링크·연락처는 남길 수 없어요.');
    const visibility = input.visibility === 'friends' ? 'friends' : 'public';
    await this.store.insertGuestbook(owner.id, me.id, body, visibility, this.now());
  }

  async deleteGuestbook(viewer: Viewer | null, id: string): Promise<void> {
    const me = await this.requireOnboarded(viewer);
    const g = UUID.test(id) ? await this.store.getGuestbook(id) : null;
    if (!g || (g.owner_id !== me.id && g.author_id !== me.id)) throw new SceneError('not_found', '글을 찾을 수 없어요.');
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
