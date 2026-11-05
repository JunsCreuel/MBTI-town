import { describe, expect, it } from 'vitest';
import { withGwa, withIeyo, withRo } from './josa';

describe('조사', () => {
  it('받침에 맞춰 로/으로', () => {
    expect(withRo('클럽')).toBe('클럽으로');
    expect(withRo('낚시터')).toBe('낚시터로');
    expect(withRo('상가')).toBe('상가로');
    expect(withRo('서울')).toBe('서울로');
    expect(withRo('CLUB')).toBe('CLUB로');
  });
});

describe('이에요/예요', () => {
  it('받침이 있으면 이에요, 없으면 예요', () => {
    expect(['목', '화', '토', '금', '수'].map(withIeyo)).toEqual(['목이에요', '화예요', '토예요', '금이에요', '수예요']);
  });

  it('과/와: 괄호 앞 글자의 받침을 본다', () => {
    expect(withGwa('E(외향)')).toBe('E(외향)과');
    expect(withGwa('T(사고)')).toBe('T(사고)와');
    expect(withGwa('사과')).toBe('사과와');
  });
});
