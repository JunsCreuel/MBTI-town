// 웹 서버 → 실시간 서버: 서버 전체 공지를 서명해서 보낸다 (server/announce.ts가 받아 모든 방에 퍼뜨린다).
// 실시간 서버 주소는 REALTIME_URL (없으면 화면이 쓰는 NEXT_PUBLIC_REALTIME_URL). ws(s):// 주소면 http(s)://로 바꾼다.
// 실시간 서버가 잠들어 있거나 늦으면 기다리지 않고 넘어간다 (그때는 접속한 사람이 없어 들을 사람도 없다).
import 'server-only';
import { announcementBody, type Announcement } from '@/shared/announce';
import { signAnnouncement } from '@/shared/townToken';

const TIMEOUT_MS = 4000;

function realtimeHttpUrl(): string | null {
  const raw = process.env.REALTIME_URL || process.env.NEXT_PUBLIC_REALTIME_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:2567');
  if (!raw) return null;
  return raw.replace(/^ws(s?):\/\//, 'http$1://').replace(/\/+$/, '');
}

/** 보냈으면 true. 실패해도 오류를 내지 않는다 (공지 때문에 낚시가 실패하면 안 된다) */
export async function announceToTown(a: Announcement): Promise<boolean> {
  const url = realtimeHttpUrl();
  if (!url) return false;
  try {
    const ts = Date.now();
    const res = await fetch(`${url}/scene/announce`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...a, ts, sig: signAnnouncement(announcementBody(a), ts) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}
