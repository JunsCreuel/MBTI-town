// 하루 경기 흐름을 실제 Postgres(PGlite, 메모리)와 가짜 시계로 확인한다.
// 오늘의 토론은 MBTI 성향 대결 (E·I / S·N / T·F / J·P): 모두 제 글자 편으로 논거를 쓰고, 모두 판정한다.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MBTI_TYPES, type MbtiType } from '@/design/mbti';
import { contestConfig } from '@/config/game';
import { createPgliteSql, createPostgresSql, type Sql } from '../db';
import { contestStandings } from '../contest';
import { DebateError, DebateService, type Viewer } from './service';
import { DebateStore } from './store';

const kst = (s: string) => new Date(`${s}+09:00`);

let sql: Sql;
let store: DebateStore;
let clock = kst('2026-11-02T09:00:00');
let service: DebateService;

/** mbti: 가입을 마친 주민의 MBTI (= 사는 마을). null이면 가입 전 */
async function user(mbti: MbtiType | null): Promise<Viewer> {
  const id = randomUUID();
  // Supabase에서는 auth.users가 로그인으로 채워진다. 테스트에서는 직접 넣는다.
  await sql.query(`insert into auth.users (id) values ($1)`, [id]);
  if (mbti) {
    await sql.query(`insert into public.profiles (id, district, mbti, onboarded_at) values ($1, $2, $2, now())`, [id, mbti]);
  }
  return { id };
}

async function expectError(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof DebateError && e.code === code);
}

// 기본은 PGlite(메모리). TEST_DATABASE_URL을 주면 운영과 같은 Postgres 드라이버(postgres.js)로 붙는다.
// 그 DB에는 auth 스키마와 마이그레이션이 미리 적용돼 있어야 하고, 비어 있어야 한다.
// PGlite(WebAssembly Postgres)는 처음 띄울 때 몇 초 걸린다
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  sql = url ? await createPostgresSql(url) : await createPgliteSql();
  store = new DebateStore(sql);
  service = new DebateService(store, () => clock);
}, 60_000);

afterAll(async () => {
  await sql.close();
});

