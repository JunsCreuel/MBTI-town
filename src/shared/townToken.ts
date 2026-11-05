// 실시간 마을 서버 입장 토큰. 웹 서버(Next)가 로그인한 사람에게 발급하고 실시간 서버가 확인한다.
// 두 서버가 같은 비밀값(TOWN_TOKEN_SECRET)을 쓴다. 토큰에는 마을에서 보여 줄 것만 담는다 (계정 id는 담지 않는다).
// node:crypto를 쓰므로 서버에서만 불러온다.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cleanAvatar, type AccessoryId, type AvatarBody, type AvatarColor, type HairColor, type SkinTone } from './avatar';
import { isDistrict, type District } from './districts';

export interface TownPass {
  /** 마을 안에서 쓰는 사람 번호. 계정 id에서 만들지만 거꾸로 알아낼 수 없다. 손님은 매번 새로 만든다. */
  pid: string;
  /** 이름표 */
  name: string;
  /** 방 주소. 방을 찾아갈 수 있게 한 사람만 (공개 + 발견 켜기) */
  handle: string;
  /** 사는 지역 (손님은 '') */
  district: District | '';
  /** 집이 있는 동네 번호 (1 = 본섬 1동, 2부터 = 새로 열린 동네) */
  hood: number;
  /** 집터 번호 (집이 없으면 -1) */
  lot: number;
  /** 캐릭터 몸 (남자·여자) */
  body: AvatarBody;
  color: AvatarColor;
  acc: AccessoryId;
  /** 피부색·머리 색 (natural = 모델 원래 색) */
  skin: SkinTone;
  hair: HairColor;
  /** 만료 (유닉스 초) */
  exp: number;
  /**
   * 들어갈 수 있는 집 (집 주인의 pid). 웹 서버가 방을 볼 수 있는 사람(공개 범위·차단 검사)에게만 담아 준다.
   * 실시간 서버의 집 방은 이 값이 있는 토큰만 받는다. 마을 토큰에는 없다.
   */
  house?: string;
  /** 이름표에 보이는 MBTI (= 사는 마을) */
  mbti?: string;
  /** 계정에 저장된, 데리고 다니는 펫 (pets.ts의 id). 없으면 빠진다 */
  pet?: string;
  /** 펫마다 지어 준 이름 (마을 펫 시트에 보인다). 없으면 빠진다 */
  petNames?: Partial<Record<string, string>>;
  /** 운영자 (클럽 곡 넘기기·신청곡 빼기를 할 수 있다). 운영자만 담긴다 */
  admin?: true;
}

const DEV_SECRET = 'scene-dev-town-secret';

/**
 * 토큰 비밀값. 개발용 값은 저장소에 적혀 있어 누구나 운영자 토큰을 만들 수 있으므로, 내 컴퓨터에서만 쓴다:
 * 운영 모드이거나 배포 환경(Render·Vercel)이면 비밀값이 없을 때 토큰을 하나도 만들거나 받지 않는다
 */
