import { describe, expect, it } from 'vitest';
import { elementConfig } from '../config/game';
import { CLIENT_SOURCES, ELEMENT_SOURCES, ELEMENTS, elementNeeds, weakestElement } from './elements';

describe('오행 채우기 규칙', () => {
  it('오늘 채울 칸은 기준보다 모자란 만큼 (넘치면 0)', () => {
    const need = elementNeeds({ wood: 0, fire: 1, earth: 2, metal: 4, water: 1 });
    expect(need).toEqual({ wood: elementConfig.target, fire: elementConfig.target - 1, earth: 0, metal: 0, water: elementConfig.target - 1 });
    // 빠진 오행은 0개로 본다
    expect(elementNeeds({}).wood).toBe(elementConfig.target);
  });

  it('가장 모자란 오행: 같으면 오행 순서대로 앞, 다 넉넉하면 없다', () => {
    expect(weakestElement({ wood: 1, fire: 0, earth: 3, metal: 0, water: 4 })).toBe('fire');
    expect(weakestElement({ wood: 2, fire: 2, earth: 1, metal: 2, water: 1 })).toBe('earth');
    expect(weakestElement({ wood: 2, fire: 2, earth: 2, metal: 2, water: 2 })).toBeNull();
  });

  it('화면이 알려 오는 놀이는 그 오행의 놀이 가운데 일부만', () => {
    for (const e of ELEMENTS) for (const s of CLIENT_SOURCES[e] ?? []) expect(ELEMENT_SOURCES[e] as readonly string[]).toContain(s);
    expect(CLIENT_SOURCES.wood).toBeUndefined();
    expect(CLIENT_SOURCES.water).toBeUndefined();
  });
});
