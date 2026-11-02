import { describe, expect, it } from 'vitest';
import { SURVEY, isSurveyComplete, scoreSurvey, type Choice } from './survey';

const all = (c: Choice) => Object.fromEntries(SURVEY.map((q) => [q.id, c]));

describe('survey', () => {
  it('축마다 3문항씩 12문항이다', () => {
    expect(SURVEY).toHaveLength(12);
    for (const axis of ['EI', 'SN', 'TF', 'JP']) expect(SURVEY.filter((q) => q.axis === axis)).toHaveLength(3);
  });

  it('다수결로 글자를 정한다', () => {
    expect(scoreSurvey(all('a'))).toBe('ESTJ');
    expect(scoreSurvey(all('b'))).toBe('INFP');
    const mixed = { ...all('b'), ei1: 'a', ei2: 'a', tf1: 'a', tf2: 'a' } as Record<string, Choice>;
    expect(scoreSurvey(mixed)).toBe('ENTP');
  });

  it('답이 빠지면 결과를 내지 않는다', () => {
    const partial = all('a');
    delete partial.jp3;
    expect(isSurveyComplete(partial)).toBe(false);
    expect(() => scoreSurvey(partial)).toThrow();
  });
});
