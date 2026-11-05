// 미니홈피 데이터 읽기·쓰기 (SQL). 공개 범위·차단 같은 규칙은 service.ts가 검사하고, 여기는 저장만 한다.
import 'server-only';
import type { MbtiType } from '@/design/mbti';
import type { Avatar } from '@/shared/avatar';
import type { ContestDistrictScore, ContestKind, ContestStandings, ContestWeek } from '@/shared/contest';
import { addContestPoints, contestStandings, myContestPoints } from '../contest';
import type { District, Taste } from '@/shared/districts';
import type { Emotion, RecordInput, RecordKind, Visibility } from '@/shared/records';
import type { RoomLayout } from '@/shared/room';
import type { Sql } from '../db';

export interface ProfileRow {
  id: string;
  handle: string | null;
  display_name: string | null;
  bio: string | null;
  /** 사는 마을 (= MBTI 유형) */
  district: District | null;
  taste: Partial<Taste>;
  avatar: Partial<Avatar>;
  mbti: MbtiType | null;
  /** MBTI를 마지막으로 바꾼 때 (처음 정한 것은 null) */
  mbti_changed_at: Date | null;
  room_visibility: Visibility;
  show_visits: boolean;
  discoverable: boolean;
  onboarded_at: Date | null;
  /** 주민증 취미 (선택) */
  hobby: string | null;
  /** 집이 있는 동네 번호 (1 = 본섬 1동) */
  house_hood: number;
  /** 동네 안 집터 번호 (가입 전이면 null) */
  house_lot: number | null;
}

export interface ShopRow {
  slot: number;
  owner_id: string;
  name: string;
  intro: string;
  color: string;
  display_name: string | null;
  handle: string | null;
}

export interface HouseRow {
  id: string;
  handle: string | null;
  display_name: string | null;
  district: District;
  house_hood: number;
  house_lot: number;
  room_visibility: Visibility;
  discoverable: boolean;
}

export interface RecordRow {
  id: string;
  owner_id: string;
  kind: RecordKind;
  emotion: Emotion | null;
  body: string;
  photo_id: string | null;
  visibility: Visibility;
  created_at: Date;
}

export interface GuestbookRow {
  id: string;
  owner_id: string;
  author_id: string;
  body: string;
  visibility: 'friends' | 'public';
  created_at: Date;
  author_handle: string | null;
  author_name: string | null;
  author_avatar: Partial<Avatar>;
}

export interface FriendRow {
  requester: string;
  addressee: string;
  status: 'pending' | 'accepted';
  created_at: Date;
}

export interface RoomCardRow {
  id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  district: District | null;
  avatar: Partial<Avatar>;
  bgm: string | null;
}

const PROFILE_COLS = `id, handle, display_name, bio, district, taste, avatar, mbti, mbti_changed_at,
  room_visibility, show_visits, discoverable, onboarded_at, house_hood, house_lot, hobby`;
const RECORD_COLS = `id, owner_id, kind, emotion, body, photo_id, visibility, created_at`;
const CARD_COLS = `p.id, p.handle, p.display_name, p.bio, p.district, p.avatar, r.bgm`;

/** jsonb 매개변수는 문자열로 넘기고 ::text::jsonb로 바꾼다 (postgres.js가 한 번 더 감싸지 않게) */
const json = (v: unknown) => JSON.stringify(v);

/** 수정할 수 있는 프로필 칸 (SQL에 이름을 그대로 쓰므로 목록에 있는 것만 받는다) */
export type ProfilePatch = Partial<{
  handle: string;
  display_name: string;
  bio: string;
  district: District;
  taste: Taste;
  avatar: Avatar;
  room_visibility: Visibility;
  show_visits: boolean;
  discoverable: boolean;
  onboarded_at: Date;
  hobby: string;
}>;
const JSON_COLS = new Set(['taste', 'avatar']);
const PATCH_COLS = new Set([
  'handle', 'display_name', 'bio', 'district', 'taste', 'avatar', 'room_visibility', 'show_visits', 'discoverable',
  'onboarded_at', 'hobby',
]);

export interface AdminCounts {
  residents: number;
  joined_today: number;
  active_today: number;
  records: number;
  photos: number;
  guestbook: number;
  open_reports: number;
}

export interface ReportRow {
  id: string;
  target_kind: 'guestbook' | 'record' | 'user';
  target_id: string;
  reason: string | null;
  created_at: Date;
  resolved_at: Date | null;
  resolution: 'dismissed' | 'removed' | null;
  reporter_handle: string | null;
  reporter_name: string | null;
  preview: string | null;
  room_handle: string | null;
}

/** 가입 계정 (auth.users + 프로필). 운영 화면 가입 도움이 쓴다 */
export interface SignupRow {
  id: string;
  email: string;
  created_at: Date;
  email_confirmed_at: Date | null;
  last_sign_in_at: Date | null;
  handle: string | null;
  display_name: string | null;
  onboarded_at: Date | null;
  is_admin: boolean;
}

