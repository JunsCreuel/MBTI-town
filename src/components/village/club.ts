// 실내 클럽: 맵 판별, 지금 흐르는 곡과 박자. 음악 플레이어(ClubMusic)가 오디오를 알려 주고, 무대 조명(ClubFx)이 박자를 읽는다.
import { asset } from '@/assets/manifest';
import { CLUB_TRACKS, advanceLine, clubLineAt, clubScheduleAt, type ClubLine, type ClubQueueItem, type YoutubeSong } from '@/shared/clubMusic';
import type { MusicResult, MusicState } from '@/shared/protocol';
import type { TownMap } from '@/shared/townMap';

/** 벽으로 둘러싼 실내 맵인지 (하늘·바다·구름 대신 어둠을 그린다) */
export const isIndoor = (map: TownMap) => map.props.some((p) => p.key === 'prop.club.wall');

const lengths = () => CLUB_TRACKS.map((t) => asset(t.key).seconds ?? 0);

/**
 * 클럽 채널의 곡 흐름 (서버가 정한다: 지금 곡 → 신청곡 대기열 → 목록 순서). 신청곡이 한 번도 없었으면 null (시계 순서).
 * offset = 서버 시계 - 내 시계 (서버 시각을 내 시계로 옮길 때 쓴다). version = 흐름이 바뀔 때마다 1씩
 */
export const clubDj: { line: ClubLine | null; offset: number; version: number } = { line: null, offset: 0, version: 0 };
const djListeners = new Set<() => void>();

export function setClubDj(m: MusicState | null) {
  clubDj.line = m ? { index: m.index, ...(m.yt ? { yt: m.yt } : {}), startedAt: m.startedAt, by: m.by, queue: m.queue ?? [], after: m.after } : null;
  clubDj.offset = m ? m.serverNow - Date.now() : 0;
  clubDj.version++;
  djListeners.forEach((fn) => fn());
}

export function onClubDj(fn: () => void): () => void {
  djListeners.add(fn);
  return () => void djListeners.delete(fn);
}

/** 곡 이름 (목록 곡 또는 유튜브) */
export const songTitle = (s: { index: number; yt?: YoutubeSong }) => (s.yt ? s.yt.title : (CLUB_TRACKS[s.index]?.title ?? ''));

/** 지금 곡·위치·신청한 사람: 흐름이 있으면 그 계산, 없으면 시계로 정한 순서 (클럽에 있는 사람 모두 같다). 유튜브면 yt */
export function clubSchedule(nowMs = Date.now()): { index: number; yt?: YoutubeSong; offset: number; left: number; by: string } | null {
  if (clubDj.line) return clubLineAt(clubDj.line, nowMs + clubDj.offset, lengths());
  const s = clubScheduleAt(nowMs, lengths());
  return s && { ...s, by: '' };
}

/** 아직 나오지 않은 신청곡 (차례대로) */
export function clubQueue(nowMs = Date.now()): ClubQueueItem[] {
  return clubDj.line ? advanceLine(clubDj.line, nowMs + clubDj.offset, lengths()).queue : [];
}

/** 다음에 나올 곡 (신청곡이 있으면 첫 신청곡, 없으면 목록의 다음 곡) */
export function clubNext(nowMs = Date.now()): { index: number; yt?: YoutubeSong; by: string } | null {
  const n = CLUB_TRACKS.length;
  if (clubDj.line) {
    const a = advanceLine(clubDj.line, nowMs + clubDj.offset, lengths());
    const q = a.queue[0];
    return q ? { index: q.index, ...(q.yt ? { yt: q.yt } : {}), by: q.by } : { index: (a.after ?? 0) % n, by: '' };
  }
  const s = clubScheduleAt(nowMs, lengths());
  return s && { index: (s.index + 1) % n, by: '' };
}

/** 곡을 가리키는 이름 (같은 곡인지 견줄 때) */
export const songKey = (s: { index: number; yt?: YoutubeSong }) => (s.yt ? `yt:${s.yt.id}` : `i:${s.index}`);

/** 내가 보낸 신청이 어떻게 됐는지 (서버가 신청한 사람에게만 알려 준다) */
const resultListeners = new Set<(r: MusicResult) => void>();
export function emitClubResult(r: MusicResult) {
  resultListeners.forEach((fn) => fn(r));
}
export function onClubResult(fn: (r: MusicResult) => void): () => void {
  resultListeners.add(fn);
  return () => void resultListeners.delete(fn);
}

/** 지금 소리가 나는 오디오와 그 곡 번호 (음악을 끄면 비운다) */
export const clubAudio: { el: HTMLAudioElement | null; index: number } = { el: null, index: -1 };

/**
 * 지금 박자. 음악이 나오면 오디오의 실제 위치로, 아니면 시계로 정한 위치로 잰다 (음악을 꺼도 조명은 같은 박자로 움직인다).
 * step: 지금까지 몇 번째 박인지 (조명 무늬를 한 칸씩 넘긴다), level: 박이 떨어진 순간 1에서 다음 박까지 0으로 준다
 */
export function clubPulse(nowMs = Date.now()): { step: number; level: number } | null {
  let index: number;
  let pos: number;
  const a = clubAudio.el;
  if (a && !a.paused && clubAudio.index >= 0 && !clubSchedule(nowMs)?.yt) {
    index = clubAudio.index;
    pos = a.currentTime;
  } else {
    const s = clubSchedule(nowMs);
    if (!s) return null;
    index = s.index;
    pos = s.offset;
  }
  // 유튜브 곡은 박자를 모르니 120 BPM으로 깜빡인다
  const e = index >= 0 ? asset(CLUB_TRACKS[index].key) : { bpm: 120, beat: 0 };
  const beats = ((pos - (e.beat ?? 0)) * (e.bpm ?? 120)) / 60;
  const whole = Math.floor(beats);
  return { step: whole + Math.max(0, index) * 7, level: (1 - (beats - whole)) ** 2.4 };
}

/** 음수에도 쓰는 나머지 */
export const mod = (a: number, n: number) => ((a % n) + n) % n;

/** 바텐더가 마지막으로 술을 내준 시각 (now 기준). 바텐더가 건배하는 동작에 쓴다 */
export const clubBar = { servedAt: -100 };
