import { describe, expect, it } from 'vitest';
import { MBTI_TYPES } from '../design/mbti';
import { AXES, type AxisLetter } from './debate';
import { MBTI_TEST, scoreMbtiTest } from './mbtiTest';

describe('MBTI 간단 테스트', () => {
  it('12문항, 축마다 3문항이라 비기지 않고, 두 답은 그 축의 두 글자다', () => {
    expect(MBTI_TEST).toHaveLength(12);
    expect(new Set(MBTI_TEST.map((q) => q.id)).size).toBe(12);
    for (const axis of AXES) {
      const qs = MBTI_TEST.filter((q) => q.axis === axis);
      expect(qs).toHaveLength(3);
      for (const q of qs) expect([q.a.letter, q.b.letter].sort()).toEqual([...axis].sort());
    }
  });

  it('모든 문항에 답해야 결과가 나오고, 축마다 많이 고른 글자로 유형을 정한다', () => {
    const pick = (fn: (q: (typeof MBTI_TEST)[number]) => AxisLetter) => Object.fromEntries(MBTI_TEST.map((q) => [q.id, fn(q)]));
    expect(scoreMbtiTest({})).toBeNull();
    expect(scoreMbtiTest(pick((q) => q.a.letter))).toBe('ESTJ');
    expect(scoreMbtiTest(pick((q) => q.b.letter))).toBe('INFP');
    // E·I 축은 3문항 중 2개가 I면 I
    const mixed = pick((q) => q.a.letter);
    const ei = MBTI_TEST.filter((q) => q.axis === 'EI');
    mixed[ei[0].id] = 'I';
    mixed[ei[1].id] = 'I';
    expect(scoreMbtiTest(mixed)).toBe('ISTJ');
    // 다른 축 글자는 받지 않는다
    expect(scoreMbtiTest({ ...pick((q) => q.a.letter), [ei[2].id]: 'T' })).toBeNull();
  });

  it('16유형 모두 나올 수 있다', () => {
    const seen = new Set<string>();
    for (let mask = 0; mask < 16; mask++) {
      const answers = Object.fromEntries(MBTI_TEST.map((q) => [q.id, AXES.indexOf(q.axis) >= 0 && mask & (1 << AXES.indexOf(q.axis)) ? q.b.letter : q.a.letter]));
      const r = scoreMbtiTest(answers);
      if (r) seen.add(r);
    }
    expect(seen.size).toBe(16);
    for (const t of seen) expect(MBTI_TYPES).toContain(t);
  });
});
