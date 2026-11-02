// 토론 매치 규칙 (PROJECT_GUIDE.md 7장). 서버와 화면이 함께 쓰는 순수 함수만 둔다.
import { debateConfig, type MatchupMode } from '../config/game';
import { MBTI_GROUPS, MBTI_TYPES, groupOf, type MbtiGroup, type MbtiType } from '../design/mbti';

export type Side = 'a' | 'b';
export type Phase = 'writing' | 'voting' | 'judging' | 'done';

export interface Team {
  kind: 'type' | 'axis' | 'group';
  /** 'ENTP', 'E', 'NT' */
  id: string;
  /** 화면 표시: 'ENTP팀', 'E(외향)팀', '분석가(NT)팀' */
  label: string;
  members: MbtiType[];
}

export interface Topic {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
}

export interface Criteria {
  logic: number;
  factuality: number;
  evidence: number;
  rebuttal: number;
  relevance: number;
}

export interface MatchResult {
  /** 팀별 AI 기준 점수와 한 줄 평 */
  ai: Record<Side, Criteria & { comment: string }>;
  aiTotal: Record<Side, number>;
  /** 관전 투표 점수 (0~100, 두 팀 합 100) */
  vote: Record<Side, number>;
  voters: number;
  final: Record<Side, number>;
  winner: Side | 'draw';
  /** 결정타 논거 */
  decisive: { argumentId: string; side: Side; body: string } | null;
  summary: string;
  representative: Record<Side, string[]>;
  judgedBy: string;
  judgedAt: string;
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
  authorMbti: MbtiType;
  side: Side;
  body: string;
  createdAt: Date;
  recommendations: number;
}

export interface VoteRecord {
  voterMbti: MbtiType;
  side: Side;
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

const AXES: [string, string][] = [['E', 'I'], ['S', 'N'], ['T', 'F'], ['J', 'P']];
const AXIS_NAME: Record<string, string> = {
  E: '외향', I: '내향', S: '감각', N: '직관', T: '사고', F: '감정', J: '판단', P: '인식',
};

function typeTeam(t: MbtiType): Team {
  return { kind: 'type', id: t, label: `${t}팀`, members: [t] };
}

function axisTeam(letter: string): Team {
  const pos = AXES.findIndex((a) => a.includes(letter));
  return {
    kind: 'axis',
    id: letter,
    label: `${letter}(${AXIS_NAME[letter]})팀`,
    members: MBTI_TYPES.filter((t) => t[pos] === letter),
  };
}

function groupTeam(g: MbtiGroup): Team {
  const meta = MBTI_GROUPS.find((x) => x.id === g)!;
  return { kind: 'group', id: g, label: `${meta.name}(${g})팀`, members: MBTI_TYPES.filter((t) => groupOf(t) === g) };
}

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

function shuffled<T>(items: T[], seed: number): T[] {
  const r = seeded(seed);
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 대진 방식별로 가능한 모든 대진. 한 바퀴를 다 돌기 전에는 같은 대진이 다시 나오지 않는다. */
export function matchupCycle(mode: MatchupMode): [Team, Team][] {
  switch (mode) {
    case 'axis':
      return AXES.map(([x, y]) => [axisTeam(x), axisTeam(y)]);
    case 'temperament': {
      const ids = MBTI_GROUPS.map((g) => g.id);
      const pairs: [Team, Team][] = [];
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairs.push([groupTeam(ids[i]), groupTeam(ids[j])]);
      return shuffled(pairs, 7);
    }
    default: {
      const pairs: [Team, Team][] = [];
      for (let i = 0; i < MBTI_TYPES.length; i++) {
        for (let j = i + 1; j < MBTI_TYPES.length; j++) pairs.push([typeTeam(MBTI_TYPES[i]), typeTeam(MBTI_TYPES[j])]);
      }
      return shuffled(pairs, 20261102);
    }
  }
}

/** seq번째 경기의 대진. 어느 팀이 A(주제의 첫 번째 입장)를 맡을지도 정한다. */
export function matchupFor(seq: number, mode: MatchupMode = debateConfig.matchupMode): { teamA: Team; teamB: Team } {
  const cycle = matchupCycle(mode);
  const [x, y] = cycle[seq % cycle.length];
  return seeded(seq * 7919 + 1)() < 0.5 ? { teamA: x, teamB: y } : { teamA: y, teamB: x };
}

/** 가장 오래 쓰지 않은 주제 (한 번도 안 쓴 주제가 먼저, 같으면 목록 순서) */
export function pickTopic(topics: readonly Topic[], lastUsed: ReadonlyMap<string, number>): Topic {
  if (!topics.length) throw new Error('토론 주제가 없습니다');
  return [...topics].sort((a, b) => (lastUsed.get(a.id) ?? -1) - (lastUsed.get(b.id) ?? -1))[0];
}

// ───────────────────────── 참여 자격 ─────────────────────────

export function sideOf(match: Pick<Match, 'teamA' | 'teamB'>, mbti: MbtiType | null): Side | null {
  if (!mbti) return null;
  if (match.teamA.members.includes(mbti)) return 'a';
  if (match.teamB.members.includes(mbti)) return 'b';
  return null;
}

/**
 * 관전 투표를 할 수 있는 유형. 출전 팀이 아닌 유형이다.
 * 축 대전(E vs I)처럼 모두가 출전 팀이면 전원이 투표하고, 유형별 정규화로 인원 차이를 지운다.
 */
export function voterTypes(match: Pick<Match, 'teamA' | 'teamB'>): MbtiType[] {
  const playing = new Set([...match.teamA.members, ...match.teamB.members]);
  const spectators = MBTI_TYPES.filter((t) => !playing.has(t));
  return spectators.length ? spectators : [...MBTI_TYPES];
}

export function canVote(match: Pick<Match, 'teamA' | 'teamB'>, mbti: MbtiType | null): boolean {
  return !!mbti && voterTypes(match).includes(mbti);
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
 * 관전 투표 점수 (A, B 합 100). byType이면 유형마다 A 비율을 구해 평균 낸다.
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
      const t = byType.get(v.voterMbti) ?? { a: 0, b: 0 };
      t[v.side]++;
      byType.set(v.voterMbti, t);
    }
    const shares = [...byType.values()].map((t) => (t.a + 1) / (t.a + t.b + 2));
    shareA = shares.reduce((s, x) => s + x, 0) / shares.length;
  }
  const a = round1(shareA * 100);
  return { a, b: round1(100 - a) };
}

