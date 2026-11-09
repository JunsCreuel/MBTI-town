import { describe, expect, it } from 'vitest';
import { QUALITY, autoLow, resolveLow } from './quality';

describe('가벼운 모드', () => {
  it('휴대폰·저사양은 자동으로 가볍게, PC는 선명하게', () => {
    expect(autoLow({ touch: true, shortSide: 390 })).toBe(true);
    expect(autoLow({ touch: false, shortSide: 900, memory: 4 })).toBe(true);
    expect(autoLow({ touch: false, shortSide: 900, cores: 4 })).toBe(true);
    expect(autoLow({ touch: false, shortSide: 1080, memory: 16, cores: 12 })).toBe(false);
    expect(autoLow({ touch: true, shortSide: 1100, memory: 8, cores: 8 })).toBe(false);
  });

  it('고른 값이 자동보다 먼저다', () => {
    expect(resolveLow('low', { touch: false, shortSide: 1080, memory: 16, cores: 12 })).toBe(true);
    expect(resolveLow('high', { touch: true, shortSide: 390 })).toBe(false);
  });

  it('가벼운 모드는 더 적게 그린다', () => {
    expect(QUALITY.low.dpr[1]).toBeLessThan(QUALITY.high.dpr[1]);
    expect(QUALITY.low.maxPlayers).toBeLessThan(QUALITY.high.maxPlayers);
    expect(QUALITY.low.antialias).toBe(false);
  });
});
