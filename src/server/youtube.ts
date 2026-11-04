// 클럽 유튜브 신청곡 확인: YouTube Data API v3로 영상이 틀 수 있는 음악인지 보고, 실시간 서버가 믿을 수 있게 서명한다.
// 키는 Vercel 환경 변수 YOUTUBE_API_KEY (없으면 유튜브 신청은 꺼진다). 재생은 화면에 보이는 유튜브 플레이어로만 한다.
import 'server-only';
import { YOUTUBE_MAX_SECONDS, youtubeIdOf, type YoutubeSong } from '@/shared/clubMusic';
import { signYoutube } from '@/shared/townToken';
import { SceneError } from './scene/service';

/** 서명이 유효한 시간 (받은 뒤 이 안에 신청해야 한다) */
const TICKET_MS = 10 * 60_000;

export interface YoutubeTicket {
  song: YoutubeSong;
  exp: number;
  sig: string;
}

/** PT1H2M3S → 초 */
export function isoDurationSeconds(v: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(v);
  if (!m) return 0;
  const [, d, h, mi, s] = m.map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + mi * 60 + s;
}

interface VideoItem {
  snippet?: { title?: string; categoryId?: string; liveBroadcastContent?: string };
  contentDetails?: { duration?: string; contentRating?: { ytRating?: string }; regionRestriction?: { allowed?: string[]; blocked?: string[] } };
  status?: { embeddable?: boolean; privacyStatus?: string };
}

/** 확인할 것: 공개(또는 일부 공개)·다른 곳에서 재생 허용·연령 제한 없음·라이브 아님·음악 카테고리·우리나라에서 재생 가능·8분 이하 */
export function checkVideo(id: string, item: VideoItem | undefined): YoutubeSong {
  if (!item) throw new SceneError('not_found', '영상을 찾지 못했어요. 링크를 다시 확인해 주세요.');
  const sn = item.snippet ?? {};
  const cd = item.contentDetails ?? {};
  const st = item.status ?? {};
  if (st.privacyStatus !== 'public' && st.privacyStatus !== 'unlisted') throw new SceneError('bad_request', '공개된 영상만 신청할 수 있어요.');
  if (st.embeddable === false) throw new SceneError('bad_request', '이 영상은 다른 곳에서 틀 수 없게 막혀 있어요.');
  if (cd.contentRating?.ytRating === 'ytAgeRestricted') throw new SceneError('bad_request', '연령 제한 영상은 틀 수 없어요.');
  if (sn.liveBroadcastContent && sn.liveBroadcastContent !== 'none') throw new SceneError('bad_request', '라이브 방송은 틀 수 없어요.');
  if (sn.categoryId !== '10') throw new SceneError('bad_request', '음악 영상만 신청할 수 있어요.');
  const rr = cd.regionRestriction;
  if (rr?.blocked?.includes('KR') || (rr?.allowed && !rr.allowed.includes('KR'))) throw new SceneError('bad_request', '우리나라에서 볼 수 없는 영상이에요.');
  const seconds = isoDurationSeconds(cd.duration ?? '');
  if (!seconds) throw new SceneError('bad_request', '영상 길이를 읽지 못했어요.');
  if (seconds > YOUTUBE_MAX_SECONDS) throw new SceneError('bad_request', `${YOUTUBE_MAX_SECONDS / 60}분 이하 곡만 신청할 수 있어요.`);
  const title = (sn.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || '유튜브 곡';
  return { id, title, seconds };
}

export async function lookupYoutube(url: unknown, now = Date.now()): Promise<YoutubeTicket> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new SceneError('conflict', '유튜브 신청은 준비 중이에요. (운영자가 YouTube API 키를 넣으면 열려요)');
  const id = typeof url === 'string' ? youtubeIdOf(url) : null;
  if (!id) throw new SceneError('bad_request', '유튜브 영상 링크를 넣어 주세요.');
  const api = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${id}&key=${encodeURIComponent(key)}`;
  const res = await fetch(api, { signal: AbortSignal.timeout(6000) }).catch(() => null);
  if (!res?.ok) throw new SceneError('conflict', '유튜브에서 영상을 확인하지 못했어요. 잠시 뒤에 다시 해 주세요.');
  const data = (await res.json()) as { items?: VideoItem[] };
  const song = checkVideo(id, data.items?.[0]);
  const exp = now + TICKET_MS;
  return { song, exp, sig: signYoutube(song, exp) };
}
