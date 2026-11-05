import { describe, expect, it } from 'vitest';
import { safeNext } from './safeNext';

describe('safeNext (돌아갈 주소)', () => {
  it('우리 사이트 경로는 그대로', () => {
    expect(safeNext('/onboarding')).toBe('/onboarding');
    expect(safeNext('/login/reset?next=%2Fhome')).toBe('/login/reset?next=%2Fhome');
    expect(safeNext('/r/haru#top')).toBe('/r/haru#top');
  });
  it('다른 사이트로 가는 모양은 /home', () => {
    for (const bad of ['//evil.com', '/\\evil.com', '/%5Cevil.com', '/%09/evil.com', '/\t/evil.com', 'https://evil.com', 'evil.com', '', null, undefined, '/%0a/evil.com']) {
      expect(safeNext(bad as string)).toBe('/home');
    }
  });
});