function secret(): string {
  const s = process.env.TOWN_TOKEN_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production' || process.env.RENDER || process.env.VERCEL) throw new Error('TOWN_TOKEN_SECRET이 없습니다');
  return DEV_SECRET;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const sign = (body: string) => createHmac('sha256', secret()).update(`town:${body}`).digest();

/** 계정 id → 마을 사람 번호 (같은 비밀값을 쓰는 두 서버에서 같다) */
export function townPid(userId: string): string {
  return createHmac('sha256', secret()).update(`pid:${userId}`).digest('base64url').slice(0, 16);
}

export function guestPid(): string {
  return `g${randomBytes(9).toString('base64url')}`;
}

export function signTownPass(pass: TownPass): string {
  const body = b64(JSON.stringify(pass));
  return `${body}.${b64(sign(body))}`;
}

/** 토큰이 맞고 아직 유효하면 내용을, 아니면 null */
export function verifyTownPass(token: unknown, nowSec = Math.floor(Date.now() / 1000)): TownPass | null {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const [body, mac, extra] = token.split('.');
  if (!body || !mac || extra !== undefined) return null;
  const expected = sign(body);
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let raw: Partial<TownPass>;
  try {
    raw = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof raw.exp !== 'number' || raw.exp < nowSec) return null;
  if (typeof raw.pid !== 'string' || !raw.pid || typeof raw.name !== 'string') return null;
  const avatar = cleanAvatar({ body: raw.body, color: raw.color, skin: raw.skin, hair: raw.hair, accessory: raw.acc, pet: raw.pet, petNames: raw.petNames });
  return {
    pid: raw.pid.slice(0, 32),
    name: raw.name.slice(0, 40),
    handle: typeof raw.handle === 'string' ? raw.handle.slice(0, 20) : '',
    district: isDistrict(raw.district) ? raw.district : '',
    hood: Number.isInteger(raw.hood) && (raw.hood as number) >= 1 ? (raw.hood as number) : 1,
    lot: Number.isInteger(raw.lot) && (raw.lot as number) >= 0 ? (raw.lot as number) : -1,
    body: avatar.body,
    color: avatar.color,
    acc: avatar.accessory,
    skin: avatar.skin,
    hair: avatar.hair,
    exp: raw.exp,
    ...(typeof raw.house === 'string' && raw.house ? { house: raw.house.slice(0, 32) } : {}),
    ...(typeof raw.mbti === 'string' && /^[EI][SN][TF][JP]$/.test(raw.mbti) ? { mbti: raw.mbti } : {}),
    ...(avatar.pet ? { pet: avatar.pet } : {}),
    ...(Object.keys(avatar.petNames).length ? { petNames: avatar.petNames } : {}),
    ...(raw.admin === true ? { admin: true as const } : {}),
  };
}

// ───────────────────────── 서버 전체 공지 서명 ─────────────────────────

/** 공지 서명이 유효한 시간 (두 서버 시계가 조금 달라도 되게) */
export const ANNOUNCE_TTL_MS = 60_000;

const announceSig = (body: string, ts: number) => createHmac('sha256', secret()).update(`announce:${ts}:${body}`).digest();

/** 웹 서버가 실시간 서버에 공지를 보낼 때 붙이는 서명. body = announcementBody(공지) */
export function signAnnouncement(body: string, ts: number): string {
  return b64(announceSig(body, ts));
}

export function verifyAnnouncement(body: string, ts: unknown, sig: unknown, now = Date.now()): boolean {
  if (typeof ts !== 'number' || !Number.isFinite(ts) || typeof sig !== 'string') return false;
  if (Math.abs(now - ts) > ANNOUNCE_TTL_MS) return false;
  const want = announceSig(body, ts);
  const got = Buffer.from(sig, 'base64url');
  return got.length === want.length && timingSafeEqual(got, want);
}

// ───────────────────────── 클럽 유튜브 신청곡 서명 ─────────────────────────

/** 웹 서버가 YouTube Data API로 확인한 영상만 실시간 서버가 받는다 (exp = 이 시각(ms)까지 유효) */
const ytSig = (song: { id: string; title: string; seconds: number }, exp: number) =>
  createHmac('sha256', secret()).update(`yt:${exp}:${song.id}:${song.seconds}:${song.title}`).digest();

export function signYoutube(song: { id: string; title: string; seconds: number }, exp: number): string {
  return b64(ytSig(song, exp));
}

export function verifyYoutube(song: { id: string; title: string; seconds: number }, exp: unknown, sig: unknown, now = Date.now()): boolean {
  if (typeof exp !== 'number' || !Number.isFinite(exp) || exp < now || typeof sig !== 'string') return false;
  const want = ytSig(song, exp);
  const got = Buffer.from(sig, 'base64url');
  return got.length === want.length && timingSafeEqual(got, want);
}
