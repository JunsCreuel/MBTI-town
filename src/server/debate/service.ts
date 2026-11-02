// 토론 매치 규칙을 지키며 저장소를 다룬다. 화면(API)은 이 클래스만 쓴다.
// 승패는 관전 유형이 정한다: 관전자가 대표 논거 하나를 고르면 그 논거의 팀에 한 표가 간다.
import 'server-only';
import { debateConfig } from '@/config/game';
import { MBTI_TYPES, isMbtiType, type MbtiType } from '@/design/mbti';
import {
  canVote, currentSlot, decideWinner, decisiveArgument, matchupFor, phaseOf, pickTopic, representatives, sideOf,
  tallyByType, voteScore, type Match, type MatchResult, type Phase, type Side, type Topic,
} from '@/shared/debate';
import { moderate } from '@/shared/moderation';
import { TOPICS } from '@/shared/topics';
import type { DebateStore, Profile } from './store';

export type DebateErrorCode =
  | 'login_required' | 'mbti_required' | 'not_found' | 'wrong_phase' | 'not_team' | 'limit' | 'too_short' | 'too_long'
  | 'rejected' | 'own_argument' | 'other_team' | 'not_voter' | 'not_representative' | 'already_voted' | 'cooldown'
  | 'bad_request';

const STATUS: Record<DebateErrorCode, number> = {
  login_required: 401, mbti_required: 403, not_found: 404, wrong_phase: 409, not_team: 403, limit: 409, too_short: 400,
  too_long: 400, rejected: 422, own_argument: 409, other_team: 403, not_voter: 403, not_representative: 409,
  already_voted: 409, cooldown: 429, bad_request: 400,
};

export class DebateError extends Error {
  readonly status: number;
  constructor(readonly code: DebateErrorCode, message: string) {
    super(message);
    this.status = STATUS[code];
  }
}

export interface ArgumentView {
  id: string;
  side: Side;
  body: string;
  authorMbti: MbtiType;
  recommendations: number;
  mine: boolean;
  recommended: boolean;
  representative: boolean;
  /** 관전자에게 뽑힌 수 (결과 발표 뒤에만) */
  picks: number | null;
}

export interface DebateView {
  now: string;
  phase: Phase;
  match: {
    id: string;
    key: string;
    topic: Topic;
    teamA: Match['teamA'];
    teamB: Match['teamB'];
    opensAt: string;
    writingEndsAt: string;
    votingEndsAt: string;
  };
  me: {
    loggedIn: boolean;
    mbti: MbtiType | null;
    side: Side | null;
    canVote: boolean;
    /** 내가 고른 대표 논거 */
    vote: { side: Side; argumentId: string | null } | null;
    argumentsLeft: number;
  };
  arguments: ArgumentView[];
  result: MatchResult | null;
  recent: { id: string; key: string; title: string; teamA: string; teamB: string; winner: Side | 'draw' }[];
}

export interface Viewer {
  id: string;
}

export class DebateService {
  private topicsSynced = false;

