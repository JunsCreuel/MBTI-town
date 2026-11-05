// 클럽 유튜브 신청곡 확인: YouTube Data API v3로 영상이 틀 수 있는 음악인지 보고, 실시간 서버가 믿을 수 있게 서명한다.
// 키는 Vercel 환경 변수 YOUTUBE_API_KEY (없으면 유튜브 신청은 꺼진다). 재생은 화면에 보이는 유튜브 플레이어로만 한다.
import 'server-only';
import { YOUTUBE_MAX_SECONDS, youtubeIdOf, type YoutubeSong } from '@/shared/clubMusic';
import { youtubeTextProblem } from '@/shared/moderation';
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
  snippet?: { title?: string; categoryId?: string; liveBroadcastContent?: string; channelId?: string; channelTitle?: string };
  contentDetails?: { duration?: string; contentRating?: { ytRating?: string }; regionRestriction?: { allowed?: string[]; blocked?: string[] } };
  status?: { embeddable?: boolean; privacyStatus?: string };
}

/** 받는 카테고리: 음악(10)과 엔터테인먼트(24, 뮤직비디오가 여기로 올라오는 일이 많다) */
export const YOUTUBE_CATEGORIES = ['10', '24'];

/** 확인할 것: 공개(또는 일부 공개)·다른 곳에서 재생 허용·연령 제한 없음·라이브 아님·음악·엔터테인먼트 카테고리·우리나라에서 재생 가능·8분 이하 */
export function checkVideo(id: string, item: VideoItem | undefined): YoutubeSong {
  if (!item) throw new SceneError('not_found', '영상을 찾지 못했어요. 링크를 다시 확인해 주세요.');
  const sn = item.snippet ?? {};
  const cd = item.contentDetails ?? {};
  const st = item.status ?? {};
  if (st.privacyStatus !== 'public' && st.privacyStatus !== 'unlisted') throw new SceneError('bad_request', '공개된 영상만 신청할 수 있어요.');
  if (st.embeddable === false) throw new SceneError('bad_request', '이 영상은 다른 곳에서 틀 수 없게 막혀 있어요.');
  if (cd.contentRating?.ytRating === 'ytAgeRestricted') throw new SceneError('bad_request', '연령 제한 영상은 틀 수 없어요.');
  if (sn.liveBroadcastContent && sn.liveBroadcastContent !== 'none') throw new SceneError('bad_request', '라이브 방송은 틀 수 없어요.');
  if (!YOUTUBE_CATEGORIES.includes(sn.categoryId ?? '')) throw new SceneError('bad_request', '음악·엔터테인먼트 영상만 신청할 수 있어요.');
  const rr = cd.regionRestriction;
  if (rr?.blocked?.includes('KR') || (rr?.allowed && !rr.allowed.includes('KR'))) throw new SceneError('bad_request', '우리나라에서 볼 수 없는 영상이에요.');
  const bad = youtubeTextProblem(sn.title ?? '', sn.channelTitle ?? '');
  if (bad) throw new SceneError('bad_request', bad);
  const seconds = isoDurationSeconds(cd.duration ?? '');
  if (!seconds) throw new SceneError('bad_request', '영상 길이를 읽지 못했어요.');
  if (seconds > YOUTUBE_MAX_SECONDS) throw new SceneError('bad_request', `${YOUTUBE_MAX_SECONDS / 60}분 이하 곡만 신청할 수 있어요.`);
  const title = (sn.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || '유튜브 곡';
  return { id, title, seconds };
}

/** 운영자가 정한 제한 (켜고 끄기, 막은 영상·채널). 테스트에서는 가짜로 넣는다 */
export interface YoutubeLimits {
  on(): Promise<boolean>;
  blocked(videoId: string, channelId: string | null): Promise<'video' | 'channel' | null>;
}

const NO_LIMITS: YoutubeLimits = { on: async () => true, blocked: async () => null };

/** 같은 영상을 여러 사람이 신청해도 YouTube API를 한 번만 부르게 10분 기억한다 */
const VIDEO_CACHE_MS = 10 * 60_000;
const videoCache = new Map<string, { at: number; item: VideoItem | undefined }>();

/** 테스트용: 기억한 영상 정보를 비운다 */
export function clearVideoCache(): void {
  videoCache.clear();
}

/** 영상 정보 하나 (YouTube Data API v3). 키가 없거나 못 받으면 오류 */
export async function fetchVideo(id: string): Promise<VideoItem | undefined> {
  const hit = videoCache.get(id);
  if (hit && Date.now() - hit.at < VIDEO_CACHE_MS) return hit.item;
  const item = await fetchVideoFresh(id);
  if (videoCache.size > 500) videoCache.delete(videoCache.keys().next().value!);
  videoCache.set(id, { at: Date.now(), item });
  return item;
}

async function fetchVideoFresh(id: string): Promise<VideoItem | undefined> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new SceneError('conflict', '유튜브 신청은 준비 중이에요. (운영자가 YouTube API 키를 넣으면 열려요)');
  const api = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${id}&key=${encodeURIComponent(key)}`;
  const res = await fetch(api, { signal: AbortSignal.timeout(6000) }).catch(() => null);
  if (!res?.ok) throw new SceneError('conflict', '유튜브에서 영상을 확인하지 못했어요. 잠시 뒤에 다시 해 주세요.');
  const data = (await res.json()) as { items?: VideoItem[] };
  return data.items?.[0];
}

export async function lookupYoutube(url: unknown, now = Date.now(), limits: YoutubeLimits = NO_LIMITS): Promise<YoutubeTicket> {
  if (!process.env.YOUTUBE_API_KEY) throw new SceneError('conflict', '유튜브 신청은 준비 중이에요. (운영자가 YouTube API 키를 넣으면 열려요)');
  if (!(await limits.on())) throw new SceneError('conflict', '지금은 유튜브 신청을 쉬고 있어요. 목록 곡을 신청해 주세요.');
  const id = typeof url === 'string' ? youtubeIdOf(url) : null;
  if (!id) throw new SceneError('bad_request', '유튜브 영상 링크를 넣어 주세요.');
  const item = await fetchVideo(id);
  const blocked = await limits.blocked(id, item?.snippet?.channelId ?? null);
  if (blocked) throw new SceneError('bad_request', blocked === 'video' ? '운영자가 막아 둔 영상이에요.' : '운영자가 막아 둔 채널의 영상이에요.');
  const song = checkVideo(id, item);
  const exp = now + TICKET_MS;
  return { song, exp, sig: signYoutube(song, exp) };
}