/** 가입·로그인이 막힌 기록 하나 (app_settings 'signup_failures'에 최근 것부터 모아 둔다) */
export interface SignupFailure {
  email: string;
  /** Supabase Auth 오류 코드 (없으면 status_<HTTP 상태>) */
  code: string;
  step: 'signup' | 'login' | 'resend';
  /** 마지막으로 막힌 때 (ISO) */
  at: string;
  /** 같은 주소·오류로 막힌 횟수 */
  count: number;
}

export interface AdminUserRow {
  id: string;
  handle: string | null;
  display_name: string | null;
  district: string | null;
  onboarded_at: Date | null;
  last_seen_at: Date | null;
  is_admin: boolean;
  records: number;
  coins: number;
}

export class SceneStore {
  constructor(private readonly sql: Sql) {}

  // ───────── 프로필 ─────────

  async ensureProfile(id: string): Promise<void> {
    await this.sql.query(`insert into public.profiles (id) values ($1) on conflict (id) do nothing`, [id]);
  }

  async getProfile(id: string): Promise<ProfileRow | null> {
    const [r] = await this.sql.query<ProfileRow>(`select ${PROFILE_COLS} from public.profiles where id = $1`, [id]);
    return r ?? null;
  }

  async getProfileByHandle(handle: string): Promise<ProfileRow | null> {
    const [r] = await this.sql.query<ProfileRow>(`select ${PROFILE_COLS} from public.profiles where handle = $1`, [handle]);
    return r ?? null;
  }

  async handleTaken(handle: string, exceptId: string): Promise<boolean> {
    const rows = await this.sql.query(`select 1 from public.profiles where handle = $1 and id <> $2`, [handle, exceptId]);
    return rows.length > 0;
  }

  async updateProfile(id: string, patch: ProfilePatch): Promise<void> {
    const entries = Object.entries(patch).filter(([k, v]) => PATCH_COLS.has(k) && v !== undefined);
    if (!entries.length) return;
    const sets = entries.map(([k], i) => (JSON_COLS.has(k) ? `${k} = $${i + 2}::text::jsonb` : `${k} = $${i + 2}`));
    await this.sql.query(
      `update public.profiles set ${sets.join(', ')} where id = $1`,
      [id, ...entries.map(([k, v]) => (JSON_COLS.has(k) ? json(v) : v))],
    );
  }

  /**
   * 그 지역의 빈 집터 가운데 (동네 번호, 집터 번호)가 가장 작은 곳으로 이사한다.
   * 1동(본섬)은 firstLots곳, 2동부터는 동네마다 hoodLots곳. 열린 동네가 다 찼으면 다음 동네의 0번 집터가 된다 (새 동네가 열린다).
   * 두 사람이 동시에 같은 집터를 잡으면 유일 색인이 막으므로 다시 고른다.
   */
  async moveHouse(id: string, district: District, firstLots: number, hoodLots: number): Promise<{ hood: number; lot: number }> {
    for (let attempt = 0; ; attempt++) {
      try {
        const [r] = await this.sql.query<{ house_hood: number; house_lot: number }>(
          `with used as (
             select house_hood as h, house_lot as l from public.profiles
             where district = $2 and house_lot is not null and id <> $1
           ),
           slots as (
             select 1 as h, n as l from generate_series(0, $3::int - 1) as n
             union all
             select h, l
             from generate_series(2, (select coalesce(max(h), 1) + 1 from used)) as h, generate_series(0, $4::int - 1) as l
           ),
           pick as (
             select s.h, s.l from slots s where not exists (select 1 from used u where u.h = s.h and u.l = s.l)
             order by s.h, s.l limit 1
           )
           update public.profiles set district = $2, house_hood = pick.h, house_lot = pick.l
           from pick where id = $1
           returning house_hood, house_lot`,
          [id, district, firstLots, hoodLots],
        );
        if (!r) throw new Error('집터를 고르지 못했습니다');
        return { hood: Number(r.house_hood), lot: Number(r.house_lot) };
      } catch (e) {
        if ((e as { code?: string }).code !== '23505' || attempt >= 4) throw e;
      }
    }
  }

  /** 마을에 서 있는 집 (가입을 마친 사람만) */
  async houses(): Promise<HouseRow[]> {
    return this.sql.query<HouseRow>(
      `select id, handle, display_name, district, house_hood, house_lot, room_visibility, discoverable
       from public.profiles
       where onboarded_at is not null and district is not null and house_lot is not null
       order by district, house_hood, house_lot`,
    );
  }

  /** 친구 (수락한 것만) */
  async friendIds(userId: string): Promise<string[]> {
    const rows = await this.sql.query<{ id: string }>(
      `select case when requester = $1 then addressee else requester end as id
       from public.friendships where status = 'accepted' and (requester = $1 or addressee = $1)`,
      [userId],
    );
    return rows.map((r) => r.id);
  }

