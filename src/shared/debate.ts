// 토론 매치 규칙 (PROJECT_GUIDE.md 10장). 서버와 화면이 함께 쓰는 순수 함수만 둔다.
// 오늘의 토론은 지역(오행) 대결이다: 하루에 두 지역이 맞붙고, 그 지역 주민이 논거를 쓰며, 나머지 세 지역 주민이 판정한다.
// MBTI는 토론과 상관없는 프로필 태그다 (논거 옆에 보여 줄 뿐이다).
import { debateConfig } from '../config/game';
import { DISTRICT, DISTRICTS, type District } from './districts';

export type Side = 'a' | 'b';
export type Phase = 'writing' | 'voting' | 'judging' | 'done';

export interface Team {
  /** 'district' = 지역 대결. 예전(MBTI 대결) 경기 기록에는 'type'·'axis'·'group'이 남아 있다 */
  kind: 'district' | 'type' | 'axis' | 'group';
  /** 지역 id (예전 기록은 MBTI 코드) */
  id: string;
  /** 화면 표시: '숲 지역(木)' */
  label: string;
  /** 출전하는 지역 (예전 기록은 MBTI 유형) */
  members: string[];
}

export interface Topic {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
}

/** 관전 판정 결과. 관전자가 대표 논거 하나를 고르면 그 논거의 팀에 한 표가 간다. */
export interface MatchResult {
  /** 판정 점수 (0~100, 두 팀 합 100). 판정 지역마다 같은 무게로 센다. */
  vote: Record<Side, number>;
  /** 판정한 사람 수 */
  voters: number;
  /** 판정 지역별 표 (판정한 지역만) */
  byDistrict?: Partial<Record<District, Record<Side, number>>>;
  /** 예전(MBTI 대결) 경기 기록의 유형별 표 */
  byType?: Partial<Record<string, Record<Side, number>>>;
  /** 대표 논거별로 뽑힌 수 */
  picks: Record<string, number>;
  winner: Side | 'draw';
  /** 결정타 논거: 승리 팀 대표 논거 중 가장 많이 뽑힌 것 */
  decisive: { argumentId: string; side: Side; body: string; picks: number } | null;
  summary: string;
  representative: Record<Side, string[]>;
  decidedAt: string;
}

export interface Match {
  id: string;
  /** 'YYYY-MM-DD#슬롯' (한국 날짜) */
  key: string;
  seq: number;
  topic: Topic;
  teamA: Team;
  teamB: Team;
  opensAt: Date;
  writingEndsAt: Date;
  votingEndsAt: Date;
  status: 'open' | 'judging' | 'done';
  result: MatchResult | null;
}

export interface Argument {
  id: string;
  matchId: string;
  authorId: string | null;
  /** 쓴 사람의 지역 (예전 기록은 null) */
  authorDistrict: District | null;
  /** 쓴 사람의 MBTI 태그 (선택 입력, 없으면 null) */
  authorMbti: string | null;
  side: Side;
  body: string;
  createdAt: Date;
  recommendations: number;
}

export interface VoteRecord {
  voterDistrict: District;
  side: Side;
  /** 고른 대표 논거 */
  argumentId: string | null;
}

// ───────────────────────── 시간표 ─────────────────────────

const MINUTE = 60_000;

function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

/** 한국 날짜 'YYYY-MM-DD' */
export function localDate(now: Date, offsetMinutes = debateConfig.utcOffsetMinutes): string {
  return new Date(now.getTime() + offsetMinutes * MINUTE).toISOString().slice(0, 10);
}

/** 한국 날짜와 시각(분)을 UTC Date로 */
function localTime(date: string, minutes: number, offsetMinutes: number): Date {
  return new Date(Date.parse(`${date}T00:00:00Z`) + (minutes - offsetMinutes) * MINUTE);
}

export interface SlotTimes {
  key: string;
  opensAt: Date;
  writingEndsAt: Date;
  votingEndsAt: Date;
}

/**
 * 지금 보여 줄 경기 칸. 오늘 칸 중 이미 열린 가장 늦은 칸이고,
 * 아직 아무 칸도 열리지 않았으면 어제의 마지막 칸이다 (발표 결과를 계속 보여 준다).
 */
