// 클럽 음악: 누구나 자유롭게 쓸 수 있는 CC0(퍼블릭 도메인) EDM 곡과 운영자가 직접 만들어 준 곡 (PROJECT_GUIDE.md 7장).
// 출처와 라이선스는 public/assets/LICENSES.md에도 적는다. 파일은 scripts/import-music.ts가 만든다.
//
// 클럽에 있는 사람은 모두 같은 순간에 같은 곡의 같은 자리를 듣는다:
// 시계(UTC)를 플레이리스트 전체 길이로 나눈 나머지로 지금 곡과 위치를 정한다 (서버 없이도 맞는다).
// 곡은 뒤에만 더한다 (DJ 신청곡은 번호로 주고받는다).
import { PROVIDED_BY_OWNER, type MusicLicense, type MusicTrack } from './music';

export type ClubTrack = MusicTrack;

const track = (id: string, title: string, artist: string, mood: string, tempo: number, source: string, license: MusicLicense = 'CC0 1.0'): ClubTrack => ({
  id,
  tempo,
  key: `bgm.club.${id}`,
  file: `club_${id}`,
  title,
  artist,
  mood,
  source,
  license,
});

export const CLUB_TRACKS: readonly ClubTrack[] = [
  track('party_sector', 'Party Sector', 'Joth', '우주 느낌 댄스', 120, 'https://opengameart.org/content/party-sector'),
  track('funky_house', 'Funky House', 'Of Far Different Nature', '여름 해변 하우스', 128, 'https://opengameart.org/content/funky-house'),
  track('hella_bumps', 'Hella Bumps', 'The Cynic Project', '신나는 댄스 하우스', 123, 'https://opengameart.org/content/hella-bumps-menu-music'),
  track('lucid_trigger', 'Lucid Trigger', 'Liq_mmry', '프로그레시브 브레이크', 150, 'https://opengameart.org/content/lucid-trigger'),
  track('pan_bakkwo', '판을 바꿔', 'zansang', '한계를 넘는 K-댄스', 137, PROVIDED_BY_OWNER, '제공자 보유'),
  track('kick_and_bass', 'Kick and Bass Only', 'zansang', '킥과 베이스만 남긴 테크노', 134, PROVIDED_BY_OWNER, '제공자 보유'),
];

/**
 * 지금 나올 곡과 위치. seconds = 곡마다 길이(초, CLUB_TRACKS 순서). 길이를 모르면(0) 그 곡은 건너뛴다.
 * 돌려주는 값: 곡 번호, 곡 안의 위치(초), 그 곡이 끝나기까지 남은 시간(초)
 */
export function clubScheduleAt(epochMs: number, seconds: readonly number[]): { index: number; offset: number; left: number } | null {
  const total = seconds.reduce((s, x) => s + (x > 0 ? x : 0), 0);
  if (total <= 0) return null;
  let t = ((epochMs / 1000) % total + total) % total;
  for (let i = 0; i < seconds.length; i++) {
    const len = seconds[i] > 0 ? seconds[i] : 0;
    if (t < len) return { index: i, offset: t, left: len - t };
    t -= len;
  }
  // 소수점 오차로 끝에 닿으면 첫 곡 처음
  const first = seconds.findIndex((x) => x > 0);
  return { index: first, offset: 0, left: seconds[first] };
}

// ───────────────────────── 신청곡 대기열 ─────────────────────────

/** 신청곡 하나. who = 신청한 사람의 접속 번호 (한 사람이 몇 곡 기다리는지 센다) */
export interface ClubQueueItem {
  index: number;
  by: string;
  who: string;
}

/**
 * 클럽 채널의 곡 흐름: 지금 곡(index, startedAt, by) → 신청곡 대기열(차례대로) → 그 뒤로는 목록 순서로 이어 간다.
 * 지금 나오는 곡은 끝까지 틀고, 신청곡은 그 뒤에 나온다. 서버와 화면이 같은 계산을 해서 같은 곡의 같은 자리를 듣는다.
 */
export interface ClubLine {
  index: number;
  /** 지금 곡을 시작한 시각 (서버 시계, ms) */
  startedAt: number;
  /** 지금 곡을 신청한 사람 ('' = 목록 순서) */
  by: string;
  queue: ClubQueueItem[];
}

const lenOf = (seconds: readonly number[], i: number) => (seconds[i] > 0 ? seconds[i] : 0);

/**
 * nowMs에 맞게 흐름을 앞으로 당긴다: 끝난 곡은 버리고 다음 신청곡(없으면 목록의 다음 곡)을 지금 곡으로 올린다.
 * 돌려준 흐름의 startedAt은 지금 곡의 시작 시각이다.
 */
export function advanceLine(line: ClubLine, nowMs: number, seconds: readonly number[]): ClubLine {
  const n = seconds.length;
  if (!n || seconds.every((s) => !(s > 0))) return line;
  let { index, startedAt, by } = line;
  const queue = [...line.queue];
  // 신청곡이 남아 있는 동안은 하나씩, 다 틀면 목록 순서로 (오래 비어 있으면 한 바퀴씩 건너뛴다)
  const total = seconds.reduce((s, x) => s + (x > 0 ? x : 0), 0) * 1000;
  for (let guard = 0; guard < 10_000; guard++) {
    const len = lenOf(seconds, index) * 1000;
    if (len > 0 && nowMs < startedAt + len) break;
    startedAt += len;
    const next = queue.shift();
    if (next) {
      index = next.index;
      by = next.by;
    } else {
      if (nowMs - startedAt > total) startedAt += Math.floor((nowMs - startedAt) / total) * total;
      index = (index + 1) % n;
      by = '';
    }
  }
  return { index, startedAt, by, queue };
}

/** 흐름에서 지금 곡·위치(초)·남은 시간(초)·신청한 사람 */
export function clubLineAt(line: ClubLine, nowMs: number, seconds: readonly number[]): { index: number; offset: number; left: number; by: string } | null {
  if (!seconds.length || line.index < 0 || line.index >= seconds.length) return null;
  const a = advanceLine(line, nowMs, seconds);
  const len = lenOf(seconds, a.index);
  if (!len) return null;
  const offset = Math.max(0, (nowMs - a.startedAt) / 1000);
  return { index: a.index, offset, left: Math.max(0, len - offset), by: a.by };
}

/** 신청곡이 없을 때(시계 순서) 지금 곡으로 흐름을 하나 만든다 */
export function lineFromClock(nowMs: number, seconds: readonly number[]): ClubLine | null {
  const s = clubScheduleAt(nowMs, seconds);
  return s ? { index: s.index, startedAt: nowMs - s.offset * 1000, by: '', queue: [] } : null;
}