  /** 내가 차단했거나 나를 차단한 사람 */
  async blockRelations(userId: string): Promise<string[]> {
    const rows = await this.sql.query<{ id: string }>(
      `select case when blocker = $1 then blocked else blocker end as id from public.blocks where blocker = $1 or blocked = $1`,
      [userId],
    );
    return rows.map((r) => r.id);
  }

  async touch(id: string, at: Date): Promise<void> {
    await this.sql.query(`update public.profiles set last_seen_at = $2 where id = $1`, [id, at]);
  }

  /** MBTI 정하기. at = 바꾼 때 (처음 정한 것은 null: 바꾸기 대기 시간을 세지 않는다) */
  async setMbti(id: string, mbti: MbtiType, at: Date | null): Promise<void> {
    await this.sql.query(`update public.profiles set mbti = $2, mbti_changed_at = $3 where id = $1`, [id, mbti, at]);
  }

  // ───────── 방 ─────────

  async getRoom(userId: string): Promise<{ layout: RoomLayout; bgm: string | null; updated_at: Date } | null> {
    const [r] = await this.sql.query<{ layout: RoomLayout; bgm: string | null; updated_at: Date }>(
      `select layout, bgm, updated_at from public.rooms where user_id = $1`,
      [userId],
    );
    return r ?? null;
  }

  async saveRoom(userId: string, layout: RoomLayout, bgm: string | null, at: Date): Promise<void> {
    await this.sql.query(
      `insert into public.rooms (user_id, layout, bgm, updated_at) values ($1, $2::text::jsonb, $3, $4)
       on conflict (user_id) do update set layout = excluded.layout, bgm = excluded.bgm, updated_at = excluded.updated_at`,
      [userId, json(layout), bgm, at],
    );
  }

  // ───────── 사진 ─────────

