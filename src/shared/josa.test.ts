import { describe, expect, it } from 'vitest';
import { withRo } from './josa';

describe('조사', () => {
  it('받침에 맞춰 로/으로', () => {
    expect(withRo('클럽')).toBe('클럽으로');
    expect(withRo('낚시터')).toBe('낚시터로');
    expect(withRo('상가')).toBe('상가로');
    expect(withRo('서울')).toBe('서울로');
    expect(withRo('CLUB')).toBe('CLUB로');
  });
});
