import { afterEach, describe, expect, it, vi } from 'vitest';
import { pointerState } from './pointer';

let ms = 10_000;
vi.spyOn(performance, 'now').mockImplementation(() => ms);

function press(holdMs: number, moves: [number, number][] = [], rotated = false) {
  pointerState.down(100, 100);
  for (const [x, y] of moves) pointerState.move(x, y);
  if (rotated) pointerState.rotated = true;
  ms += holdMs;
  pointerState.up();
}

describe('탭과 꾹 누르기 가르기', () => {
  afterEach(() => {
    ms += 1000;
  });

  it('짧게 누르면 탭 (걷는다)', () => {
    press(120);
    expect(pointerState.tapped()).toBe(true);
  });

  it('꾹 누르면 카메라를 돌리려던 것이라 걷지 않는다', () => {
    press(600);
    expect(pointerState.tapped()).toBe(false);
  });

  it('끌었다가 제자리로 돌아와도 걷지 않는다', () => {
    press(200, [[160, 100], [100, 100]]);
    expect(pointerState.tapped()).toBe(false);
    press(150, [], true);
    expect(pointerState.tapped()).toBe(false);
  });

  it('두 손가락 확대 직후에는 걷지 않는다', () => {
    pointerState.pinching = true;
    press(100);
    expect(pointerState.tapped()).toBe(false);
    pointerState.pinching = false;
    pointerState.pinchEndedAt = ms / 1000;
    press(100);
    expect(pointerState.tapped()).toBe(false);
    ms += 1000;
    press(100);
    expect(pointerState.tapped()).toBe(true);
  });
});