  async insertPhoto(ownerId: string, mime: string, bytes: Uint8Array, width: number | null, height: number | null): Promise<string> {
    const [r] = await this.sql.query<{ id: string }>(
      `insert into public.photos (owner_id, mime, bytes, width, height) values ($1, $2, $3, $4, $5) returning id`,
      // postgres.js는 Buffer를 bytea로 보낸다
      [ownerId, mime, Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), width, height],
    );
    return r.id;
  }

  async getPhotoMeta(id: string): Promise<{ id: string; owner_id: string; mime: string } | null> {
    const [r] = await this.sql.query<{ id: string; owner_id: string; mime: string }>(
      `select id, owner_id, mime from public.photos where id = $1`,
      [id],
    );
    return r ?? null;
  }

  async getPhotoBytes(id: string): Promise<Uint8Array | null> {
    const [r] = await this.sql.query<{ bytes: Uint8Array }>(`select bytes from public.photos where id = $1`, [id]);
    return r ? new Uint8Array(r.bytes) : null;
  }

  async listPhotos(ownerId: string, limit: number): Promise<{ id: string; created_at: Date }[]> {
    return this.sql.query(`select id, created_at from public.photos where owner_id = $1 order by created_at desc limit $2`, [ownerId, limit]);
  }

  /** 이 사진이 붙은 기록들의 공개 범위 */
  async photoRecordVisibilities(photoId: string): Promise<Visibility[]> {
    const rows = await this.sql.query<{ visibility: Visibility }>(`select visibility from public.records where photo_id = $1`, [photoId]);
    return rows.map((r) => r.visibility);
  }

  async deletePhoto(id: string): Promise<void> {
    await this.sql.query(`delete from public.photos where id = $1`, [id]);
  }

  // ───────── 기록 ─────────

  async insertRecord(ownerId: string, r: RecordInput, at: Date): Promise<RecordRow> {
    const [row] = await this.sql.query<RecordRow>(
      `insert into public.records (owner_id, kind, emotion, body, photo_id, visibility, created_at)
       values ($1, $2, $3, $4, $5, $6, $7) returning ${RECORD_COLS}`,
      [ownerId, r.kind, r.emotion, r.body, r.photoId, r.visibility, at],
    );
    return row;
  }

  async listRecords(ownerId: string, levels: Visibility[], limit: number, before?: Date): Promise<RecordRow[]> {
    if (!levels.length) return [];
    return this.sql.query<RecordRow>(
      `select ${RECORD_COLS} from public.records
       where owner_id = $1 and visibility = any($2::text[]) and ($3::timestamptz is null or created_at < $3)
       order by created_at desc, id desc limit $4`,
      [ownerId, levels, before ?? null, limit],
    );
  }

  async getRecord(id: string): Promise<RecordRow | null> {
    const [r] = await this.sql.query<RecordRow>(`select ${RECORD_COLS} from public.records where id = $1`, [id]);
    return r ?? null;
  }

  async setRecordVisibility(id: string, visibility: Visibility): Promise<void> {
    await this.sql.query(`update public.records set visibility = $2 where id = $1`, [id, visibility]);
  }

  async deleteRecord(id: string): Promise<void> {
    await this.sql.query(`delete from public.records where id = $1`, [id]);
  }

  async allRecords(ownerId: string): Promise<RecordRow[]> {
    return this.sql.query<RecordRow>(`select ${RECORD_COLS} from public.records where owner_id = $1 order by created_at`, [ownerId]);
  }

  /** 기록과 사진을 모두 지운다 */
  async deleteArchive(ownerId: string): Promise<void> {
    await this.sql.query(`delete from public.records where owner_id = $1`, [ownerId]);
    await this.sql.query(`delete from public.photos where owner_id = $1`, [ownerId]);
  }

  // ───────── 친구 ─────────

  async getFriendship(a: string, b: string): Promise<FriendRow | null> {
    const [r] = await this.sql.query<FriendRow>(
      `select requester, addressee, status, created_at from public.friendships
       where (requester = $1 and addressee = $2) or (requester = $2 and addressee = $1)`,
      [a, b],
    );
    return r ?? null;
  }

  async requestFriend(from: string, to: string, at: Date): Promise<void> {
    await this.sql.query(
      `insert into public.friendships (requester, addressee, created_at) values ($1, $2, $3) on conflict do nothing`,
      [from, to, at],
    );
  }

  async acceptFriend(requester: string, addressee: string, at: Date): Promise<boolean> {
    const rows = await this.sql.query(
      `update public.friendships set status = 'accepted', accepted_at = $3
       where requester = $1 and addressee = $2 and status = 'pending' returning requester`,
      [requester, addressee, at],
    );
    return rows.length > 0;
  }

  async deleteFriendship(a: string, b: string): Promise<void> {
    await this.sql.query(
      `delete from public.friendships where (requester = $1 and addressee = $2) or (requester = $2 and addressee = $1)`,
      [a, b],
    );
  }

  /** 내 친구·받은 신청·보낸 신청 (상대 방 카드와 함께) */
  async listFriendships(userId: string): Promise<(FriendRow & RoomCardRow & { other: string })[]> {
    return this.sql.query(
      `select f.requester, f.addressee, f.status, f.created_at,
              case when f.requester = $1 then f.addressee else f.requester end as other,
              ${CARD_COLS}
       from public.friendships f
       join public.profiles p on p.id = case when f.requester = $1 then f.addressee else f.requester end
       left join public.rooms r on r.user_id = p.id
       where f.requester = $1 or f.addressee = $1
       order by f.created_at desc`,
      [userId],
    );
  }

  // ───────── 차단·신고 ─────────

  async isBlockedEither(a: string, b: string): Promise<boolean> {
    const rows = await this.sql.query(
      `select 1 from public.blocks where (blocker = $1 and blocked = $2) or (blocker = $2 and blocked = $1)`,
      [a, b],
    );
    return rows.length > 0;
  }

  async block(blocker: string, blocked: string): Promise<void> {
    await this.sql.query(`insert into public.blocks (blocker, blocked) values ($1, $2) on conflict do nothing`, [blocker, blocked]);
  }

  async unblock(blocker: string, blocked: string): Promise<void> {
    await this.sql.query(`delete from public.blocks where blocker = $1 and blocked = $2`, [blocker, blocked]);
  }

  async listBlocked(blocker: string): Promise<{ id: string; handle: string | null; display_name: string | null }[]> {
    return this.sql.query(
      `select p.id, p.handle, p.display_name from public.blocks b join public.profiles p on p.id = b.blocked
       where b.blocker = $1 order by b.created_at desc`,
      [blocker],
    );
  }

  async report(reporter: string, kind: string, targetId: string, reason: string | null): Promise<void> {
    await this.sql.query(
      `insert into public.reports (reporter, target_kind, target_id, reason) values ($1, $2, $3, $4)`,
      [reporter, kind, targetId, reason],
    );
  }

  // ───────── 운영자 ─────────

  async isAdmin(userId: string): Promise<boolean> {
    const [r] = await this.sql.query<{ ok: number }>(`select 1 as ok from public.admins where user_id = $1`, [userId]);
    return !!r;
  }

  async addAdmin(userId: string): Promise<void> {
    await this.sql.query(`insert into public.admins (user_id) values ($1) on conflict (user_id) do nothing`, [userId]);
  }

  async adminCounts(since: Date): Promise<AdminCounts> {
    const [r] = await this.sql.query<Record<keyof AdminCounts, number>>(
      `select
         (select count(*) from public.profiles where onboarded_at is not null)::int as residents,
         (select count(*) from public.profiles where onboarded_at >= $1)::int as joined_today,
         (select count(*) from public.profiles where last_seen_at >= $1)::int as active_today,
         (select count(*) from public.records)::int as records,
         (select count(*) from public.photos)::int as photos,
         (select count(*) from public.guestbook)::int as guestbook,
         (select count(*) from public.reports where resolved_at is null)::int as open_reports`,
      [since],
    );
    return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v)])) as unknown as AdminCounts;
  }

  /** 신고 목록 (처리 안 된 것 먼저). 대상 내용 미리보기와 그 방 주인 핸들을 같이 준다 */
  async listReports(limit: number): Promise<ReportRow[]> {
    return this.sql.query<ReportRow>(
      `select r.id, r.target_kind, r.target_id, r.reason, r.created_at, r.resolved_at, r.resolution,
              rp.handle as reporter_handle, rp.display_name as reporter_name,
              case r.target_kind
                when 'guestbook' then (select g.body from public.guestbook g where g.id = r.target_id)
                when 'record' then (select rc.body from public.records rc where rc.id = r.target_id)
                else (select coalesce(u.display_name, u.handle) from public.profiles u where u.id = r.target_id)
              end as preview,
              case r.target_kind
                when 'guestbook' then (select o.handle from public.guestbook g join public.profiles o on o.id = g.owner_id where g.id = r.target_id)
                when 'record' then (select o.handle from public.records rc join public.profiles o on o.id = rc.owner_id where rc.id = r.target_id)
                else (select u.handle from public.profiles u where u.id = r.target_id)
              end as room_handle
       from public.reports r left join public.profiles rp on rp.id = r.reporter
       order by (r.resolved_at is null) desc, r.created_at desc limit $1`,
      [limit],
    );
  }

  async getReport(id: string): Promise<{ id: string; target_kind: string; target_id: string; resolved_at: Date | null } | null> {
    const [r] = await this.sql.query<{ id: string; target_kind: string; target_id: string; resolved_at: Date | null }>(
      `select id, target_kind, target_id, resolved_at from public.reports where id = $1`,
      [id],
    );
    return r ?? null;
  }

  /** 같은 대상의 신고를 한꺼번에 처리한다 */
  async resolveReports(kind: string, targetId: string, by: string, resolution: 'dismissed' | 'removed', at: Date): Promise<void> {
    await this.sql.query(
      `update public.reports set resolved_at = $4, resolved_by = $3, resolution = $5
       where target_kind = $1 and target_id = $2 and resolved_at is null`,
      [kind, targetId, by, at, resolution],
    );
  }

  /** 이름·핸들로 주민 찾기 (빈 검색이면 최근 가입 순) */
  async searchProfiles(q: string, limit: number): Promise<AdminUserRow[]> {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    return this.sql.query<AdminUserRow>(
      `select p.id, p.handle, p.display_name, p.district, p.onboarded_at, p.last_seen_at,
              exists (select 1 from public.admins a where a.user_id = p.id) as is_admin,
              (select count(*) from public.records rc where rc.owner_id = p.id)::int as records,
              p.coins
       from public.profiles p
       where $1 = '%%' or p.display_name ilike $1 or p.handle ilike $1
       order by p.onboarded_at desc nulls last limit $2`,
      [like, limit],
    );
  }

  // ───────── 가입 도움 (운영자) ─────────

  /** 최근 가입 계정 (이메일이 있는 계정만). q가 있으면 이메일에 그 글자가 든 계정만 */
  async listSignups(q: string, limit: number): Promise<SignupRow[]> {
    const like = q ? `%${q.toLowerCase().replace(/[%_\\]/g, (c) => `\\${c}`)}%` : '';
    return this.sql.query<SignupRow>(
      `select u.id, u.email, u.created_at, u.email_confirmed_at, u.last_sign_in_at,
              p.handle, p.display_name, p.onboarded_at,
              exists (select 1 from public.admins a where a.user_id = u.id) as is_admin
       from auth.users u left join public.profiles p on p.id = u.id
       where u.email is not null and ($1 = '' or lower(u.email) like $1)
       order by u.created_at desc limit $2`,
      [like, limit],
    );
  }

  async getSignup(id: string): Promise<SignupRow | null> {
    const [r] = await this.sql.query<SignupRow>(
      `select u.id, u.email, u.created_at, u.email_confirmed_at, u.last_sign_in_at,
              p.handle, p.display_name, p.onboarded_at,
              exists (select 1 from public.admins a where a.user_id = u.id) as is_admin
       from auth.users u left join public.profiles p on p.id = u.id
       where u.id = $1 and u.email is not null`,
      [id],
    );
    return r ?? null;
  }

  /** 메일 인증을 아직 안 한 계정 수 */
  async countPendingSignups(): Promise<number> {
    const [r] = await this.sql.query<{ n: number }>(`select count(*)::int as n from auth.users where email is not null and email_confirmed_at is null`);
    return Number(r?.n ?? 0);
  }

  /** 메일 인증을 끝낸 것으로 친다 (이미 끝났으면 그대로 둔다) */
  async confirmSignup(id: string, at: Date): Promise<void> {
    await this.sql.query(`update auth.users set email_confirmed_at = $2 where id = $1 and email_confirmed_at is null`, [id, at]);
  }

  async signupFailures(): Promise<SignupFailure[]> {
    const [r] = await this.sql.query<{ value: SignupFailure[] | string }>(`select value from public.app_settings where key = 'signup_failures'`);
    if (!r) return [];
    const v = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
    return Array.isArray(v) ? v : [];
  }

  async saveSignupFailures(list: SignupFailure[], at: Date): Promise<void> {
    await this.sql.query(
      `insert into public.app_settings (key, value, updated_at) values ('signup_failures', $1, $2)
       on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
      [JSON.stringify(list), at],
    );
  }

  /** 계정을 지운다 (프로필과 딸린 것이 모두 같이 지워진다) */
  async deleteAccount(userId: string): Promise<void> {
    await this.sql.query(`delete from auth.users where id = $1`, [userId]);
  }

  // ───────── 방명록 ─────────

  async insertGuestbook(ownerId: string, authorId: string, body: string, visibility: 'friends' | 'public', at: Date): Promise<string> {
    const [r] = await this.sql.query<{ id: string }>(
      `insert into public.guestbook (owner_id, author_id, body, visibility, created_at) values ($1, $2, $3, $4, $5) returning id`,
      [ownerId, authorId, body, visibility, at],
    );
    return r.id;
  }

  /** levels에 든 공개 범위의 글과, viewer가 쓴 글 (차단한 사람의 글은 빼고) */
  async listGuestbook(ownerId: string, levels: Visibility[], viewerId: string | null, limit: number): Promise<GuestbookRow[]> {
    return this.sql.query<GuestbookRow>(
      `select g.id, g.owner_id, g.author_id, g.body, g.visibility, g.created_at,
              p.handle as author_handle, p.display_name as author_name, p.avatar as author_avatar
       from public.guestbook g join public.profiles p on p.id = g.author_id
       where g.owner_id = $1
         and (g.visibility = any($2::text[]) or g.author_id = $3)
         and ($3::uuid is null or not exists (
           select 1 from public.blocks b where (b.blocker = $3 and b.blocked = g.author_id) or (b.blocker = g.author_id and b.blocked = $3)))
       order by g.created_at desc limit $4`,
      [ownerId, levels, viewerId, limit],
    );
  }

  async getGuestbook(id: string): Promise<{ id: string; owner_id: string; author_id: string } | null> {
    const [r] = await this.sql.query<{ id: string; owner_id: string; author_id: string }>(
      `select id, owner_id, author_id from public.guestbook where id = $1`,
      [id],
    );
    return r ?? null;
  }

  async deleteGuestbook(id: string): Promise<void> {
    await this.sql.query(`delete from public.guestbook where id = $1`, [id]);
  }

  async guestbookWrittenBy(authorId: string): Promise<{ owner_id: string; body: string; created_at: Date }[]> {
    return this.sql.query(`select owner_id, body, created_at from public.guestbook where author_id = $1 order by created_at`, [authorId]);
  }

  // ───────── 방문 ─────────

  // ───────── 놀거리 (열매·낚시) ─────────

  /** 하루 한 번짜리 자리를 쓴다. 이미 썼으면 false (같은 날 같은 자리) */
  async takeDailySpot(userId: string, day: string, spot: string, item: string | null): Promise<boolean> {
    const rows = await this.sql.query(
      `insert into public.daily_picks (user_id, day, spot, item) values ($1, $2, $3, $4)
       on conflict do nothing returning spot`,
      [userId, day, spot, item],
    );
    return rows.length > 0;
  }

  /** 오늘 쓴 자리 (prefix로 시작하는 것만) */
  async dailySpots(userId: string, day: string, prefix = ''): Promise<{ spot: string; item: string | null }[]> {
    return this.sql.query<{ spot: string; item: string | null }>(
      `select spot, item from public.daily_picks where user_id = $1 and day = $2 and spot like $3 order by created_at`,
      [userId, day, `${prefix}%`],
    );
  }

  /** 모은 것에 더하고 지금 개수를 돌려준다 */
  async addToCollection(userId: string, kind: 'fruit' | 'fish', item: string, n: number): Promise<number> {
    const [r] = await this.sql.query<{ count: number }>(
      `insert into public.collections (user_id, kind, item, count) values ($1, $2, $3, $4)
       on conflict (user_id, kind, item) do update set count = public.collections.count + excluded.count
       returning count`,
      [userId, kind, item, n],
    );
    return Number(r.count);
  }

  async collection(userId: string): Promise<{ kind: 'fruit' | 'fish'; item: string; count: number }[]> {
    const rows = await this.sql.query<{ kind: 'fruit' | 'fish'; item: string; count: number }>(
      `select kind, item, count from public.collections where user_id = $1 order by kind, first_at`,
      [userId],
    );
    return rows.map((r) => ({ ...r, count: Number(r.count) }));
  }

  // ───────────────────────── 코인·상가 ─────────────────────────

  async coinsOf(userId: string): Promise<number> {
    const [r] = await this.sql.query<{ coins: number }>(`select coins from public.profiles where id = $1`, [userId]);
    return Number(r?.coins ?? 0);
  }

  /** 코인을 더한다. 새 잔액 */
  async addCoins(userId: string, n: number): Promise<number> {
    const [r] = await this.sql.query<{ coins: number }>(`update public.profiles set coins = coins + $2 where id = $1 returning coins`, [userId, n]);
    return Number(r?.coins ?? 0);
  }

  // ───────── 클럽 유튜브 신청 제한 ─────────

  /** 유튜브 신청을 받는지 (설정이 없으면 받는다) */
  async youtubeRequestsOn(): Promise<boolean> {
    const [r] = await this.sql.query<{ value: { on?: boolean } | string }>(`select value from public.app_settings where key = 'youtube_requests'`);
    if (!r) return true;
    const v = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
    return v?.on !== false;
  }

  async setYoutubeRequestsOn(on: boolean, at: Date): Promise<void> {
    await this.sql.query(
      `insert into public.app_settings (key, value, updated_at) values ('youtube_requests', $1, $2)
       on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
      [JSON.stringify({ on }), at],
    );
  }

  async listYoutubeBlocks(): Promise<{ kind: 'video' | 'channel'; id: string; label: string; createdAt: string }[]> {
    const rows = await this.sql.query<{ kind: 'video' | 'channel'; id: string; label: string; created_at: Date }>(
      `select kind, id, label, created_at from public.youtube_blocks order by created_at desc limit 200`,
    );
    return rows.map((r) => ({ kind: r.kind, id: r.id, label: r.label, createdAt: new Date(r.created_at).toISOString() }));
  }

  async addYoutubeBlock(kind: 'video' | 'channel', id: string, label: string, at: Date): Promise<void> {
    await this.sql.query(
      `insert into public.youtube_blocks (kind, id, label, created_at) values ($1, $2, $3, $4) on conflict (kind, id) do update set label = excluded.label`,
      [kind, id, label.slice(0, 120), at],
    );
  }

  async removeYoutubeBlock(kind: 'video' | 'channel', id: string): Promise<void> {
    await this.sql.query(`delete from public.youtube_blocks where kind = $1 and id = $2`, [kind, id]);
  }

  /** 막힌 영상이나 채널이면 그 종류 */
  async youtubeBlocked(videoId: string, channelId: string | null): Promise<'video' | 'channel' | null> {
    const rows = await this.sql.query<{ kind: 'video' | 'channel' }>(
      `select kind from public.youtube_blocks where (kind = 'video' and id = $1) or (kind = 'channel' and id = $2)`,
      [videoId, channelId ?? ''],
    );
    return rows.some((r) => r.kind === 'video') ? 'video' : rows.length ? 'channel' : null;
  }

  // ───────── MBTI 마을 대항전 ─────────

  /** 대항전 점수를 더한다 (하루 상한까지). 실제로 더해진 점수 */
  addContestPoints(userId: string, district: string | null, kind: ContestKind, points: number, now: Date): Promise<number> {
    return addContestPoints(this.sql, userId, district, kind, points, now);
  }

  contestStandings(now: Date, week?: ContestWeek): Promise<ContestStandings> {
    return contestStandings(this.sql, now, week);
  }

  myContestPoints(userId: string, now: Date) {
    return myContestPoints(this.sql, userId, now);
  }

  /** 정해 둔 한 주 결과 */
  async getContestResult(week: string): Promise<{ winner: District | null; districts: ContestDistrictScore[] } | null> {
    const [r] = await this.sql.query<{ winner: District | null; districts: ContestDistrictScore[] | string }>(
      `select winner, districts from public.contest_results where week = $1`,
      [week],
    );
    if (!r) return null;
    return { winner: r.winner, districts: typeof r.districts === 'string' ? JSON.parse(r.districts) : r.districts };
  }

  /** 한 주 결과를 정한다. 처음 넣었으면 true (다른 요청이 먼저 넣었으면 false) */
  async insertContestResult(week: string, winner: District | null, districts: ContestDistrictScore[], at: Date): Promise<boolean> {
    const rows = await this.sql.query(
      `insert into public.contest_results (week, winner, districts, decided_at) values ($1, $2, $3, $4) on conflict do nothing returning week`,
      [week, winner, JSON.stringify(districts), at],
    );
    return rows.length > 0;
  }

  /** 운영자가 코인·이용권을 더하거나 뺀다 (0 밑으로는 내려가지 않는다). 새 값, 없는 주민이면 null */
  async adjustWallet(userId: string, coins: number): Promise<{ coins: number } | null> {
    const [r] = await this.sql.query<{ coins: number }>(
      `update public.profiles set coins = greatest(0, coins + $2) where id = $1 returning coins`,
      [userId, coins],
    );
    return r ? { coins: Number(r.coins) } : null;
  }

  /** 모자라지 않으면 코인을 쓴다. 새 잔액, 모자라면 null */
  async spendCoins(userId: string, n: number): Promise<number | null> {
    const [r] = await this.sql.query<{ coins: number }>(
      `update public.profiles set coins = coins - $2 where id = $1 and coins >= $2 returning coins`,
      [userId, n],
    );
    return r ? Number(r.coins) : null;
  }

  async listShops(): Promise<ShopRow[]> {
    const rows = await this.sql.query<ShopRow>(
      `select s.slot, s.owner_id, s.name, s.intro, s.color, p.display_name, p.handle
       from public.market_shops s join public.profiles p on p.id = s.owner_id order by s.slot`,
    );
    return rows.map((r) => ({ ...r, slot: Number(r.slot) }));
  }

  /** 빈 칸이고 그 사람에게 점포가 없으면 넣는다. 넣었으면 true */
  async insertShop(slot: number, ownerId: string, name: string, intro: string, color: string, at: Date): Promise<boolean> {
    const rows = await this.sql.query<{ slot: number }>(
      `insert into public.market_shops (slot, owner_id, name, intro, color, bought_at, updated_at) values ($1, $2, $3, $4, $5, $6, $6)
       on conflict do nothing returning slot`,
      [slot, ownerId, name, intro, color, at],
    );
    return rows.length > 0;
  }

  /** 내 점포의 이름·소개·색을 바꾼다. 내 점포가 없으면 false */
  async updateShop(ownerId: string, name: string, intro: string, color: string, at: Date): Promise<boolean> {
    const rows = await this.sql.query<{ slot: number }>(
      `update public.market_shops set name = $2, intro = $3, color = $4, updated_at = $5 where owner_id = $1 returning slot`,
      [ownerId, name, intro, color, at],
    );
    return rows.length > 0;
  }

  /** 점포를 비운다. 주인 id (빈 칸이었으면 null) */
  async deleteShop(slot: number): Promise<string | null> {
    const [r] = await this.sql.query<{ owner_id: string }>(`delete from public.market_shops where slot = $1 returning owner_id`, [slot]);
    return r?.owner_id ?? null;
  }

  async recordVisit(ownerId: string, visitorId: string, at: Date, day: string): Promise<void> {
    await this.sql.query(
      `insert into public.visits (owner_id, visitor_id, visited_on, last_at) values ($1, $2, $3, $4)
       on conflict (owner_id, visitor_id, visited_on) do update set last_at = excluded.last_at`,
      [ownerId, visitorId, day, at],
    );
  }

  async listVisitors(ownerId: string, since: Date, limit: number): Promise<(RoomCardRow & { last_at: Date })[]> {
    return this.sql.query(
      `select ${CARD_COLS}, max(v.last_at) as last_at
       from public.visits v join public.profiles p on p.id = v.visitor_id left join public.rooms r on r.user_id = p.id
       where v.owner_id = $1 and v.last_at >= $2
         and not exists (select 1 from public.blocks b where (b.blocker = $1 and b.blocked = p.id) or (b.blocker = p.id and b.blocked = $1))
       group by p.id, p.handle, p.display_name, p.bio, p.district, p.avatar, r.bgm
       order by max(v.last_at) desc limit $3`,
      [ownerId, since, limit],
    );
  }

  // ───────── 둘러보기 ─────────

  /** 마을 지도·중앙광장에 보일 공개 방 (발견을 켠 사람만, 차단 관계는 빼고) */
  async discoverable(viewerId: string | null, district: District | null, order: 'recent' | 'new', limit: number): Promise<RoomCardRow[]> {
    return this.sql.query<RoomCardRow>(
      `select ${CARD_COLS}
       from public.profiles p join public.rooms r on r.user_id = p.id
       where p.onboarded_at is not null and p.handle is not null
         and p.room_visibility = 'public' and p.discoverable
         and ($2::text is null or p.district = $2)
         and ($1::uuid is null or (p.id <> $1 and not exists (
           select 1 from public.blocks b where (b.blocker = $1 and b.blocked = p.id) or (b.blocker = p.id and b.blocked = $1))))
       order by ${order === 'new' ? 'p.onboarded_at' : 'greatest(r.updated_at, coalesce(p.last_seen_at, r.updated_at))'} desc
       limit $3`,
      [viewerId, district, limit],
    );
  }

  async districtCounts(): Promise<Partial<Record<District, number>>> {
    const rows = await this.sql.query<{ district: District; n: number }>(
      `select district, count(*)::int as n from public.profiles where onboarded_at is not null and district is not null group by district`,
    );
    return Object.fromEntries(rows.map((r) => [r.district, Number(r.n)]));
  }
}
