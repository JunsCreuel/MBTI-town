// 하루 경기 흐름을 실제 Postgres(PGlite, 메모리)와 가짜 AI, 가짜 시계로 확인한다.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MBTI_TYPES, type MbtiType } from '@/design/mbti';
import { createPgliteSql, ensureDevAuthUser, type Sql } from '../db';
import type { DebateAi, JudgeInput } from './ai';
import { DebateError, DebateService, type Viewer } from './service';
import { DebateStore } from './store';

const kst = (s: string) => new Date(`${s}+09:00`);

class FakeAi implements DebateAi {
  readonly name = 'fake';
  failJudge = false;
  lastJudge: JudgeInput | null = null;
  async moderate({ body }: { body: string }) {
    return body.includes('비하') ? { allowed: false, reason: '비하 표현을 빼 주세요.' } : { allowed: true, reason: '문제없음' };
  }
  async judge(input: JudgeInput) {
    if (this.failJudge) throw new Error('잠시 장애');
    this.lastJudge = input;
    return {
      a: { logic: 30, factuality: 20, evidence: 15, rebuttal: 10, relevance: 12, comment: 'A 좋음', bestArgumentId: 'not-a-real-id' },
      b: { logic: 10, factuality: 15, evidence: 5, rebuttal: 3, relevance: 10, comment: 'B 아쉬움', bestArgumentId: input.b.arguments[0]?.id ?? '' },
      summary: '두 팀 모두 수고했어요.',
    };
  }
}

let sql: Sql;
let store: DebateStore;
let clock = kst('2026-11-02T09:00:00');
const ai = new FakeAi();
let service: DebateService;

async function user(mbti: MbtiType | null): Promise<Viewer> {
  const id = randomUUID();
  await ensureDevAuthUser(sql, id);
  if (mbti) await store.setMbti(id, mbti, new Date('2026-10-01'));
  return { id };
}

async function expectError(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof DebateError && e.code === code);
}

// PGlite(WebAssembly Postgres)는 처음 띄울 때 몇 초 걸린다
beforeAll(async () => {
  sql = await createPgliteSql();
  store = new DebateStore(sql);
  service = new DebateService(store, ai, () => clock);
}, 60_000);

afterAll(async () => {
  await sql.close();
});

