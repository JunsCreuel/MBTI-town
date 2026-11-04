import { describe, expect, it } from 'vitest';
import { CLUB_TRACKS, advanceLine, clubLineAt, clubScheduleAt, lineFromClock, queueKey, skipLine, youtubeIdOf, type ClubLine } from './clubMusic';
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

describe('유튜브 신청곡', () => {
  const lens = [60, 90, 30];
  const t0 = 1_000_000;
  const song = { id: 'dQw4w9WgXcQ', title: '유튜브 곡', seconds: 45 };

  it('유튜브 곡은 영상 길이만큼 틀고, 끝나면 마지막 목록 곡 다음으로 이어 간다', () => {
    const l: ClubLine = {
      index: 1,
      startedAt: t0,
      by: '',
      queue: [{ index: -1, yt: song, by: '유튜버', who: 'y' }, { index: 0, by: '다음', who: 'n' }],
    };
    // 1번(90초) 다음 유튜브(45초)
    expect(clubLineAt(l, t0 + 100_000, lens)).toEqual({ index: -1, yt: song, offset: 10, left: 35, by: '유튜버' });
    // 유튜브 다음 신청곡 0번
    expect(clubLineAt(l, t0 + 140_000, lens)).toMatchObject({ index: 0, offset: 5, by: '다음' });
    expect(clubLineAt(l, t0 + 140_000, lens)?.yt).toBeUndefined();
    // 신청곡이 끝나면 0번 다음(1번)부터 목록 순서
    expect(clubLineAt(l, t0 + 200_000, lens)).toMatchObject({ index: 1, offset: 5, by: '' });
  });

  it('유튜브 곡이 지금 곡이어도 흐름을 당길 수 있다', () => {
    const l: ClubLine = { index: -1, yt: song, startedAt: t0, by: '유튜버', queue: [], after: 2 };
    expect(clubLineAt(l, t0 + 44_000, lens)).toMatchObject({ index: -1, offset: 44, by: '유튜버' });
    // 끝나면 after(2번)
    expect(clubLineAt(l, t0 + 46_000, lens)).toMatchObject({ index: 2, offset: 1, by: '' });
    expect(advanceLine(l, t0 + 46_000, lens)).toMatchObject({ index: 2, startedAt: t0 + 45_000, after: 0 });
  });

  it('여러 모양의 유튜브 링크에서 영상 id를 읽는다', () => {
    const id = 'dQw4w9WgXcQ';
    for (const url of [
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtube.com/watch?v=${id}&t=30s`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}?si=abc`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://music.youtube.com/watch?v=${id}&list=RD`,
      `  ${id}  `,
    ]) {
      expect(youtubeIdOf(url)).toBe(id);
    }
    for (const bad of ['', 'hello', 'https://example.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com/watch?v=short', 'javascript:alert(1)']) {
      expect(youtubeIdOf(bad)).toBeNull();
    }
  });
});

describe('운영자 곡 넘기기', () => {
  const lens = [60, 90, 30];
  const t0 = 1_000_000;
  const song = { id: 'dQw4w9WgXcQ', title: '유튜브 곡', seconds: 45 };

  it('지금 곡을 끝내고 대기열 첫 곡을 지금부터 튼다', () => {
    const l: ClubLine = { index: 0, startedAt: t0, by: '', queue: [{ index: -1, yt: song, by: '유튜버', who: 'y' }, { index: 2, by: '다음', who: 'n' }], after: 1 };
    const s = skipLine(l, t0 + 10_000, 3);
    expect(s).toMatchObject({ index: -1, yt: song, startedAt: t0 + 10_000, by: '유튜버', after: 1 });
    expect(s.queue.map((q) => q.who)).toEqual(['n']);
    const s2 = skipLine(s, t0 + 20_000, 3);
    expect(s2).toMatchObject({ index: 2, startedAt: t0 + 20_000, by: '다음', after: 0, queue: [] });
    expect(clubLineAt(s2, t0 + 25_000, lens)).toMatchObject({ index: 2, offset: 5 });
  });

  it('대기열이 비었으면 목록의 다음 곡으로', () => {
    expect(skipLine({ index: 1, startedAt: t0, by: '', queue: [], after: 2 }, t0 + 5000, 3)).toMatchObject({ index: 2, after: 0, by: '' });
  });

  it('대기열 곡을 가리키는 값은 신청한 사람과 곡으로 정한다', () => {
    expect(queueKey({ index: 2, by: 'a', who: 's1' })).toBe('s1:2');
    expect(queueKey({ index: -1, by: 'a', who: 's1', yt: song })).toBe('s1:yt:dQw4w9WgXcQ');
  });
});
