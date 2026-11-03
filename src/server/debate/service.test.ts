// 하루 경기 흐름을 실제 Postgres(PGlite, 메모리)와 가짜 시계로 확인한다.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MbtiType } from '@/design/mbti';
import { DISTRICTS, type District } from '@/shared/districts';
import { createPgliteSql, createPostgresSql, type Sql } from '../db';
import { DebateError, DebateService, type Viewer } from './service';
import { DebateStore } from './store';

const kst = (s: string) => new Date(`${s}+09:00`);

let sql: Sql;
let store: DebateStore;
let clock = kst('2026-11-02T09:00:00');
let service: DebateService;

/** district: 가입을 마친 주민의 지역 (null이면 가입 전). mbti: 프로필 태그 (토론 편과 상관없다) */
async function user(district: District | null, mbti?: MbtiType): Promise<Viewer> {
  const id = randomUUID();
  // Supabase에서는 auth.users가 로그인으로 채워진다. 테스트에서는 직접 넣는다.
  await sql.query(`insert into auth.users (id) values ($1)`, [id]);
  if (district) {
    await sql.query(`insert into public.profiles (id, district, onboarded_at) values ($1, $2, now())`, [id, district]);
  }
  if (mbti) await store.setMbti(id, mbti, new Date('2026-10-01'));
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
  let a1: Viewer, a2: Viewer, a3: Viewer, b1: Viewer, spectators: Viewer[], stranger: Viewer;
  let teamA: District, teamB: District;

  it('오늘 경기를 한 번만 만든다 (동시에 요청해도)', async () => {
    const [m1, m2, m3] = await Promise.all([service.currentMatch(), service.currentMatch(), service.currentMatch()]);
    expect(new Set([m1.id, m2.id, m3.id]).size).toBe(1);
    expect(m1.key).toBe('2026-11-02#0');
    expect(m1.seq).toBe(0);
    matchId = m1.id;
    expect(m1.teamA.kind).toBe('district');
    teamA = m1.teamA.id as District;
    teamB = m1.teamB.id as District;
    // MBTI 태그는 제각각이어도 편은 지역으로 정해진다
    a1 = await user(teamA, 'ENTP');
    a2 = await user(teamA, 'ISFJ');
    a3 = await user(teamA);
    b1 = await user(teamB, 'ENTP');
    const others = DISTRICTS.filter((d) => d !== teamA && d !== teamB);
    expect(others).toHaveLength(3);
    // 같은 지역 3명 + 다른 지역 2명
    spectators = await Promise.all([others[0], others[0], others[0], others[1], others[2]].map((d) => user(d)));
    stranger = await user(null, 'INTJ');
  });

  it('논거는 출전 지역 주민만, 규칙에 맞게 낼 수 있다', async () => {
    await expectError(service.submitArgument(null, '로그인 없이 쓰는 논거입니다'), 'login_required');
    await expectError(service.submitArgument(stranger, '가입을 마치지 않고 쓰는 논거'), 'resident_required');
    await expectError(service.submitArgument(spectators[0], '관전자가 쓰는 논거입니다'), 'not_team');
    await expectError(service.submitArgument(a1, '짧음'), 'too_short');
    await expectError(service.submitArgument(a1, '가'.repeat(301)), 'too_long');
    await expectError(service.submitArgument(a1, '상대 유형은 다 멍청해서 틀렸어요'), 'rejected');

    const arg = await service.submitArgument(a1, '첫 번째 논거입니다. 왜냐하면 이유가 있기 때문입니다.');
    expect(arg).toMatchObject({ side: 'a', authorDistrict: teamA, authorMbti: 'ENTP' });
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

  it('작성 시간에는 판정할 수 없다', async () => {
    const [any] = await store.listArguments(matchId);
    await expectError(service.vote(spectators[0], any.id), 'wrong_phase');
  });

  it('판정 시간: 관전자만 대표 논거 하나를 한 번 고른다', async () => {
    clock = kst('2026-11-02T19:00:00');
    await expectError(service.submitArgument(a1, '시간이 지난 뒤에 쓰는 논거'), 'wrong_phase');
    const args = await store.listArguments(matchId);
    const argA1 = args.find((x) => x.authorId === a1.id)!;
    const argA3 = args.find((x) => x.authorId === a3.id)!;
    const argB = args.find((x) => x.side === 'b')!;
    await expectError(service.recommend(a2, argA1.id, true), 'wrong_phase');
    await expectError(service.vote(a1, argB.id), 'not_voter');
    await expectError(service.vote(stranger, argB.id), 'resident_required');
    await expectError(service.vote(spectators[0], 7), 'bad_request');

    // 같은 지역 3명은 B 논거, 다른 두 지역은 A의 세 번째 논거: 지역별로 세면 A가 앞선다
    await service.vote(spectators[0], argB.id);
    await service.vote(spectators[1], argB.id);
    await service.vote(spectators[2], argB.id);
    await service.vote(spectators[3], argA3.id);
    await service.vote(spectators[4], argA3.id);
    await expectError(service.vote(spectators[0], argA3.id), 'already_voted');

    const view = await service.view(await service.getMatch(matchId), spectators[0]);
    expect(view.phase).toBe('voting');
    expect(view.me).toMatchObject({ district: expect.any(String), canVote: true, side: null, vote: { side: 'b', argumentId: argB.id } });
    expect(view.arguments.filter((x) => x.representative)).toHaveLength(4); // A 3개 + B 1개
    expect(view.arguments[0].representative).toBe(true);
    expect(view.arguments.every((x) => x.picks === null)).toBe(true); // 발표 전에는 표 수를 숨긴다
    expect(view.result).toBeNull();

    const mine = await service.view(await service.getMatch(matchId), a1);
    expect(mine.me).toMatchObject({ district: teamA, side: 'a', canVote: false, argumentsLeft: 0 });
    expect(mine.arguments.filter((x) => x.mine)).toHaveLength(1);
  });

  it('대표 논거가 아닌 논거는 고를 수 없다', async () => {
    const extra = await user(DISTRICTS.find((d) => d !== teamA && d !== teamB)!);
    // 이 경기는 논거가 모두 대표 논거라 없는 id로 확인한다
    await expectError(service.vote(extra, randomUUID()), 'not_representative');
  });

  it('발표: 지역별 판정으로 승패, 가장 많이 뽑힌 승리 지역 논거가 결정타', async () => {
    clock = kst('2026-11-02T21:05:00');
    // 동시에 집계해도 한 번만
    const [x, y] = await Promise.all([service.finalizeDue(), service.finalizeDue()]);
    const done = [...x, ...y];
    expect(done).toHaveLength(1);
    const r = done[0].result!;
    expect(r.voters).toBe(5);
    expect(r.vote.a).toBeGreaterThan(50);
    expect(r.winner).toBe('a');
    const argA3 = (await store.listArguments(matchId)).find((x) => x.authorId === a3.id)!;
    expect(r.decisive).toMatchObject({ argumentId: argA3.id, side: 'a', picks: 2 });
    expect(r.representative.a).toHaveLength(3);
    expect(Object.keys(r.byDistrict!)).toHaveLength(3);
    expect(r.byType).toBeUndefined();
    expect(r.summary).toContain('3곳, 5명');
    expect(await service.finalizeDue()).toHaveLength(0);


    const view = await service.view(await service.getMatch(matchId), null);
    expect(view.phase).toBe('done');
    expect(view.me.loggedIn).toBe(false);
    expect(view.result?.winner).toBe('a');
    expect(view.arguments.find((a) => a.id === argA3.id)?.picks).toBe(2);
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

  it('아무도 판정하지 않으면 무승부', async () => {
    clock = kst('2026-11-03T21:01:00');
    const m = await service.withResult(await service.currentMatch());
    expect(m.status).toBe('done');
    expect(m.result).toMatchObject({ winner: 'draw', voters: 0, decisive: null });
  });

  it('MBTI 태그는 바꾼 뒤 7일 동안 다시 바꿀 수 없다', async () => {
    const u = await user(null);
    await service.setMbti(u, 'ENFP');
    await expectError(service.setMbti(u, 'ISTJ'), 'cooldown');
    await service.setMbti(u, 'ENFP'); // 같은 값은 괜찮다
    await expectError(service.setMbti(u, 'XXXX'), 'bad_request');
  });
});
