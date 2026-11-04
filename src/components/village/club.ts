// 실내 클럽: 맵 판별, 지금 흐르는 곡과 박자. 음악 플레이어(ClubMusic)가 오디오를 알려 주고, 무대 조명(ClubFx)이 박자를 읽는다.
import { asset } from '@/assets/manifest';
import { CLUB_TRACKS, advanceLine, clubLineAt, clubScheduleAt, type ClubLine, type ClubQueueItem } from '@/shared/clubMusic';
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
  clubDj.line = m ? { index: m.index, startedAt: m.startedAt, by: m.by, queue: m.queue ?? [] } : null;
  clubDj.offset = m ? m.serverNow - Date.now() : 0;
  clubDj.version++;
  djListeners.forEach((fn) => fn());
}

export function onClubDj(fn: () => void): () => void {
  djListeners.add(fn);
  return () => void djListeners.delete(fn);
}

/** 지금 곡·위치·신청한 사람: 흐름이 있으면 그 계산, 없으면 시계로 정한 순서 (클럽에 있는 사람 모두 같다) */
export function clubSchedule(nowMs = Date.now()): { index: number; offset: number; left: number; by: string } | null {
  if (clubDj.line) return clubLineAt(clubDj.line, nowMs + clubDj.offset, lengths());
  const s = clubScheduleAt(nowMs, lengths());
  return s && { ...s, by: '' };
}

/** 아직 나오지 않은 신청곡 (차례대로) */
export function clubQueue(nowMs = Date.now()): ClubQueueItem[] {
  return clubDj.line ? advanceLine(clubDj.line, nowMs + clubDj.offset, lengths()).queue : [];
}

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
  if (a && !a.paused && clubAudio.index >= 0) {
    index = clubAudio.index;
    pos = a.currentTime;
  } else {
    const s = clubSchedule(nowMs);
    if (!s) return null;
    index = s.index;
    pos = s.offset;
  }
  const e = asset(CLUB_TRACKS[index].key);
  const beats = ((pos - (e.beat ?? 0)) * (e.bpm ?? 120)) / 60;
  const whole = Math.floor(beats);
  return { step: whole + index * 7, level: (1 - (beats - whole)) ** 2.4 };
}

/** 음수에도 쓰는 나머지 */
export const mod = (a: number, n: number) => ((a % n) + n) % n;

/** 바텐더가 마지막으로 술을 내준 시각 (now 기준). 바텐더가 건배하는 동작에 쓴다 */
export const clubBar = { servedAt: -100 };