describe('하루 경기 흐름', () => {
  let matchId: string;
  let a1: Viewer, a2: Viewer, a3: Viewer, b1: Viewer, spectators: Viewer[], stranger: Viewer;
  let teamAType: MbtiType, teamBType: MbtiType;

  it('오늘 경기를 한 번만 만든다 (동시에 요청해도)', async () => {
    const [m1, m2, m3] = await Promise.all([service.currentMatch(), service.currentMatch(), service.currentMatch()]);
    expect(new Set([m1.id, m2.id, m3.id]).size).toBe(1);
    expect(m1.key).toBe('2026-11-02#0');
    expect(m1.seq).toBe(0);
    matchId = m1.id;
    teamAType = m1.teamA.members[0];
    teamBType = m1.teamB.members[0];
    a1 = await user(teamAType);
    a2 = await user(teamAType);
    a3 = await user(teamAType);
    b1 = await user(teamBType);
    const others = MBTI_TYPES.filter((t) => t !== teamAType && t !== teamBType);
    spectators = await Promise.all([others[0], others[0], others[0], others[1], others[2]].map((t) => user(t)));
    stranger = await user(null);
  });

  it('논거는 출전 팀만, 규칙에 맞게 낼 수 있다', async () => {
    await expectError(service.submitArgument(null, '로그인 없이 쓰는 논거입니다'), 'login_required');
    await expectError(service.submitArgument(stranger, '엠비티아이 없이 쓰는 논거'), 'mbti_required');
    await expectError(service.submitArgument(spectators[0], '관전자가 쓰는 논거입니다'), 'not_team');
    await expectError(service.submitArgument(a1, '짧음'), 'too_short');
    await expectError(service.submitArgument(a1, '가'.repeat(301)), 'too_long');
    await expectError(service.submitArgument(a1, '상대 유형을 비하하는 논거입니다'), 'rejected');

    const arg = await service.submitArgument(a1, '첫 번째 논거입니다. 왜냐하면 이유가 있기 때문입니다.');
    expect(arg.side).toBe('a');
    await expectError(service.submitArgument(a1, '두 번째로 내는 논거입니다'), 'limit');
    clock = kst('2026-11-02T10:00:00');
    await service.submitArgument(a2, '두 번째 사람의 논거입니다. 예를 들어 실제로 그렇습니다.');
    clock = kst('2026-11-02T11:00:00');
    await service.submitArgument(a3, '세 번째 사람의 논거입니다. 하지만 상대 입장도 있습니다.');
    await service.submitArgument(b1, 'B팀의 논거입니다. 그러나 반대로 생각해 보면 이렇습니다.');
  });

  it('추천은 같은 팀 다른 사람 논거에만, 다시 누르면 취소된다', async () => {
    const args = await store.listArguments(matchId);
    const [arg1, arg2, arg3] = args.filter((x) => x.side === 'a');
    const argB = args.find((x) => x.side === 'b')!;
    await expectError(service.recommend(a1, arg1.id, true), 'own_argument');
    await expectError(service.recommend(a1, argB.id, true), 'other_team');
    await expectError(service.recommend(spectators[0], arg1.id, true), 'not_team');
    await service.recommend(a1, arg3.id, true);
    await service.recommend(a2, arg3.id, true);
    await service.recommend(a3, arg2.id, true);
    await service.recommend(a3, arg2.id, false);
    await service.recommend(a3, arg2.id, true);
    await service.recommend(a3, arg2.id, true); // 두 번 눌러도 한 번
    const counts = Object.fromEntries((await store.listArguments(matchId)).map((x) => [x.id, x.recommendations]));
    expect(counts[arg3.id]).toBe(2);
    expect(counts[arg2.id]).toBe(1);
    expect(counts[arg1.id]).toBe(0);
  });

  it('작성 시간에는 투표할 수 없다', async () => {
    await expectError(service.vote(spectators[0], 'a'), 'wrong_phase');
  });

  it('투표 시간: 대표 논거가 정해지고, 관전자만 한 번 투표한다', async () => {
    clock = kst('2026-11-02T19:00:00');
    await expectError(service.submitArgument(a1, '시간이 지난 뒤에 쓰는 논거'), 'wrong_phase');
    const args = await store.listArguments(matchId);
    await expectError(service.recommend(a2, args.find((x) => x.side === 'a' && x.authorId === a1.id)!.id, true), 'wrong_phase');
    await expectError(service.vote(a1, 'a'), 'not_voter');
    await expectError(service.vote(stranger, 'a'), 'mbti_required');
    await expectError(service.vote(spectators[0], 'c'), 'bad_request');
    // 같은 유형 3명은 B, 다른 두 유형은 A: 유형별로 세면 A가 앞선다
    await service.vote(spectators[0], 'b');
    await service.vote(spectators[1], 'b');
    await service.vote(spectators[2], 'b');
    await service.vote(spectators[3], 'a');
    await service.vote(spectators[4], 'a');
    await expectError(service.vote(spectators[0], 'a'), 'already_voted');

    const view = await service.view(await service.getMatch(matchId), spectators[0]);
    expect(view.phase).toBe('voting');
    expect(view.me).toMatchObject({ canVote: true, vote: 'b', side: null });
    expect(view.arguments.filter((x) => x.representative)).toHaveLength(4); // A 3개 + B 1개
    expect(view.arguments[0].representative).toBe(true);
    expect(view.result).toBeNull();

    const mine = await service.view(await service.getMatch(matchId), a1);
    expect(mine.me).toMatchObject({ side: 'a', canVote: false, argumentsLeft: 0 });
    expect(mine.arguments.filter((x) => x.mine)).toHaveLength(1);
  });

  it('채점이 실패하면 풀어 두고, 다음에 다시 채점한다', async () => {
    clock = kst('2026-11-02T21:05:00');
    ai.failJudge = true;
    expect(await service.judgeDue()).toHaveLength(0);
    expect((await service.getMatch(matchId)).status).toBe('open');
    ai.failJudge = false;
  });

  it('채점: AI 7 + 투표 3, 결정타는 승리 팀 논거', async () => {
    const [done] = await service.judgeDue();
    expect(done.id).toBe(matchId);
    const r = done.result!;
    expect(r.aiTotal).toEqual({ a: 25 + 20 + 15 + 10 + 12, b: 10 + 15 + 5 + 3 + 10 }); // A 논리성 30은 25로 잘림
    expect(r.vote.a).toBeGreaterThan(50);
    expect(r.voters).toBe(5);
    expect(r.winner).toBe('a');
    expect(r.decisive?.side).toBe('a');
    // AI가 엉뚱한 id를 주면 추천 1위 논거로 대신한다
    expect(r.decisive?.argumentId).toBe(r.representative.a[0]);
    expect(r.representative.a).toHaveLength(3);
    expect(ai.lastJudge!.a.arguments).toHaveLength(3);
    // 이미 채점한 경기는 다시 채점하지 않는다
    expect(await service.judgeDue()).toHaveLength(0);

    const view = await service.view(await service.getMatch(matchId), null);
    expect(view.phase).toBe('done');
    expect(view.me.loggedIn).toBe(false);
    expect(view.result?.winner).toBe('a');
  });

  it('다음 날에는 새 경기, 다른 대진과 주제', async () => {
    const before = await service.getMatch(matchId);
    clock = kst('2026-11-03T00:30:00');
    const next = await service.currentMatch();
    expect(next.key).toBe('2026-11-03#0');
    expect(next.seq).toBe(1);
    expect(next.topic.id).not.toBe(before.topic.id);
    expect(`${next.teamA.id}-${next.teamB.id}`).not.toBe(`${before.teamA.id}-${before.teamB.id}`);
    const view = await service.view(next, null);
    expect(view.recent.map((x) => x.id)).toContain(matchId);
  });

  it('MBTI는 바꾼 뒤 7일 동안 다시 바꿀 수 없다', async () => {
    const u = await user(null);
    await service.setMbti(u, 'ENFP');
    await expectError(service.setMbti(u, 'ISTJ'), 'cooldown');
    await service.setMbti(u, 'ENFP'); // 같은 값은 괜찮다
    await expectError(service.setMbti(u, 'XXXX'), 'bad_request');
  });
});