export function currentSlot(
  now: Date,
  slots: readonly { opensAt: string; writingEndsAt: string; votingEndsAt: string }[] = debateConfig.slots,
  offsetMinutes = debateConfig.utcOffsetMinutes,
): SlotTimes {
  const build = (date: string, i: number): SlotTimes => {
    const s = slots[i];
    const open = parseHm(s.opensAt);
    const wEnd = parseHm(s.writingEndsAt);
    const vEnd = parseHm(s.votingEndsAt);
    // 끝나는 시각이 여는 시각보다 이르면 다음 날로 넘어간 것이다
    const fix = (m: number) => (m <= open ? m + 24 * 60 : m);
    return {
      key: `${date}#${i}`,
      opensAt: localTime(date, open, offsetMinutes),
      writingEndsAt: localTime(date, fix(wEnd), offsetMinutes),
      votingEndsAt: localTime(date, fix(vEnd), offsetMinutes),
    };
  };
  const today = localDate(now, offsetMinutes);
  for (let i = slots.length - 1; i >= 0; i--) {
    const s = build(today, i);
    if (s.opensAt.getTime() <= now.getTime()) return s;
  }
  const yesterday = localDate(new Date(now.getTime() - 24 * 60 * MINUTE), offsetMinutes);
  return build(yesterday, slots.length - 1);
}

export function phaseOf(match: Pick<Match, 'writingEndsAt' | 'votingEndsAt' | 'status'>, now: Date): Phase {
  if (match.status === 'done') return 'done';
  if (now < match.writingEndsAt) return 'writing';
  if (now < match.votingEndsAt) return 'voting';
  return 'judging';
}

// ───────────────────────── 대진 ─────────────────────────

export function districtTeam(d: District): Team {
  return { kind: 'district', id: d, label: `${DISTRICT[d].short} 지역${DISTRICT[d].element.slice(1)}`, members: [d] };
}

/**
 * 다섯 지역의 모든 짝 (10가지). 열흘에 한 바퀴 돌고, 지역마다 네 번씩 나오며 이틀 연속으로 나오지 않는다.
 * (한 바퀴의 끝과 다음 바퀴 처음은 이어질 수 있다)
 */
const DISTRICT_PAIRS: [District, District][] = [
  ['wood', 'fire'], ['earth', 'metal'], ['water', 'wood'], ['fire', 'earth'], ['metal', 'water'],
  ['wood', 'earth'], ['fire', 'metal'], ['earth', 'water'], ['metal', 'wood'], ['water', 'fire'],
];

/** 같은 순서가 반복되지 않게 섞되, 항상 같은 결과가 나오는 난수 */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 가능한 모든 대진. 한 바퀴를 다 돌기 전에는 같은 대진이 다시 나오지 않는다. */
export function matchupCycle(): [Team, Team][] {
  return DISTRICT_PAIRS.map(([x, y]) => [districtTeam(x), districtTeam(y)]);
}

/** seq번째 경기의 대진. 어느 지역이 A(주제의 첫 번째 입장)를 맡을지도 정한다. */
export function matchupFor(seq: number): { teamA: Team; teamB: Team } {
  const cycle = matchupCycle();
  const [x, y] = cycle[seq % cycle.length];
  return seeded(seq * 7919 + 1)() < 0.5 ? { teamA: x, teamB: y } : { teamA: y, teamB: x };
}

/** 가장 오래 쓰지 않은 주제 (한 번도 안 쓴 주제가 먼저, 같으면 목록 순서) */
export function pickTopic(topics: readonly Topic[], lastUsed: ReadonlyMap<string, number>): Topic {
  if (!topics.length) throw new Error('토론 주제가 없습니다');
  return [...topics].sort((a, b) => (lastUsed.get(a.id) ?? -1) - (lastUsed.get(b.id) ?? -1))[0];
}

// ───────────────────────── 참여 자격 ─────────────────────────

/** 이 지역 주민이 출전하는 쪽 (출전하지 않으면 null) */
export function sideOf(match: Pick<Match, 'teamA' | 'teamB'>, district: District | null): Side | null {
  if (!district) return null;
  if (match.teamA.members.includes(district)) return 'a';
  if (match.teamB.members.includes(district)) return 'b';
  return null;
}

