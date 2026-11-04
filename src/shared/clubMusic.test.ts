import { describe, expect, it } from 'vitest';
import { CLUB_TRACKS, advanceLine, clubLineAt, clubScheduleAt, lineFromClock, type ClubLine } from './clubMusic';
import { PROVIDED_BY_OWNER } from './music';

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

  it('곡 id가 겹치지 않는다 (DJ 신청곡은 번호로 주고받는다)', () => {
    expect(new Set(CLUB_TRACKS.map((t) => t.id)).size).toBe(CLUB_TRACKS.length);
  });

  it('곡마다 manifest 키와 출처가 있다', () => {
    for (const t of CLUB_TRACKS) {
      expect(t.key).toBe(`bgm.club.${t.id}`);
      expect(t.file).toBe(`club_${t.id}`);
      if (t.license === 'CC0 1.0') expect(t.source).toMatch(/^https:\/\/opengameart\.org\/content\//);
      else expect(t.source).toBe(PROVIDED_BY_OWNER);
    }
  });
});

describe('신청곡 대기열', () => {
  const lens = [60, 90, 30];
  const t0 = 1_000_000;
  const line = (queue: number[] = []): ClubLine => ({ index: 0, startedAt: t0, by: '', queue: queue.map((index, k) => ({ index, by: `신청${k}`, who: `s${k}` })) });

  it('지금 곡은 끝까지 틀고, 신청곡을 차례로, 그 뒤로는 목록 순서', () => {
    const l = line([2, 1]);
    expect(clubLineAt(l, t0 + 30_000, lens)).toMatchObject({ index: 0, offset: 30, by: '' });
    // 첫 곡(60초)이 끝나면 첫 신청곡(2번, 30초)
    expect(clubLineAt(l, t0 + 61_000, lens)).toMatchObject({ index: 2, offset: 1, by: '신청0' });
    // 그다음 두 번째 신청곡(1번, 90초)
    expect(clubLineAt(l, t0 + 95_000, lens)).toMatchObject({ index: 1, offset: 5, by: '신청1' });
    // 신청곡을 다 틀면 마지막 곡 다음부터 목록 순서 (1번 다음 = 2번)
    expect(clubLineAt(l, t0 + 185_000, lens)).toMatchObject({ index: 2, offset: 5, by: '' });
    expect(clubLineAt(l, t0 + 215_000, lens)).toMatchObject({ index: 0, offset: 5, by: '' });
  });

  it('흐름을 당기면 끝난 곡은 빠지고 남은 신청곡만 남는다', () => {
    const a = advanceLine(line([2, 1]), t0 + 70_000, lens);
    expect(a).toMatchObject({ index: 2, startedAt: t0 + 60_000, by: '신청0' });
    expect(a.queue.map((q) => q.index)).toEqual([1]);
    // 아주 오래 지나도 (한 바퀴씩 건너뛰며) 같은 답
    const far = t0 + 1000 * (60 + 30 + 90) + 180_000 * 1000 + 15_000;
    expect(clubLineAt(line([2, 1]), far, lens)).toEqual(clubLineAt(advanceLine(line([2, 1]), far - 1, lens), far, lens));
  });

  it('신청곡이 없으면 시계 순서에서 흐름을 만든다', () => {
    const l = lineFromClock(65_000, lens)!;
    expect(l).toMatchObject({ index: 1, startedAt: 60_000, by: '', queue: [] });
    expect(clubLineAt(l, 65_000, lens)).toEqual({ ...clubScheduleAt(65_000, lens), by: '' });
  });
});
