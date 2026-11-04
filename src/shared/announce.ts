// 서버 전체 공지: 마을·동네·놀이터·집 안 등 실시간 서버에 접속한 모두에게 위쪽 띠로 보인다.
// 웹 서버(Vercel)가 실시간 서버(Render)에 비밀값(TOWN_TOKEN_SECRET)으로 서명해 보내고,
// 실시간 서버는 서명을 확인한 뒤 모든 방에 퍼뜨린다 (src/shared/townToken.ts, server/announce.ts).
// 글은 실시간 서버가 종류와 이름으로 만든다 (서명 없는 글은 받지 않는다).
import { socialConfig } from '../config/game';

export type Announcement =
  /** 누군가 황금 고래를 낚았다 */
  | { kind: 'golden_whale'; name: string }
  /** 운영자 공지 */
  | { kind: 'notice'; text: string };

/** 방에서 화면으로 보내는 공지 (MSG.announce) */
export interface AnnounceBroadcast {
  kind: Announcement['kind'];
  text: string;
  /** 보낸 시각 (ms) */
  at: number;
}

/** 운영자 공지 글자 수 */
export const NOTICE_MAX = 100;

/** 서명할 때 쓰는 내용 (종류 + 이름·글) */
export const announcementBody = (a: Announcement) => `${a.kind}:${a.kind === 'golden_whale' ? a.name : a.text}`;

export function announcementText(a: Announcement): string {
  if (a.kind === 'golden_whale') return `(공지) ${a.name}님이 황금 고래를 낚았습니다!`;
  return `(공지) ${a.text}`;
}

/** 받은 값을 공지로 읽는다 (모양이 틀리면 null) */
export function parseAnnouncement(v: unknown): Announcement | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '');
  if (o.kind === 'golden_whale') {
    const name = clean(o.name, socialConfig.displayNameMax);
    return name ? { kind: 'golden_whale', name } : null;
  }
  if (o.kind === 'notice') {
    const text = clean(o.text, NOTICE_MAX);
    return text ? { kind: 'notice', text } : null;
  }
  return null;
}
