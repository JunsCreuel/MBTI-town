import { describe, expect, it } from 'vitest';
import { townConfig } from '../config/game';
import { gesturePose, hopHeight } from './gesture';

const JUMP = townConfig.jumpMs / 1000;

describe('캐릭터 동작', () => {
  it('걸으면서 점프하면 점프 동작을 그리고 몸이 솟는다 (점프가 끊기지 않는다)', () => {
    const g = { action: 'jump' as const, actionStart: 10, actionUntil: 10 + JUMP };
    const mid = gesturePose(g, 10 + JUMP / 2, true, JUMP);
    expect(mid).toMatchObject({ clip: 'jump', clipStart: 10, stop: false });
    expect(mid.hop).toBeCloseTo(0.5);
    expect(hopHeight(mid.hop, townConfig.jumpHeight)).toBeCloseTo(townConfig.jumpHeight);
    // 점프가 끝나면 다시 걷는다
    expect(gesturePose(g, 10 + JUMP + 0.01, true, JUMP)).toMatchObject({ clip: 'walk', hop: undefined });
  });

  it('제자리 점프도 같은 길이로 한 번', () => {
    const g = { action: 'jump' as const, actionStart: 5, actionUntil: 5 + JUMP };
    expect(gesturePose(g, 5.1, false, JUMP).clip).toBe('jump');
    expect(gesturePose(g, 5 + JUMP + 0.01, false, JUMP).clip).toBe('idle');
  });

  it('다른 동작(응원 등)은 걸으면 끝난다', () => {
    const g = { action: 'cheer' as const, actionStart: 1, actionUntil: 3 };
    expect(gesturePose(g, 2, false, JUMP)).toMatchObject({ clip: 'cheer', stop: false });
    expect(gesturePose(g, 2, true, JUMP)).toMatchObject({ clip: 'walk', stop: true });
    expect(gesturePose(undefined, 2, true, JUMP)).toMatchObject({ clip: 'walk', stop: false });
    expect(gesturePose(undefined, 2, false, JUMP)).toMatchObject({ clip: 'idle', clipStart: 0 });
  });

  it('솟는 높이는 처음과 끝이 0이고 가운데가 가장 높다', () => {
    expect(hopHeight(0, 1)).toBe(0);
    expect(hopHeight(1, 1)).toBe(0);
    expect(hopHeight(undefined, 1)).toBe(0);
    expect(hopHeight(0.25, 1)).toBeLessThan(hopHeight(0.5, 1));
  });
});
