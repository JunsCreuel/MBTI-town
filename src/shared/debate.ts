// 토론 매치 규칙 (PROJECT_GUIDE.md 10장). 서버와 화면이 함께 쓰는 순수 함수만 둔다.
// 오늘의 토론은 MBTI 성향 대결이다: 날마다 E·I / S·N / T·F / J·P 중 한 축이 맞붙는다.
// 모든 주민이 어느 한쪽 편이라 모두 논거를 쓰고 모두 판정한다. 판정은 유형마다 같은 무게로 센다.
import { debateConfig } from '../config/game';
import { MBTI_TYPES, isMbtiType, type MbtiType } from '../design/mbti';

export type Side = 'a' | 'b';
export type Phase = 'writing' | 'voting' | 'judging' | 'done';

/** 성향 글자와 축 */
export type AxisLetter = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';
export type Axis = 'EI' | 'SN' | 'TF' | 'JP';
export const AXES: readonly Axis[] = ['EI', 'SN', 'TF', 'JP'];
export const AXIS_NAME: Record<AxisLetter, string> = {
  E: '외향', I: '내향', S: '감각', N: '직관', T: '사고', F: '감정', J: '판단', P: '인식',
};

export interface Team {
  /** 'axis' = 성향 대결 (E팀·I팀). 예전 경기 기록에는 'district'(오행 지역)·'type'·'group'이 남아 있다 */
  kind: 'axis' | 'district' | 'type' | 'group';
  /** 성향 글자 (예전 기록은 지역 id·MBTI 코드) */
  id: string;
  /** 화면 표시: 'E(외향)' */
  label: string;
  /** 이 편인 MBTI 유형 */
  members: string[];
}

export interface Topic {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
  /** 이 주제를 다투는 축과, sideA를 자연스럽게 맡는 글자 (예: T가 "해결책이 먼저다"). 없으면 예전 주제 */
  axis?: Axis;
  a?: AxisLetter;
}

/** 판정 결과. 주민이 대표 논거 하나를 고르면 그 논거의 편에 한 표가 간다. */
export interface MatchResult {
  /** 판정 점수 (0~100, 두 편 합 100). 유형마다 같은 무게로 센다. */
  vote: Record<Side, number>;
  /** 판정한 사람 수 */
  voters: number;
  /** 유형별 표 (판정한 유형만) */
  byType?: Partial<Record<string, Record<Side, number>>>;
  /** 예전(오행 지역 대결) 경기 기록의 지역별 표 */
  byDistrict?: Partial<Record<string, Record<Side, number>>>;
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
  /** 쓴 사람의 MBTI (= 사는 마을). 예전 기록은 null일 수 있다 */
  authorMbti: string | null;
  side: Side;
  body: string;
  createdAt: Date;
  recommendations: number;
}

export interface VoteRecord {
  /** 판정한 사람의 MBTI */
  voterType: MbtiType;
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

const POS: Record<Axis, number> = { EI: 0, SN: 1, TF: 2, JP: 3 };

/** 이 축에서 글자 x의 맞은편 글자 */
export function otherLetter(x: AxisLetter): AxisLetter {
  const axis = AXES.find((a) => a.includes(x))!;
  return (axis[0] === x ? axis[1] : axis[0]) as AxisLetter;
}

export function axisOf(x: AxisLetter): Axis {
  return AXES.find((a) => a.includes(x))!;
}

/** 성향 팀: 그 글자를 가진 MBTI 여덟 유형 */
export function axisTeam(letter: AxisLetter): Team {
  const pos = POS[axisOf(letter)];
  return { kind: 'axis', id: letter, label: `${letter}(${AXIS_NAME[letter]})`, members: MBTI_TYPES.filter((t) => t[pos] === letter) };
}

/** seq번째 경기의 축: 네 축을 차례로 돈다 (나흘에 한 바퀴) */
export function axisFor(seq: number): Axis {
  return AXES[((seq % AXES.length) + AXES.length) % AXES.length];
}

/**
 * 주제에 맞춘 대진: 주제의 첫 번째 입장(sideA)을 자연스럽게 맡는 글자가 A팀이다
 * (예: T vs F 주제 "고민을 들으면 해결책이 먼저다"는 T가 A). 축만 정해진 주제면 축의 앞 글자가 A.
 */
export function teamsFor(topic: Topic, axis: Axis): { teamA: Team; teamB: Team } {
  const a = topic.axis === axis && topic.a ? topic.a : (axis[0] as AxisLetter);
  return { teamA: axisTeam(a), teamB: axisTeam(otherLetter(a)) };
}

/** 가장 오래 쓰지 않은 주제 (한 번도 안 쓴 주제가 먼저, 같으면 목록 순서). 그 축의 주제가 있으면 그 안에서 고른다 */
export function pickTopic(topics: readonly Topic[], lastUsed: ReadonlyMap<string, number>, axis?: Axis): Topic {
  if (!topics.length) throw new Error('토론 주제가 없습니다');
  const own = axis ? topics.filter((t) => t.axis === axis) : [];
  const pool = own.length ? own : topics;
  return [...pool].sort((a, b) => (lastUsed.get(a.id) ?? -1) - (lastUsed.get(b.id) ?? -1))[0];
}

// ───────────────────────── 참여 자격 ─────────────────────────

/** 이 유형이 맡는 편 (MBTI가 없으면 null) */
export function sideOf(match: Pick<Match, 'teamA' | 'teamB'>, mbti: string | null): Side | null {
  if (!mbti || !isMbtiType(mbti)) return null;
  if (match.teamA.members.includes(mbti)) return 'a';
  if (match.teamB.members.includes(mbti)) return 'b';
  return null;
}

/** 판정할 수 있는지: MBTI가 있는 주민은 모두 판정한다 (제 편 논거를 골라도 된다) */
export function canVote(_match: Pick<Match, 'teamA' | 'teamB'>, mbti: string | null): boolean {
  return !!mbti && isMbtiType(mbti);
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
 * 판정 점수 (A, B 합 100). byType이면 유형마다 A 비율을 구해 평균 낸다 (주민 수가 많은 유형이 판정을 좌우하지 않게).
 * 한두 표뿐인 유형이 극단값을 만들지 않게 유형마다 양쪽에 1표씩 더해 계산한다.
 */
export function voteScore(
  votes: readonly VoteRecord[],
  mode: 'byType' | 'none' = debateConfig.voteNormalization,
): Record<Side, number> {
  if (!votes.length) return { a: 50, b: 50 };
  let shareA: number;
  if (mode === 'none') {
    shareA = votes.filter((v) => v.side === 'a').length / votes.length;
  } else {
    const byType = new Map<MbtiType, { a: number; b: number }>();
    for (const v of votes) {
      const t = byType.get(v.voterType) ?? { a: 0, b: 0 };
      t[v.side]++;
      byType.set(v.voterType, t);
    }
    const shares = [...byType.values()].map((t) => (t.a + 1) / (t.a + t.b + 2));
    shareA = shares.reduce((s, x) => s + x, 0) / shares.length;
  }
  const a = round1(shareA * 100);
  return { a, b: round1(100 - a) };
}

/** 유형별 표 */
export function tallyByType(votes: readonly VoteRecord[]): Partial<Record<MbtiType, Record<Side, number>>> {
  const out: Partial<Record<MbtiType, Record<Side, number>>> = {};
  for (const v of votes) {
    const t = (out[v.voterType] ??= { a: 0, b: 0 });
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