export function criteriaTotal(c: Criteria): number {
  return c.logic + c.factuality + c.evidence + c.rebuttal + c.relevance;
}

/** 기준별 상한을 넘지 않게 자른다 */
export function clampCriteria(c: Criteria, max = debateConfig.judgeCriteria): Criteria {
  const clamp = (v: number, hi: number) => Math.max(0, Math.min(hi, Math.round(Number.isFinite(v) ? v : 0)));
  return {
    logic: clamp(c.logic, max.logic),
    factuality: clamp(c.factuality, max.factuality),
    evidence: clamp(c.evidence, max.evidence),
    rebuttal: clamp(c.rebuttal, max.rebuttal),
    relevance: clamp(c.relevance, max.relevance),
  };
}

export function finalScores(
  aiTotal: Record<Side, number>,
  vote: Record<Side, number>,
  w: { ai: number; vote: number } = debateConfig.scoreWeights,
): { final: Record<Side, number>; winner: Side | 'draw' } {
  const final = { a: round1(aiTotal.a * w.ai + vote.a * w.vote), b: round1(aiTotal.b * w.ai + vote.b * w.vote) };
  let winner: Side | 'draw' = final.a > final.b ? 'a' : final.b > final.a ? 'b' : 'draw';
  // 최종 점수가 같으면 AI 점수로 가린다
  if (winner === 'draw' && aiTotal.a !== aiTotal.b) winner = aiTotal.a > aiTotal.b ? 'a' : 'b';
  return { final, winner };
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/** 결과 카드용: 40자 넘으면 자르고 말줄임표 */
export function clip(text: string, max = 40): string {
  const chars = [...text.replace(/\s+/g, ' ').trim()];
  return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : chars.join('');
}
