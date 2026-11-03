// 사주 계산 기준 확인: 절기(입춘) 경계, 서울 지방시, 서머타임, 음력·윤달, 시간 모름
import { describe, expect, it } from 'vitest';
import { DISTRICTS } from '@/shared/districts';
import { SajuError, computeSaju } from './saju';

const today = new Date('2026-11-03T00:00:00Z');
const saju = (date: string, time: string | null, extra: { calendar?: 'solar' | 'lunar'; leap?: boolean } = {}) =>
  computeSaju({ calendar: extra.calendar ?? 'solar', date, time, leap: extra.leap }, today);
const gz = (p: { stem: string; branch: string } | null) => (p ? p.stem + p.branch : null);

describe('사주 네 기둥', () => {
  it('기준 날짜: 2000-01-01 정오는 기묘년 병자월 무오일 무오시, 일간 무(토)', () => {
    const r = saju('2000-01-01', '12:00');
    expect([gz(r.year), gz(r.month), gz(r.day), gz(r.hour)]).toEqual(['己卯', '丙子', '戊午', '戊午']);
    expect(r.day.ko).toBe('무오');
    expect(r.dayMaster).toEqual({ stem: '戊', ko: '무', element: 'earth' });
    expect(r.district).toBe('earth');
    expect(r.animal).toBe('토끼');
    expect(Object.values(r.counts).reduce((a, b) => a + b, 0)).toBe(8);
  });

  it('해는 1월 1일이 아니라 입춘(2024-02-04 17:27 한국 시각)에 바뀐다', () => {
    const before = saju('2024-02-04', '17:00');
    const after = saju('2024-02-04', '18:00');
    expect([gz(before.year), gz(before.month)]).toEqual(['癸卯', '乙丑']);
    expect([gz(after.year), gz(after.month)]).toEqual(['甲辰', '丙寅']);
    expect(saju('2024-01-15', '12:00').year.ko).toBe('계묘');
  });

  it('시주는 서울 지방시(한국 시각 - 약 32분)로 본다', () => {
    expect(saju('2000-01-01', '23:20').hour?.branch).toBe('亥');
    // 23:40은 자시(야자시): 일주는 그날 그대로
    const late = saju('2000-01-01', '23:40');
    expect(late.hour?.branch).toBe('子');
    expect(gz(late.day)).toBe('戊午');
    expect(saju('2000-01-01', '13:20').hour?.branch).toBe('午');
    expect(saju('2000-01-01', '13:40').hour?.branch).toBe('未');
  });

  it('지난 서머타임과 표준시 변경을 반영한다', () => {
    // 1988년 여름 서머타임(UTC+10): 시계 12:00 = 실제 서울 지방시 10:28 → 사시
    expect(saju('1988-07-01', '12:00').hour?.branch).toBe('巳');
    // 1957년 표준시 UTC+8:30: 시계 12:00 = 지방시 11:58 → 오시
    expect(saju('1957-01-01', '12:00').hour?.branch).toBe('午');
  });

  it('음력 생일은 양력으로 바꿔서 본다 (윤달 포함)', () => {
    const lunar = saju('1990-04-21', '12:00', { calendar: 'lunar' });
    expect(lunar.solarDate).toBe('1990-05-15');
    expect(gz(lunar.day)).toBe(gz(saju('1990-05-15', '12:00').day));
    expect(saju('2023-02-10', null, { calendar: 'lunar', leap: true }).solarDate).toBe('2023-03-31');
    expect(() => saju('1990-04-21', null, { calendar: 'lunar', leap: true })).toThrow(SajuError);
  });

  it('태어난 시간을 몰라도 일간과 지역은 정해진다 (여섯 글자)', () => {
    const r = saju('2000-01-01', null);
    expect(r.hour).toBeNull();
    expect(r.timeKnown).toBe(false);
    expect(r.district).toBe('earth');
    expect(Object.values(r.counts).reduce((a, b) => a + b, 0)).toBe(6);
    expect(r.notes.some((n) => n.includes('시주'))).toBe(true);
    // 절기가 바뀌는 날은 따로 알려 준다
    expect(saju('2024-02-04', null).notes.some((n) => n.includes('절기'))).toBe(true);
    expect(saju('2024-02-10', null).notes.some((n) => n.includes('절기'))).toBe(false);
  });

  it('잘못된 입력은 받지 않는다', () => {
    for (const [date, time] of [
      ['2023-02-29', null], ['1899-12-31', null], ['2027-01-01', null], ['2000/01/01', null], ['2000-01-01', '25:00'], ['2000-01-01', '7시'],
    ] as const) {
      expect(() => saju(date, time)).toThrow(SajuError);
    }
  });

  it('지역은 일간을 따르므로 다섯 지역에 고르게 나뉜다 (10년치 날짜)', () => {
    const counts = Object.fromEntries(DISTRICTS.map((d) => [d, 0])) as Record<string, number>;
    const start = Date.UTC(1990, 0, 1);
    const days = 3650;
    for (let i = 0; i < days; i++) {
      const d = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      counts[saju(d, null).district]++;
    }
    for (const d of DISTRICTS) expect(counts[d] / days).toBeCloseTo(0.2, 2);
  });
});
