import { describe, expect, it } from 'vitest';
import { MBTI_TYPES } from '../design/mbti';
import { compat, compatScore } from './compat';

describe('MBTI 궁합', () => {
  it('모든 짝에 풀이가 있고 하트는 1~5, 순서를 바꿔도 같다', () => {
    for (const a of MBTI_TYPES) for (const b of MBTI_TYPES) {
      const c = compat(a, b);
      expect(c.hearts).toBeGreaterThanOrEqual(1);
      expect(c.hearts).toBeLessThanOrEqual(5);
      expect(c.text.length).toBeGreaterThan(5);
      expect(c.tip.length).toBeGreaterThan(3);
      expect(compat(b, a).hearts).toBe(c.hearts);
    }
  });

  it('인식이 같고 생활 방식이 같으며 나머지가 다르면 찰떡', () => {
    expect(compat('ENFP', 'INTP').hearts).toBe(5);
    expect(compat('ENFP', 'INTP').title).toBe('찰떡 궁합');
    expect(compatScore('ESTJ', 'ESTJ')).toBeLessThan(compatScore('ESTJ', 'ISFJ'));
  });

  it('같은 유형은 거울 궁합', () => {
    expect(compat('INFJ', 'INFJ').title).toBe('거울 궁합');
  });

  it('하트가 고르게 나온다 (다 같은 점수가 아니다)', () => {
    const seen = new Set(MBTI_TYPES.flatMap((a) => MBTI_TYPES.map((b) => compat(a, b).hearts)));
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });
});