  constructor(
    private readonly store: DebateStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** 지금 칸의 경기. 없으면 대진과 주제를 정해 만든다. */
  async currentMatch(): Promise<Match> {
    const slot = currentSlot(this.now());
    const existing = await this.store.getMatchByKey(slot.key);
    if (existing) return existing;
    if (!this.topicsSynced) {
      await this.store.syncTopics(TOPICS);
      this.topicsSynced = true;
    }
    // 동시에 두 요청이 만들려고 하면 한쪽만 성공하고, 나머지는 만들어진 경기를 읽는다
    for (let attempt = 0; attempt < 3; attempt++) {
      const seq = await this.store.nextSeq();
      const topic = pickTopic(await this.store.activeTopics(), await this.store.topicLastUsed());
      const { teamA, teamB } = matchupFor(seq);
      try {
        const created = await this.store.insertMatch({ ...slot, seq, topic, teamA, teamB });
        if (created) return created;
        const raced = await this.store.getMatchByKey(slot.key);
        if (raced) return raced;
      } catch (e) {
        // 다른 칸의 경기가 같은 seq를 먼저 가져간 경우: 다시 시도한다
        if (attempt === 2) throw e;
      }
    }
    throw new Error('경기를 만들지 못했습니다');
  }

  async getMatch(id: string): Promise<Match> {
    const m = await this.store.getMatch(id);
    if (!m) throw new DebateError('not_found', '경기를 찾을 수 없어요.');
    return m;
  }

  /** 판정 시간이 끝났는데 결과가 없으면 바로 집계해서 돌려준다 */
  async withResult(match: Match): Promise<Match> {
    if (phaseOf(match, this.now()) !== 'judging') return match;
    await this.finalizeDue();
    return this.getMatch(match.id);
  }

  async profile(userId: string): Promise<Profile | null> {
    return this.store.getProfile(userId);
  }

  /** MBTI는 한 번 정한 뒤 일정 기간 바꿀 수 없다 (팀을 옮겨 다니며 참여하는 걸 막는다) */
  async setMbti(viewer: Viewer, mbti: string): Promise<void> {
    if (!isMbtiType(mbti)) throw new DebateError('bad_request', 'MBTI 유형이 올바르지 않아요.');
    const p = await this.store.getProfile(viewer.id);
    if (p?.mbti === mbti) return;
    const until = this.mbtiChangeableAt(p);
    if (until && until > this.now()) {
      throw new DebateError('cooldown', `MBTI는 ${debateConfig.mbtiChangeCooldownDays}일에 한 번 바꿀 수 있어요.`);
    }
    await this.store.setMbti(viewer.id, mbti, this.now());
  }

  mbtiChangeableAt(p: Profile | null): Date | null {
    if (!p?.mbti || !p.mbtiChangedAt) return null;
    return new Date(p.mbtiChangedAt.getTime() + debateConfig.mbtiChangeCooldownDays * 86_400_000);
  }

  async view(match: Match, viewer: Viewer | null): Promise<DebateView> {
    const now = this.now();
    const phase = phaseOf(match, now);
    const profile = viewer ? await this.store.getProfile(viewer.id) : null;
    const mbti = profile?.mbti ?? null;
    const side = sideOf(match, mbti);
    const [args, recommended, vote, mine, recent] = await Promise.all([
      this.store.listArguments(match.id),
      viewer ? this.store.recommendedBy(match.id, viewer.id) : Promise.resolve([]),
      viewer ? this.store.getVote(match.id, viewer.id) : Promise.resolve(null),
      viewer ? this.store.countArgumentsBy(match.id, viewer.id) : Promise.resolve(0),
      this.store.recentDone(6),
    ]);
    // 대표 논거는 작성이 끝난 뒤에 정해진다
    const reps = new Set(
      phase === 'writing'
        ? []
        : match.result
          ? [...match.result.representative.a, ...match.result.representative.b]
          : [...representatives(args, 'a'), ...representatives(args, 'b')].map((a) => a.id),
    );
    const picks = match.result?.picks ?? null;
    const recSet = new Set(recommended);
    return {
      now: now.toISOString(),
      phase,
      match: {
        id: match.id,
        key: match.key,
        topic: match.topic,
        teamA: match.teamA,
        teamB: match.teamB,
        opensAt: match.opensAt.toISOString(),
        writingEndsAt: match.writingEndsAt.toISOString(),
        votingEndsAt: match.votingEndsAt.toISOString(),
      },
      me: {
        loggedIn: !!viewer,
        mbti,
        side,
        canVote: !!viewer && canVote(match, mbti),
        vote,
        argumentsLeft: side ? Math.max(0, debateConfig.argumentsPerUser - mine) : 0,
      },
      arguments: args
        // 작성 중에는 추천 많은 순, 그 뒤로는 대표 논거가 먼저 (발표 뒤에는 많이 뽑힌 순)
        .sort(
          (x, y) =>
            Number(reps.has(y.id)) - Number(reps.has(x.id)) ||
            (picks ? (picks[y.id] ?? 0) - (picks[x.id] ?? 0) : 0) ||
            y.recommendations - x.recommendations ||
            x.createdAt.getTime() - y.createdAt.getTime(),
        )
        .map((a) => ({
          id: a.id,
          side: a.side,
          body: a.body,
          authorMbti: a.authorMbti,
          recommendations: a.recommendations,
          mine: !!viewer && a.authorId === viewer.id,
          recommended: recSet.has(a.id),
          representative: reps.has(a.id),
          picks: picks && reps.has(a.id) ? (picks[a.id] ?? 0) : null,
        })),
      result: match.result,
      recent: recent
        .filter((m) => m.id !== match.id && m.result)
        .slice(0, 5)
        .map((m) => ({ id: m.id, key: m.key, title: m.topic.title, teamA: m.teamA.label, teamB: m.teamB.label, winner: m.result!.winner })),
    };
  }

  private async requireMember(viewer: Viewer | null, match: Match): Promise<{ mbti: MbtiType; side: Side }> {
    if (!viewer) throw new DebateError('login_required', '로그인이 필요해요.');
    const p = await this.store.getProfile(viewer.id);
    if (!p?.mbti) throw new DebateError('mbti_required', '먼저 내 MBTI를 정해 주세요.');
    const side = sideOf(match, p.mbti);
    if (!side) throw new DebateError('not_team', `오늘은 ${match.teamA.label}과 ${match.teamB.label}만 논거를 쓸 수 있어요.`);
    return { mbti: p.mbti, side };
  }

  async submitArgument(viewer: Viewer | null, rawBody: unknown) {
    const match = await this.currentMatch();
    const { mbti, side } = await this.requireMember(viewer, match);
    if (phaseOf(match, this.now()) !== 'writing') throw new DebateError('wrong_phase', '논거 작성 시간이 끝났어요.');
    const body = typeof rawBody === 'string' ? rawBody.trim() : '';
    if ([...body].length < debateConfig.argumentMinLength) {
      throw new DebateError('too_short', `논거는 ${debateConfig.argumentMinLength}자 이상 써 주세요.`);
    }
    if ([...body].length > debateConfig.argumentMaxLength) {
      throw new DebateError('too_long', `논거는 ${debateConfig.argumentMaxLength}자까지 쓸 수 있어요.`);
    }
    if ((await this.store.countArgumentsBy(match.id, viewer!.id)) >= debateConfig.argumentsPerUser) {
      throw new DebateError('limit', '이번 경기에 낼 수 있는 논거를 모두 냈어요.');
    }
    const check = moderate(body);
    if (!check.allowed) throw new DebateError('rejected', check.reason);
    return this.store.insertArgument({ matchId: match.id, authorId: viewer!.id, authorMbti: mbti, side, body, at: this.now() });
  }

  async recommend(viewer: Viewer | null, argumentId: unknown, on: unknown): Promise<void> {
    if (typeof argumentId !== 'string' || typeof on !== 'boolean') throw new DebateError('bad_request', '요청이 올바르지 않아요.');
    const match = await this.currentMatch();
    const { side } = await this.requireMember(viewer, match);
    if (phaseOf(match, this.now()) !== 'writing') throw new DebateError('wrong_phase', '추천 시간이 끝났어요. 대표 논거가 정해졌어요.');
    const arg = await this.store.getArgument(argumentId);
    if (!arg || arg.matchId !== match.id) throw new DebateError('not_found', '논거를 찾을 수 없어요.');
    if (arg.side !== side) throw new DebateError('other_team', '추천은 우리 팀 논거에만 할 수 있어요.');
    if (arg.authorId === viewer!.id) throw new DebateError('own_argument', '내 논거는 추천할 수 없어요.');
    await this.store.setRecommendation(match.id, arg.id, viewer!.id, on);
  }

  /** 관전 판정: 양 팀 대표 논거 중 가장 설득력 있는 하나를 고른다 */
  async vote(viewer: Viewer | null, argumentId: unknown): Promise<void> {
    if (typeof argumentId !== 'string') throw new DebateError('bad_request', '요청이 올바르지 않아요.');
    if (!viewer) throw new DebateError('login_required', '로그인이 필요해요.');
    const match = await this.currentMatch();
    if (phaseOf(match, this.now()) !== 'voting') throw new DebateError('wrong_phase', '지금은 판정 시간이 아니에요.');
    const p = await this.store.getProfile(viewer.id);
    if (!p?.mbti) throw new DebateError('mbti_required', '먼저 내 MBTI를 정해 주세요.');
    if (!canVote(match, p.mbti)) throw new DebateError('not_voter', '출전 팀은 판정할 수 없어요. 관전 주민들이 판정해요.');
    const args = await this.store.listArguments(match.id);
    const arg = [...representatives(args, 'a'), ...representatives(args, 'b')].find((a) => a.id === argumentId);
    if (!arg) throw new DebateError('not_representative', '대표 논거 중에서 골라 주세요.');
    const ok = await this.store.insertVote({ matchId: match.id, userId: viewer.id, voterMbti: p.mbti, side: arg.side, argumentId: arg.id });
    if (!ok) throw new DebateError('already_voted', '이미 판정했어요.');
  }

  /** 판정 시간이 끝난 경기를 모두 집계한다. 다른 요청이 집계 중인 경기는 건너뛴다. */
  async finalizeDue(): Promise<Match[]> {
    const done: Match[] = [];
    for (const m of await this.store.dueMatches(this.now())) {
      const finished = await this.finalize(m);
      if (finished) done.push(finished);
    }
    return done;
  }

  private async finalize(match: Match): Promise<Match | null> {
    if (!(await this.store.tryStartJudging(match.id, debateConfig.judgingStaleMinutes))) return null;
    try {
      const args = await this.store.listArguments(match.id);
      const reps = { a: representatives(args, 'a'), b: representatives(args, 'b') };
      const repIds = new Set([...reps.a, ...reps.b].map((a) => a.id));
      const votes = await this.store.listVotes(match.id);
      const vote = voteScore(votes);
      const winner = decideWinner(votes, vote);
      const picks: Record<string, number> = {};
      for (const v of votes) if (v.argumentId && repIds.has(v.argumentId)) picks[v.argumentId] = (picks[v.argumentId] ?? 0) + 1;
      const decisive = winner === 'draw' ? null : decisiveArgument(reps[winner], picks);
      const byType = tallyByType(votes);
      const result: MatchResult = {
        vote,
        voters: votes.length,
        byType,
        picks,
        winner,
        decisive: decisive ? { argumentId: decisive.id, side: decisive.side, body: decisive.body, picks: picks[decisive.id] ?? 0 } : null,
        summary: summarize(match, winner, byType, votes.length),
        representative: { a: reps.a.map((x) => x.id), b: reps.b.map((x) => x.id) },
        decidedAt: this.now().toISOString(),
      };
      await this.store.finishJudging(match.id, result);
      return { ...match, status: 'done', result };
    } catch (e) {
      // 다음 요청이나 예약 작업이 다시 집계하도록 풀어 둔다
      await this.store.releaseJudging(match.id);
      console.error('[debate] 결과 집계 실패', e);
      return null;
    }
  }
}

/** 결과 발표 문장 */
function summarize(
  match: Match,
  winner: Side | 'draw',
  byType: MatchResult['byType'],
  voters: number,
): string {
  if (!voters) return '관전 판정이 없어 무승부예요.';
  const types = MBTI_TYPES.filter((t) => byType[t]);
  if (winner === 'draw') return `관전 유형 ${types.length}개, ${voters}명이 판정했는데 두 팀이 똑같이 표를 받았어요.`;
  const label = winner === 'a' ? match.teamA.label : match.teamB.label;
  const backers = types.filter((t) => byType[t]![winner] > byType[t]![winner === 'a' ? 'b' : 'a']).length;
  return `관전 유형 ${types.length}개, ${voters}명이 판정했어요. 그중 ${backers}개 유형이 ${label} 손을 들었어요.`;
}
