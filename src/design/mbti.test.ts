import { describe, expect, it } from 'vitest';
import { MBTI, MBTI_TYPES, groupOf, isMbtiType, mbtiColor, withMaxLightness } from './mbti';

describe('mbti', () => {
  it('16개 유형을 기질 그룹으로 나눈다', () => {
    expect(MBTI_TYPES).toHaveLength(16);
    expect(groupOf('ENTP')).toBe('NT');
    expect(groupOf('INFJ')).toBe('NF');
    expect(groupOf('ISFJ')).toBe('SJ');
    expect(groupOf('ESTP')).toBe('SP');
    for (const g of ['NT', 'NF', 'SJ', 'SP']) {
      expect(MBTI_TYPES.filter((t) => groupOf(t) === g)).toHaveLength(4);
    }
  });

  it('유형 색은 서로 다른 hex 값이다', () => {
    const colors = MBTI_TYPES.map(mbtiColor);
    for (const c of colors) expect(c).toMatch(/^#[0-9A-F]{6}$/);
    expect(new Set(colors).size).toBe(16);
  });

  it('설명은 네 글자를 풀어 쓴다', () => {
    expect(MBTI.ENTP.label).toBe('외향·직관·사고·인식');
  });

  it('유형 문자열을 검사한다', () => {
    expect(isMbtiType('INFP')).toBe(true);
    expect(isMbtiType('infp')).toBe(false);
    expect(isMbtiType('ABCD')).toBe(false);
    expect(isMbtiType(3)).toBe(false);
  });

  it('글자용 색은 너무 밝지 않게 낮춘다', () => {
    expect(withMaxLightness('#B3AEF7', 0.48)).not.toBe('#B3AEF7');
    expect(withMaxLightness('#2B2B33', 0.48)).toBe('#2B2B33');
  });
});
