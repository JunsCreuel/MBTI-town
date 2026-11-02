// 실시간 마을 서버 입장 토큰. 웹 서버(Next)가 로그인한 사람에게 발급하고 실시간 서버가 확인한다.
// 두 서버가 같은 비밀값(TOWN_TOKEN_SECRET)을 쓴다. 토큰에는 마을에서 보여 줄 것만 담는다 (계정 id는 담지 않는다).
// node:crypto를 쓰므로 서버에서만 불러온다.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cleanAvatar, type AccessoryId, type AvatarColor } from './avatar';
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
  /** 집터 번호 (집이 없으면 -1) */
  lot: number;
  color: AvatarColor;
  acc: AccessoryId;
  /** 만료 (유닉스 초) */
  exp: number;
}

const DEV_SECRET = 'scene-dev-town-secret';

function secret(): string {
  const s = process.env.TOWN_TOKEN_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('TOWN_TOKEN_SECRET이 없습니다');
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
  const avatar = cleanAvatar({ color: raw.color, accessory: raw.acc });
  return {
    pid: raw.pid.slice(0, 32),
    name: raw.name.slice(0, 40),
    handle: typeof raw.handle === 'string' ? raw.handle.slice(0, 20) : '',
    district: isDistrict(raw.district) ? raw.district : '',
    lot: Number.isInteger(raw.lot) && (raw.lot as number) >= 0 ? (raw.lot as number) : -1,
    color: avatar.color,
    acc: avatar.accessory,
    exp: raw.exp,
  };
}