describe('하루 경기 흐름', () => {
  let matchId: string;
  let a1: Viewer, a2: Viewer, a3: Viewer, b1: Viewer, b2: Viewer, b3: Viewer, stranger: Viewer;
  let teamA: MbtiType[], teamB: MbtiType[];

  it('오늘 경기를 한 번만 만든다 (동시에 요청해도). 첫 경기는 E·I 대결', async () => {
    const [m1, m2, m3] = await Promise.all([service.currentMatch(), service.currentMatch(), service.currentMatch()]);
    expect(new Set([m1.id, m2.id, m3.id]).size).toBe(1);
    expect(m1.key).toBe('2026-11-02#0');
    expect(m1.seq).toBe(0);
    matchId = m1.id;
    expect(m1.teamA.kind).toBe('axis');
    expect([m1.teamA.id, m1.teamB.id].sort()).toEqual(['E', 'I']);
    expect(m1.topic.id).toMatch(/^ei-|^movie-alone$|^reply-speed$/);
    teamA = m1.teamA.members as MbtiType[];
    teamB = m1.teamB.members as MbtiType[];
    expect(teamA).toHaveLength(8);
    a1 = await user(teamA[0]);
    a2 = await user(teamA[1]);
    a3 = await user(teamA[2]);
    b1 = await user(teamB[0]);
    b2 = await user(teamB[1]);
    b3 = await user(teamB[2]);
    stranger = await user(null);
  });

  it('논거는 MBTI가 있는 주민이 제 글자 편으로, 규칙에 맞게 낸다', async () => {
    await expectError(service.submitArgument(null, '로그인 없이 쓰는 논거입니다'), 'login_required');
    await expectError(service.submitArgument(stranger, '가입을 마치지 않고 쓰는 논거'), 'resident_required');
    await expectError(service.submitArgument(a1, '짧음'), 'too_short');
    await expectError(service.submitArgument(a1, '가'.repeat(301)), 'too_long');
    await expectError(service.submitArgument(a1, '상대 유형은 다 멍청해서 틀렸어요'), 'rejected');

    const arg = await service.submitArgument(a1, '첫 번째 논거입니다. 왜냐하면 이유가 있기 때문입니다.');
    expect(arg).toMatchObject({ side: 'a', authorMbti: teamA[0] });
    await expectError(service.submitArgument(a1, '두 번째로 내는 논거입니다'), 'limit');
    clock = kst('2026-11-02T10:00:00');
    await service.submitArgument(a2, '두 번째 사람의 논거입니다. 예를 들어 실제로 그렇습니다.');
    clock = kst('2026-11-02T11:00:00');
    await service.submitArgument(a3, '세 번째 사람의 논거입니다. 하지만 상대 입장도 있습니다.');
    const argB = await service.submitArgument(b1, 'B편의 논거입니다. 그러나 반대로 생각해 보면 이렇습니다.');
    expect(argB).toMatchObject({ side: 'b', authorMbti: teamB[0] });
  });

  it('추천은 같은 편 다른 사람 논거에만, 다시 누르면 취소된다', async () => {
    const args = await store.listArguments(matchId);
    const [arg1, arg2, arg3] = args.filter((x) => x.side === 'a');
    const argB = args.find((x) => x.side === 'b')!;
    await expectError(service.recommend(a1, arg1.id, true), 'own_argument');
    await expectError(service.recommend(a1, argB.id, true), 'other_team');
    await expectError(service.recommend(stranger, arg1.id, true), 'resident_required');
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

  it('작성 시간에는 판정할 수 없다', async () => {
    const [any] = await store.listArguments(matchId);
    await expectError(service.vote(b2, any.id), 'wrong_phase');
  });

  it('판정 시간: 모두 대표 논거 하나를 한 번 고른다 (제 편 논거도 된다)', async () => {
    clock = kst('2026-11-02T19:00:00');
    await expectError(service.submitArgument(b2, '시간이 지난 뒤에 쓰는 논거'), 'wrong_phase');
    const args = await store.listArguments(matchId);
    const argA1 = args.find((x) => x.authorId === a1.id)!;
    const argA3 = args.find((x) => x.authorId === a3.id)!;
    const argB = args.find((x) => x.side === 'b')!;
    await expectError(service.recommend(a2, argA1.id, true), 'wrong_phase');
    await expectError(service.vote(stranger, argB.id), 'resident_required');
    await expectError(service.vote(a1, 7), 'bad_request');

    // A편 세 유형 중 둘이 B 논거에 설득됐고, B편 세 유형 중 하나만 A 논거로 넘어갔다: B가 마음을 더 많이 돌렸다
    await service.vote(a1, argA3.id);
    await service.vote(a2, argB.id);
    await service.vote(a3, argB.id);
    await service.vote(b1, argB.id);
    await service.vote(b2, argB.id);
    await service.vote(b3, argA3.id);
    await expectError(service.vote(a1, argB.id), 'already_voted');

    const view = await service.view(await service.getMatch(matchId), a2);
    expect(view.phase).toBe('voting');
    expect(view.me).toMatchObject({ mbti: teamA[1], side: 'a', canVote: true, vote: { side: 'b', argumentId: argB.id } });
    expect(view.arguments.filter((x) => x.representative)).toHaveLength(4); // A 3개 + B 1개
    expect(view.arguments[0].representative).toBe(true);
    expect(view.arguments.every((x) => x.picks === null)).toBe(true); // 발표 전에는 표 수를 숨긴다
    expect(view.result).toBeNull();

    const mine = await service.view(await service.getMatch(matchId), a1);
    expect(mine.me).toMatchObject({ mbti: teamA[0], side: 'a', canVote: true, argumentsLeft: 0 });
    expect(mine.arguments.filter((x) => x.mine)).toHaveLength(1);
  });

  it('대표 논거가 아닌 논거는 고를 수 없다', async () => {
    const extra = await user(teamB[3]);
    // 이 경기는 논거가 모두 대표 논거라 없는 id로 확인한다
    await expectError(service.vote(extra, randomUUID()), 'not_representative');
  });

  it('발표: 유형별 판정으로 승패, 가장 많이 뽑힌 이긴 편 논거가 결정타', async () => {
    clock = kst('2026-11-02T21:05:00');
    // 동시에 집계해도 한 번만
    const [x, y] = await Promise.all([service.finalizeDue(), service.finalizeDue()]);
    const done = [...x, ...y];
    expect(done).toHaveLength(1);
    const r = done[0].result!;
    expect(r.voters).toBe(6);
    expect(r.vote.b).toBeGreaterThan(50);
    expect(r.winner).toBe('b');
    const argB = (await store.listArguments(matchId)).find((x) => x.side === 'b')!;
    expect(r.decisive).toMatchObject({ argumentId: argB.id, side: 'b', picks: 4 });
    expect(r.representative.a).toHaveLength(3);
    expect(Object.keys(r.byType!)).toHaveLength(6);
    expect(r.byDistrict).toBeUndefined();
    expect(r.summary).toContain('6개 유형, 6명');
    expect(await service.finalizeDue()).toHaveLength(0);

    const view = await service.view(await service.getMatch(matchId), null);
    expect(view.phase).toBe('done');
    expect(view.me.loggedIn).toBe(false);
    expect(view.result?.winner).toBe('b');
    expect(view.arguments.find((a) => a.id === argB.id)?.picks).toBe(4);
  });

  it('토론 활동은 내 MBTI 마을의 대항전 점수가 되고, 이긴 편 여덟 마을은 그 주 점수에 +30점', async () => {
    const pts = await sql.query<{ user_id: string; district: string; points: number }>(`select user_id, district, points from public.contest_points where kind = 'debate'`);
    const of = (v: Viewer) => pts.filter((p) => p.user_id === v.id).reduce((n, p) => n + Number(p.points), 0);
    expect(of(a1)).toBeGreaterThanOrEqual(contestConfig.points.argument);
    expect(of(b1)).toBeGreaterThanOrEqual(contestConfig.points.argument);
    expect(pts.find((p) => p.user_id === b1.id)?.district).toBe(teamB[0]);
    const [voted] = await sql.query<{ n: number }>(
      `select coalesce(sum(cp.points), 0)::int as n from public.contest_points cp where cp.kind = 'debate' and cp.user_id in (select user_id from public.votes where match_id = $1)`,
      [matchId],
    );
    // 판정한 여섯 명 모두 논거·추천도 했거나 판정만 했다: 판정 점수는 빠짐없이 들어 있다
    expect(Number(voted.n)).toBeGreaterThanOrEqual(6 * contestConfig.points.vote);
    const s = await contestStandings(sql, clock);
    expect(s.districts).toHaveLength(16);
    for (const t of teamB) expect(s.districts.find((d) => d.district === t)!.debateWins).toBe(1);
    for (const t of teamA) expect(s.districts.find((d) => d.district === t)!.debateWins).toBe(0);
    // 아무도 활동하지 않은 B편 마을도 이긴 만큼은 받는다
    expect(s.districts.find((d) => d.district === teamB[7])!.score).toBe(contestConfig.points.debateWin);
    expect(s.districts.find((d) => d.district === teamB[0])!.score).toBeGreaterThanOrEqual(contestConfig.points.debateWin + contestConfig.points.argument);
  });

  it('다음 날에는 새 경기: 다음 축(S·N)과 그 축의 주제', async () => {
    const before = await service.getMatch(matchId);
    clock = kst('2026-11-03T00:30:00');
    const next = await service.currentMatch();
    expect(next.key).toBe('2026-11-03#0');
    expect(next.seq).toBe(1);
    expect([next.teamA.id, next.teamB.id].sort()).toEqual(['N', 'S']);
    expect(next.topic.id).not.toBe(before.topic.id);
    const view = await service.view(next, null);
    expect(view.recent.map((x) => x.id)).toContain(matchId);
    // 주제의 첫 번째 입장을 자연스럽게 맡는 글자가 A편
    const { TOPICS } = await import('@/shared/topics');
    const t = TOPICS.find((x) => x.id === next.topic.id)!;
    expect(t.axis).toBe('SN');
    expect(next.teamA.id).toBe(t.a);
  });

  it('아무도 판정하지 않으면 무승부', async () => {
    clock = kst('2026-11-03T21:01:00');
    const m = await service.withResult(await service.currentMatch());
    expect(m.status).toBe('done');
    expect(m.result).toMatchObject({ winner: 'draw', voters: 0, decisive: null });
  });

  it('16유형 모두 어느 한쪽 편이다', async () => {
    const m = await service.getMatch(matchId);
    expect(new Set([...m.teamA.members, ...m.teamB.members])).toEqual(new Set(MBTI_TYPES));
  });
});
