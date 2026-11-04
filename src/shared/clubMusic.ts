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

/** 유튜브 신청곡 (웹 서버가 YouTube Data API로 확인하고 서명한 것만 받는다) */
export interface YoutubeSong {
  id: string;
  title: string;
  seconds: number;
}

/** 신청곡 하나. index = 목록 곡 번호 (유튜브면 -1), who = 신청한 사람의 접속 번호 (한 사람이 몇 곡 기다리는지 센다) */
export interface ClubQueueItem {
  index: number;
  by: string;
  who: string;
  yt?: YoutubeSong;
}

/**
 * 클럽 채널의 곡 흐름: 지금 곡(index 또는 yt, startedAt, by) → 신청곡 대기열(차례대로) → 그 뒤로는 목록 순서로 이어 간다.
 * 지금 나오는 곡은 끝까지 틀고, 신청곡은 그 뒤에 나온다. 서버와 화면이 같은 계산을 해서 같은 곡의 같은 자리를 듣는다.
 */
export interface ClubLine {
  /** 목록 곡 번호 (유튜브면 -1) */
  index: number;
  yt?: YoutubeSong;
  /** 지금 곡을 시작한 시각 (서버 시계, ms) */
  startedAt: number;
  /** 지금 곡을 신청한 사람 ('' = 목록 순서) */
  by: string;
  queue: ClubQueueItem[];
  /** 대기열이 다 끝나면 이어서 틀 목록 곡 번호 (마지막 목록 곡 다음) */
  after?: number;
}

const lenOf = (seconds: readonly number[], i: number) => (seconds[i] > 0 ? seconds[i] : 0);

/**
 * nowMs에 맞게 흐름을 앞으로 당긴다: 끝난 곡은 버리고 다음 신청곡(없으면 목록의 다음 곡)을 지금 곡으로 올린다.
 * 돌려준 흐름의 startedAt은 지금 곡의 시작 시각이다.
 */
export function advanceLine(line: ClubLine, nowMs: number, seconds: readonly number[]): ClubLine {
  const n = seconds.length;
  if (!n || seconds.every((s) => !(s > 0))) return line;
  let { index, startedAt, by, yt } = line;
  let after = line.after ?? (index >= 0 ? (index + 1) % n : 0);
  const queue = [...line.queue];
  const songLen = () => (yt ? yt.seconds : lenOf(seconds, index));
  // 신청곡이 남아 있는 동안은 하나씩, 다 틀면 목록 순서로 (오래 비어 있으면 한 바퀴씩 건너뛴다)
  const total = seconds.reduce((s, x) => s + (x > 0 ? x : 0), 0) * 1000;
  for (let guard = 0; guard < 10_000; guard++) {
    const len = songLen() * 1000;
    if (len > 0 && nowMs < startedAt + len) break;
    startedAt += len;
    const next = queue.shift();
    if (next) {
      index = next.index;
      yt = next.yt;
      by = next.by;
      if (!yt) after = (index + 1) % n;
    } else {
      if (!yt && nowMs - startedAt > total) startedAt += Math.floor((nowMs - startedAt) / total) * total;
      index = after;
      after = (after + 1) % n;
      yt = undefined;
      by = '';
    }
  }
  return { index, ...(yt ? { yt } : {}), startedAt, by, queue, after };
}

/** 흐름에서 지금 곡(목록 번호 또는 유튜브)·위치(초)·남은 시간(초)·신청한 사람 */
export function clubLineAt(
  line: ClubLine,
  nowMs: number,
  seconds: readonly number[],
): { index: number; yt?: YoutubeSong; offset: number; left: number; by: string } | null {
  if (!seconds.length || (!line.yt && (line.index < 0 || line.index >= seconds.length))) return null;
  const a = advanceLine(line, nowMs, seconds);
  const len = a.yt ? a.yt.seconds : lenOf(seconds, a.index);
  if (!len) return null;
  const offset = Math.max(0, (nowMs - a.startedAt) / 1000);
  return { index: a.index, ...(a.yt ? { yt: a.yt } : {}), offset, left: Math.max(0, len - offset), by: a.by };
}

/** 신청곡이 없을 때(시계 순서) 지금 곡으로 흐름을 하나 만든다 */
export function lineFromClock(nowMs: number, seconds: readonly number[]): ClubLine | null {
  const s = clubScheduleAt(nowMs, seconds);
  return s ? { index: s.index, startedAt: nowMs - s.offset * 1000, by: '', queue: [], after: (s.index + 1) % seconds.length } : null;
}

/** 유튜브 주소에서 영상 id (watch?v=, youtu.be/, shorts/, embed/, music.youtube.com). 아니면 null */
export function youtubeIdOf(url: string): string | null {
  const s = url.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'music.youtube.com') {
    id = u.searchParams.get('v') ?? (/^\/(shorts|embed|live)\/([^/?#]+)/.exec(u.pathname)?.[2] ?? null);
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

/** 유튜브 신청곡 길이 한도 (초) */
export const YOUTUBE_MAX_SECONDS = 8 * 60;

/** 대기열 곡을 가리키는 값 (운영자가 뺄 때 다른 곡을 빼지 않게 확인한다) */
export const queueKey = (q: ClubQueueItem) => `${q.who}:${q.yt ? `yt:${q.yt.id}` : q.index}`;

/**
 * 지금 곡을 끝내고 다음 곡을 nowMs부터 튼다 (운영자 넘기기). 다음 곡 = 대기열 첫 곡, 없으면 목록의 다음 곡.
 * line은 nowMs에 맞게 당긴 흐름이어야 한다 (advanceLine).
 */
export function skipLine(line: ClubLine, nowMs: number, trackCount: number): ClubLine {
  const n = Math.max(1, trackCount);
  const after = line.after ?? (line.index >= 0 ? (line.index + 1) % n : 0);
  const [next, ...rest] = line.queue;
  if (next) {
    return { index: next.index, ...(next.yt ? { yt: next.yt } : {}), startedAt: nowMs, by: next.by, queue: rest, after: next.yt ? after : (next.index + 1) % n };
  }
  return { index: after, startedAt: nowMs, by: '', queue: [], after: (after + 1) % n };
}
