import { describe, expect, it } from 'vitest';
import {
  canVote, clip, currentSlot, decideWinner, decisiveArgument, localDate, matchupCycle, matchupFor, phaseOf, pickTopic,
  representatives, sideOf, tallyByDistrict, voteScore, voterDistricts, type Argument, type VoteRecord,
} from './debate';
import { DISTRICTS } from './districts';
import { TOPICS } from './topics';

const kst = (s: string) => new Date(`${s}+09:00`);

describe('시간표', () => {
  it('한국 날짜 기준으로 오늘 경기 칸을 고른다', () => {
    const slot = currentSlot(kst('2026-11-02T01:30:00'));
    expect(slot.key).toBe('2026-11-02#0');
    expect(slot.opensAt.toISOString()).toBe(kst('2026-11-02T00:00:00').toISOString());
    expect(slot.writingEndsAt.toISOString()).toBe(kst('2026-11-02T18:00:00').toISOString());
    expect(slot.votingEndsAt.toISOString()).toBe(kst('2026-11-02T21:00:00').toISOString());
    // UTC로는 전날이지만 한국은 이미 다음 날
    expect(localDate(new Date('2026-11-01T16:00:00Z'))).toBe('2026-11-02');
  });

  it('하루 2경기면 지금 열린 마지막 칸, 아직 아무것도 안 열렸으면 어제 마지막 칸', () => {
    const slots = [
      { opensAt: '09:00', writingEndsAt: '13:00', votingEndsAt: '14:00' },
      { opensAt: '15:00', writingEndsAt: '20:00', votingEndsAt: '22:00' },
    ];
    expect(currentSlot(kst('2026-11-02T10:00:00'), slots).key).toBe('2026-11-02#0');
    expect(currentSlot(kst('2026-11-02T16:00:00'), slots).key).toBe('2026-11-02#1');
    expect(currentSlot(kst('2026-11-02T08:00:00'), slots).key).toBe('2026-11-01#1');
  });

  it('자정을 넘기는 칸은 다음 날로 계산한다', () => {
    const s = currentSlot(kst('2026-11-02T21:00:00'), [{ opensAt: '20:00', writingEndsAt: '23:00', votingEndsAt: '01:00' }]);
    expect(s.votingEndsAt.toISOString()).toBe(kst('2026-11-03T01:00:00').toISOString());
  });

  it('단계를 시각으로 정한다', () => {
    const m = { writingEndsAt: kst('2026-11-02T18:00:00'), votingEndsAt: kst('2026-11-02T21:00:00'), status: 'open' as const };
    expect(phaseOf(m, kst('2026-11-02T17:59:59'))).toBe('writing');
    expect(phaseOf(m, kst('2026-11-02T18:00:00'))).toBe('voting');
    expect(phaseOf(m, kst('2026-11-02T21:00:00'))).toBe('judging');
    expect(phaseOf({ ...m, status: 'done' }, kst('2026-11-02T10:00:00'))).toBe('done');
  });
});

describe('대진', () => {
  it('지역 대진은 다섯 지역에서 두 곳씩 10가지를 한 바퀴 다 돌기 전에 반복하지 않는다', () => {
    const cycle = matchupCycle();
    expect(cycle).toHaveLength(10);
    const keys = new Set(cycle.map(([a, b]) => [a.id, b.id].sort().join('-')));
    expect(keys.size).toBe(10);
    // 한 바퀴 안에서 모든 지역이 4번씩 출전한다
    for (const d of DISTRICTS) expect(cycle.filter(([a, b]) => a.id === d || b.id === d)).toHaveLength(4);
    // 한 바퀴 안에서는 같은 지역이 이틀 연속 출전하지 않는다 (바퀴가 넘어가는 날은 한 지역이 겹칠 수밖에 없다)
    for (let i = 0; i + 1 < cycle.length; i++) {
      const [a, b] = cycle[i];
      const [c, d] = cycle[i + 1];
      expect([c.id, d.id]).not.toContain(a.id);
      expect([c.id, d.id]).not.toContain(b.id);
    }
    const m = matchupFor(3);
    expect(m.teamA.kind).toBe('district');
    expect(m.teamA.label).toMatch(/지역/);
    expect(m.teamA.id).not.toBe(m.teamB.id);
    const again = matchupFor(13);
    expect([again.teamA.id, again.teamB.id].sort()).toEqual([m.teamA.id, m.teamB.id].sort());
  });

  it('주제는 가장 오래 안 쓴 것부터', () => {
    const used = new Map([[TOPICS[0].id, 5], [TOPICS[1].id, 3]]);
    expect(pickTopic(TOPICS.slice(0, 3), used).id).toBe(TOPICS[2].id);
    expect(pickTopic(TOPICS.slice(0, 2), used).id).toBe(TOPICS[1].id);
  });
});

