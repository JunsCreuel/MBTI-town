import { describe, expect, it } from 'vitest';
import { MBTI_TYPES } from '../design/mbti';
import {
  canVote, clampCriteria, clip, currentSlot, finalScores, localDate, matchupCycle, matchupFor, phaseOf, pickTopic,
  representatives, sideOf, voteScore, voterTypes, type Argument, type VoteRecord,
} from './debate';
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
  it('유형 대진은 120가지를 한 바퀴 다 돌기 전에 반복하지 않는다', () => {
    const cycle = matchupCycle('type');
    expect(cycle).toHaveLength(120);
    const keys = new Set(cycle.map(([a, b]) => [a.id, b.id].sort().join('-')));
    expect(keys.size).toBe(120);
    const m = matchupFor(3);
    expect(m.teamA.label).toMatch(/^[EI][SN][TF][JP]팀$/);
    expect(m.teamA.id).not.toBe(m.teamB.id);
  });

  it('축 대전과 기질 그룹 대전', () => {
    const axis = matchupFor(0, 'axis');
    expect(axis.teamA.members).toHaveLength(8);
    expect([...axis.teamA.members, ...axis.teamB.members].sort()).toEqual([...MBTI_TYPES].sort());
    expect(matchupCycle('temperament')).toHaveLength(6);
    expect(matchupFor(1, 'temperament').teamA.members).toHaveLength(4);
  });

  it('주제는 가장 오래 안 쓴 것부터', () => {
    const used = new Map([[TOPICS[0].id, 5], [TOPICS[1].id, 3]]);
    expect(pickTopic(TOPICS.slice(0, 3), used).id).toBe(TOPICS[2].id);
    expect(pickTopic(TOPICS.slice(0, 2), used).id).toBe(TOPICS[1].id);
  });
});

describe('참여 자격', () => {
  const typeMatch = { teamA: matchupFor(0, 'type').teamA, teamB: matchupFor(0, 'type').teamB };

  it('유형 대진은 두 유형이 팀, 나머지 14개 유형이 관전자', () => {
    const a = typeMatch.teamA.members[0];
    expect(sideOf(typeMatch, a)).toBe('a');
    expect(canVote(typeMatch, a)).toBe(false);
    expect(voterTypes(typeMatch)).toHaveLength(14);
    expect(sideOf(typeMatch, null)).toBeNull();
  });

  it('축 대전은 모두가 팀이라 전원이 투표한다', () => {
    const axis = matchupFor(0, 'axis');
    expect(voterTypes(axis)).toHaveLength(16);
    expect(canVote(axis, 'ENTP')).toBe(true);
  });
});

describe('집계', () => {
  const arg = (id: string, side: 'a' | 'b', rec: number, t: number): Argument => ({
    id, matchId: 'm', authorId: null, authorMbti: 'ENTP', side, body: id, createdAt: new Date(t), recommendations: rec,
  });

  it('대표 논거는 추천 순, 같으면 먼저 쓴 순', () => {
    const args = [arg('1', 'a', 2, 3), arg('2', 'a', 5, 2), arg('3', 'a', 2, 1), arg('4', 'b', 9, 1), arg('5', 'a', 0, 0)];
    expect(representatives(args, 'a').map((a) => a.id)).toEqual(['2', '3', '1']);
  });

  it('사람이 많은 유형이 투표를 좌우하지 않는다', () => {
    const votes: VoteRecord[] = [
      ...Array.from({ length: 30 }, () => ({ voterMbti: 'ISFJ' as const, side: 'a' as const })),
      ...Array.from({ length: 3 }, () => ({ voterMbti: 'INTJ' as const, side: 'b' as const })),
      ...Array.from({ length: 3 }, () => ({ voterMbti: 'ESTP' as const, side: 'b' as const })),
    ];
    const byType = voteScore(votes, 'byType');
    const raw = voteScore(votes, 'none');
    expect(raw.a).toBeGreaterThan(80);
    expect(byType.a).toBeLessThan(50); // 세 유형 중 두 유형이 B
    expect(byType.a + byType.b).toBeCloseTo(100);
    expect(voteScore([])).toEqual({ a: 50, b: 50 });
  });

  it('AI 7 : 투표 3으로 합치고, 같으면 AI 점수로 가린다', () => {
    const r = finalScores({ a: 80, b: 70 }, { a: 40, b: 60 });
    expect(r.final).toEqual({ a: 68, b: 67 });
    expect(r.winner).toBe('a');
    expect(finalScores({ a: 70, b: 70 }, { a: 50, b: 50 }).winner).toBe('draw');
  });

  it('기준 점수는 상한을 넘지 않는다', () => {
    expect(clampCriteria({ logic: 40, factuality: -3, evidence: 12.6, rebuttal: NaN, relevance: 15 })).toEqual({
      logic: 25, factuality: 0, evidence: 13, rebuttal: 0, relevance: 15,
    });
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
