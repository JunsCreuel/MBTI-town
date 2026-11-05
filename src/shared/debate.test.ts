import { describe, expect, it } from 'vitest';
import { MBTI_TYPES } from '../design/mbti';
import {
  AXES, axisFor, axisTeam, canVote, clip, currentSlot, decideWinner, decisiveArgument, localDate, otherLetter, phaseOf, pickTopic,
  representatives, sideOf, tallyByType, teamsFor, voteScore, type Argument, type VoteRecord,
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

describe('대진: 성향 대결', () => {
  it('날마다 E·I → S·N → T·F → J·P를 돌고, 편마다 그 글자를 가진 여덟 유형이 나온다', () => {
    expect([0, 1, 2, 3, 4].map(axisFor)).toEqual(['EI', 'SN', 'TF', 'JP', 'EI']);
    for (const axis of AXES) {
      const a = axisTeam(axis[0] as 'E');
      const b = axisTeam(otherLetter(axis[0] as 'E'));
      expect(a.kind).toBe('axis');
      expect(a.members).toHaveLength(8);
      expect(b.members).toHaveLength(8);
      // 두 편을 합치면 16유형 모두
      expect(new Set([...a.members, ...b.members]).size).toBe(16);
    }
    expect(axisTeam('T').label).toBe('T(사고)');
    expect(axisTeam('T').members).toContain('INTJ');
    expect(axisTeam('T').members).not.toContain('INFJ');
  });

  it('주제의 첫 번째 입장을 자연스럽게 맡는 글자가 A편이다', () => {
    const accident = TOPICS.find((t) => t.id === 'tf-accident')!;
    const { teamA, teamB } = teamsFor(accident, 'TF');
    expect(teamA.id).toBe('T');
    expect(teamB.id).toBe('F');
    const solo = TOPICS.find((t) => t.id === 'ei-solo-travel')!;
    expect(teamsFor(solo, 'EI').teamA.id).toBe('I');
    // 축이 다른(또는 없는) 주제면 축의 앞 글자가 A
    expect(teamsFor({ id: 'x', title: 'x', sideA: 'a', sideB: 'b' }, 'JP').teamA.id).toBe('J');
  });

  it('주제는 그날 축의 주제 가운데 가장 오래 안 쓴 것부터 (그 축 주제가 없으면 아무 주제)', () => {
    const tf = TOPICS.filter((t) => t.axis === 'TF');
    const used = new Map(tf.slice(0, -1).map((t, i) => [t.id, i + 1]));
    expect(pickTopic(TOPICS, used, 'TF').id).toBe(tf.at(-1)!.id);
    expect(pickTopic(TOPICS, new Map(), 'SN').axis).toBe('SN');
    const plain = TOPICS.filter((t) => !t.axis).slice(0, 3);
    const used2 = new Map([[plain[0].id, 5], [plain[1].id, 3]]);
    expect(pickTopic(plain, used2, 'EI').id).toBe(plain[2].id);
  });

  it('축마다 주제가 넉넉하다', () => {
    for (const axis of AXES) expect(TOPICS.filter((t) => t.axis === axis).length).toBeGreaterThanOrEqual(7);
  });
});

describe('참여 자격', () => {
  const match = teamsFor(TOPICS.find((t) => t.id === 'tf-accident')!, 'TF');

  it('모든 유형이 제 글자 편이고, MBTI가 있는 주민은 모두 판정한다', () => {
    expect(sideOf(match, 'INTJ')).toBe('a');
    expect(sideOf(match, 'ENFP')).toBe('b');
    for (const t of MBTI_TYPES) {
      expect(sideOf(match, t)).not.toBeNull();
      expect(canVote(match, t)).toBe(true);
    }
    expect(sideOf(match, null)).toBeNull();
    expect(sideOf(match, 'wood')).toBeNull();
    expect(canVote(match, null)).toBe(false);
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

  const v = (voterType: VoteRecord['voterType'], side: VoteRecord['side']): VoteRecord => ({ voterType, side, argumentId: null });

  it('사람이 많은 유형이 판정을 좌우하지 않는다', () => {
    const votes: VoteRecord[] = [
      ...Array.from({ length: 30 }, () => v('ENFP', 'a')),
      ...Array.from({ length: 3 }, () => v('ISTJ', 'b')),
      ...Array.from({ length: 3 }, () => v('INTJ', 'b')),
    ];
    const byType = voteScore(votes, 'byType');
    const raw = voteScore(votes, 'none');
    expect(raw.a).toBeGreaterThan(80);
    expect(byType.a).toBeLessThan(50); // 세 유형 중 두 유형이 B
    expect(byType.a + byType.b).toBeCloseTo(100);
    expect(voteScore([])).toEqual({ a: 50, b: 50 });
  });

  it('판정 점수가 높은 편이 이기고, 같으면 표 수로, 그래도 같으면 무승부', () => {
    expect(decideWinner([])).toBe('draw');
    expect(decideWinner([v('INTJ', 'a'), v('ENFP', 'b'), v('ENFP', 'b')])).toBe('b');
    expect(decideWinner([v('INTJ', 'a'), v('ENFP', 'b')])).toBe('draw');
    expect(tallyByType([v('INTJ', 'a'), v('INTJ', 'b'), v('INTJ', 'a')])).toEqual({ INTJ: { a: 2, b: 1 } });
  });

  it('제 편만 고르면 반반이고, 상대편 마음을 더 돌린 편이 이긴다', () => {
    // T 유형 둘은 모두 T, F 유형 둘 중 한 유형이 T로 넘어왔다
    const votes = [v('INTJ', 'a'), v('ESTP', 'a'), v('INFP', 'b'), v('ENFJ', 'a')];
    expect(voteScore([v('INTJ', 'a'), v('INFP', 'b')], 'byType')).toEqual({ a: 50, b: 50 });
    expect(decideWinner(votes)).toBe('a');
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