describe('참여 자격', () => {
  const match = matchupFor(0);

  it('출전 두 지역 주민이 팀, 나머지 세 지역 주민이 관전자', () => {
    const a = match.teamA.id as (typeof DISTRICTS)[number];
    const b = match.teamB.id as (typeof DISTRICTS)[number];
    expect(sideOf(match, a)).toBe('a');
    expect(sideOf(match, b)).toBe('b');
    expect(canVote(match, a)).toBe(false);
    const voters = voterDistricts(match);
    expect(voters).toHaveLength(3);
    expect(voters).not.toContain(a);
    for (const d of voters) {
      expect(sideOf(match, d)).toBeNull();
      expect(canVote(match, d)).toBe(true);
    }
    expect(sideOf(match, null)).toBeNull();
    expect(canVote(match, null)).toBe(false);
  });
});

describe('집계', () => {
  const arg = (id: string, side: 'a' | 'b', rec: number, t: number): Argument => ({
    id, matchId: 'm', authorId: null, authorDistrict: 'wood', authorMbti: 'ENTP', side, body: id, createdAt: new Date(t), recommendations: rec,
  });

  it('대표 논거는 추천 순, 같으면 먼저 쓴 순', () => {
    const args = [arg('1', 'a', 2, 3), arg('2', 'a', 5, 2), arg('3', 'a', 2, 1), arg('4', 'b', 9, 1), arg('5', 'a', 0, 0)];
    expect(representatives(args, 'a').map((a) => a.id)).toEqual(['2', '3', '1']);
  });

  const v = (voterDistrict: VoteRecord['voterDistrict'], side: VoteRecord['side']): VoteRecord => ({ voterDistrict, side, argumentId: null });

  it('사람이 많은 지역이 판정을 좌우하지 않는다', () => {
    const votes: VoteRecord[] = [
      ...Array.from({ length: 30 }, () => v('earth', 'a')),
      ...Array.from({ length: 3 }, () => v('metal', 'b')),
      ...Array.from({ length: 3 }, () => v('water', 'b')),
    ];
    const byDistrict = voteScore(votes, 'byDistrict');
    const raw = voteScore(votes, 'none');
    expect(raw.a).toBeGreaterThan(80);
    expect(byDistrict.a).toBeLessThan(50); // 세 지역 중 두 지역이 B
    expect(byDistrict.a + byDistrict.b).toBeCloseTo(100);
    expect(voteScore([])).toEqual({ a: 50, b: 50 });
  });

  it('판정 점수가 높은 지역이 이기고, 같으면 표 수로, 그래도 같으면 무승부', () => {
    expect(decideWinner([])).toBe('draw');
    expect(decideWinner([v('metal', 'a'), v('water', 'b'), v('water', 'b')])).toBe('b');
    expect(decideWinner([v('metal', 'a'), v('water', 'b')])).toBe('draw');
    expect(tallyByDistrict([v('metal', 'a'), v('metal', 'b'), v('metal', 'a')])).toEqual({ metal: { a: 2, b: 1 } });
  });

  it('결정타 논거는 가장 많이 뽑힌 것, 같으면 추천 많은 것', () => {
    const reps = [arg('1', 'a', 1, 1), arg('2', 'a', 5, 2), arg('3', 'a', 0, 3)];
    expect(decisiveArgument(reps, { 1: 4, 2: 1 })?.id).toBe('1');
    expect(decisiveArgument(reps, { 1: 2, 2: 2 })?.id).toBe('2');
    expect(decisiveArgument(reps, {})).toBeNull();
  });

  it('결과 카드 논거는 40자로 자른다', () => {
    expect(clip('가'.repeat(50))).toHaveLength(40);
    expect(clip('짧은 논거')).toBe('짧은 논거');
  });
});

describe('주제 목록', () => {
  it('id가 겹치지 않고 양쪽 입장이 모두 있다', () => {
    expect(new Set(TOPICS.map((t) => t.id)).size).toBe(TOPICS.length);
    for (const t of TOPICS) {
      expect(t.sideA && t.sideB && t.title).toBeTruthy();
      expect(t.id).toMatch(/^[a-z0-9-]+$/);
    }
  });
});
