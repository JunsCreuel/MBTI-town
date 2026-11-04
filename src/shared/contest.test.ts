import { describe, expect, it } from 'vitest';
import { announcementBody, announcementText, parseAnnouncement } from './announce';
import { contestLeader, contestWeek, previousContestWeek, rankDistricts, timeLeftLabel } from './contest';

const kst = (s: string) => new Date(`${s}+09:00`);

describe('대항전 한 주', () => {
  it('월요일 이름, 지난 일요일 21시 시작 ~ 이번 일요일 21시 발표 (한국 시간)', () => {
    const w = contestWeek(kst('2026-11-04T15:00:00'));
    expect(w.week).toBe('2026-11-02');
    expect(w.day).toBe('2026-11-04');
    expect(w.startsAt.toISOString()).toBe(kst('2026-11-01T21:00:00').toISOString());
    expect(w.closesAt.toISOString()).toBe(kst('2026-11-08T21:00:00').toISOString());
  });

  it('일요일 21시가 되면 다음 주로 넘어간다 (그 전까지는 이번 주)', () => {
    expect(contestWeek(kst('2026-11-08T20:59:59')).week).toBe('2026-11-02');
    expect(contestWeek(kst('2026-11-08T21:00:00')).week).toBe('2026-11-09');
    expect(contestWeek(kst('2026-11-08T23:30:00')).day).toBe('2026-11-08');
    // 월요일 0시는 그대로 그 주
    expect(contestWeek(kst('2026-11-09T00:00:00')).week).toBe('2026-11-09');
    expect(previousContestWeek(kst('2026-11-08T21:00:00')).week).toBe('2026-11-02');
    expect(previousContestWeek(kst('2026-11-10T12:00:00')).week).toBe('2026-11-02');
  });

  it('지역 순서: 점수 → 참여한 사람 수 → 지역 차례, 없는 지역은 0점', () => {
    const r = rankDistricts({ fire: { score: 10, people: 1, debateWins: 0 }, water: { score: 10, people: 3, debateWins: 0 }, metal: { score: 40, people: 2, debateWins: 1 } });
    expect(r.map((x) => x.district)).toEqual(['metal', 'water', 'fire', 'wood', 'earth']);
    expect(r.at(-1)).toMatchObject({ district: 'earth', score: 0, people: 0 });
    expect(contestLeader(r)).toBe('metal');
    // 모두 0점이거나 1위가 같은 점수면 우승 없음
    expect(contestLeader(rankDistricts({}))).toBeNull();
    expect(contestLeader(rankDistricts({ fire: { score: 5, people: 1, debateWins: 0 }, wood: { score: 5, people: 1, debateWins: 0 } }))).toBeNull();
  });

  it('남은 시간 글', () => {
    const close = kst('2026-11-08T21:00:00');
    expect(timeLeftLabel(close, kst('2026-11-06T18:00:00'))).toBe('2일 3시간');
    expect(timeLeftLabel(close, kst('2026-11-08T16:48:00'))).toBe('4시간 12분');
    expect(timeLeftLabel(close, kst('2026-11-08T20:30:00'))).toBe('30분');
    expect(timeLeftLabel(close, kst('2026-11-08T20:59:30'))).toBe('곧 발표');
  });
});

describe('우승 발표', () => {
  it('서버 전체 공지로 우승 지역을 알린다 (지역이 아니면 받지 않는다)', () => {
    const a = parseAnnouncement({ kind: 'contest', district: 'fire' })!;
    expect(a).toEqual({ kind: 'contest', district: 'fire' });
    expect(announcementText(a)).toContain('노을 지역');
    expect(announcementBody(a)).toBe('contest:fire');
    expect(parseAnnouncement({ kind: 'contest', district: 'moon' })).toBeNull();
  });
});
