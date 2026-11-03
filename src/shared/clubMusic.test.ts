import { describe, expect, it } from 'vitest';
import { CLUB_TRACKS, clubScheduleAt } from './clubMusic';

describe('클럽 음악 순서', () => {
  const lens = [60, 90, 30];
  const total = 180;

  it('시계로 지금 곡과 위치를 정한다', () => {
    expect(clubScheduleAt(0, lens)).toEqual({ index: 0, offset: 0, left: 60 });
    expect(clubScheduleAt(59_000, lens)).toEqual({ index: 0, offset: 59, left: 1 });
    expect(clubScheduleAt(60_000, lens)).toEqual({ index: 1, offset: 0, left: 90 });
    expect(clubScheduleAt(170_000, lens)).toEqual({ index: 2, offset: 20, left: 10 });
  });

  it('플레이리스트가 끝나면 처음부터 다시 돈다', () => {
    expect(clubScheduleAt(total * 1000 * 7 + 65_000, lens)).toEqual({ index: 1, offset: 5, left: 85 });
  });

  it('같은 순간이면 누구나 같은 곡의 같은 자리', () => {
    const t = 1_762_000_123_456;
    expect(clubScheduleAt(t, lens)).toEqual(clubScheduleAt(t, lens));
  });

  it('길이를 모르는 곡은 건너뛰고, 다 모르면 null', () => {
    expect(clubScheduleAt(10_000, [0, 30])).toEqual({ index: 1, offset: 10, left: 20 });
    expect(clubScheduleAt(10_000, [0, 0])).toBeNull();
  });

  it('곡마다 manifest 키와 출처가 있다', () => {
    for (const t of CLUB_TRACKS) {
      expect(t.key).toBe(`bgm.club.${t.id}`);
      expect(t.source).toMatch(/^https:\/\/opengameart\.org\/content\//);
      expect(t.license).toBe('CC0 1.0');
    }
  });
});