/** 판정하는 지역: 출전하지 않은 세 지역 */
export function voterDistricts(match: Pick<Match, 'teamA' | 'teamB'>): District[] {
  const playing = new Set([...match.teamA.members, ...match.teamB.members]);
  return DISTRICTS.filter((d) => !playing.has(d));
}

export function canVote(match: Pick<Match, 'teamA' | 'teamB'>, district: District | null): boolean {
  return !!district && voterDistricts(match).includes(district);
}

// ───────────────────────── 집계와 점수 ─────────────────────────

/** 팀 안 추천 상위 N개. 추천 수가 같으면 먼저 쓴 논거가 앞선다. */
export function representatives(args: readonly Argument[], side: Side, n = debateConfig.representativeArgs): Argument[] {
  return args
    .filter((a) => a.side === side)
    .sort((a, b) => b.recommendations - a.recommendations || a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, n);
}

/**
 * 관전 판정 점수 (A, B 합 100). byDistrict면 판정 지역마다 A 비율을 구해 평균 낸다 (주민 수가 많은 지역이 판정을 좌우하지 않게).
 * 한두 표뿐인 지역이 극단값을 만들지 않게 지역마다 양쪽에 1표씩 더해 계산한다.
 */
export function voteScore(
  votes: readonly VoteRecord[],
  mode: 'byDistrict' | 'none' = debateConfig.voteNormalization,
): Record<Side, number> {
  if (!votes.length) return { a: 50, b: 50 };
  let shareA: number;
  if (mode === 'none') {
    shareA = votes.filter((v) => v.side === 'a').length / votes.length;
  } else {
    const byDistrict = new Map<District, { a: number; b: number }>();
    for (const v of votes) {
      const t = byDistrict.get(v.voterDistrict) ?? { a: 0, b: 0 };
      t[v.side]++;
      byDistrict.set(v.voterDistrict, t);
    }
    const shares = [...byDistrict.values()].map((t) => (t.a + 1) / (t.a + t.b + 2));
    shareA = shares.reduce((s, x) => s + x, 0) / shares.length;
  }
  const a = round1(shareA * 100);
  return { a, b: round1(100 - a) };
}

/** 판정 지역별 표 */
export function tallyByDistrict(votes: readonly VoteRecord[]): Partial<Record<District, Record<Side, number>>> {
  const out: Partial<Record<District, Record<Side, number>>> = {};
  for (const v of votes) {
    const t = (out[v.voterDistrict] ??= { a: 0, b: 0 });
    t[v.side]++;
  }
  return out;
}

/**
 * 판정 점수가 높은 팀이 이긴다. 같으면 표 수로 가리고, 그래도 같거나 표가 없으면 무승부.
 */
export function decideWinner(votes: readonly VoteRecord[], score = voteScore(votes)): Side | 'draw' {
  if (!votes.length) return 'draw';
  if (score.a !== score.b) return score.a > score.b ? 'a' : 'b';
  const a = votes.filter((v) => v.side === 'a').length;
  const b = votes.length - a;
  return a === b ? 'draw' : a > b ? 'a' : 'b';
}

/** 결정타 논거: 승리 팀 대표 논거 중 가장 많이 뽑힌 것. 같으면 추천 많은 순, 그다음 먼저 쓴 순. */
export function decisiveArgument(reps: readonly Argument[], picks: Readonly<Record<string, number>>): Argument | null {
  const sorted = [...reps].sort(
    (x, y) =>
      (picks[y.id] ?? 0) - (picks[x.id] ?? 0) ||
      y.recommendations - x.recommendations ||
      x.createdAt.getTime() - y.createdAt.getTime(),
  );
  return sorted[0] && (picks[sorted[0].id] ?? 0) > 0 ? sorted[0] : null;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/** 결과 카드용: 40자 넘으면 자르고 말줄임표 */
export function clip(text: string, max = 40): string {
  const chars = [...text.replace(/\s+/g, ' ').trim()];
  return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : chars.join('');
}
