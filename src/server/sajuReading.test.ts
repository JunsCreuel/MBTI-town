import { describe, expect, it } from 'vitest';
import { periodReading, premiumReading, weekReading } from '@/shared/sajuReading';
import { computeSaju, dayPillarOn, monthYearPillarsOn } from './saju';

const all = (r: { title: string; summary: string; sections: { title: string; text: string }[] }) => [r.title, r.summary, ...r.sections.flatMap((s) => [s.title, s.text])].join('\n');

describe('사주상담소 풀이', () => {
  const births = ['1990-01-05', '1995-07-21', '2001-11-30', '1988-03-14'].map((date) => computeSaju({ calendar: 'solar', date, time: null }, new Date('2026-11-04T00:00:00Z')));

  it('오늘·이번 달 풀이: 별점 1~5, 여섯 칸, 빈 말이 없고 같은 날이면 같은 풀이', () => {
    for (const saju of births) {
      const r = periodReading(saju, 'today', dayPillarOn('2026-11-04'), '11월 4일 수요일', 'u1:2026-11-04');
      expect(r.stars).toBeGreaterThanOrEqual(1);
      expect(r.stars).toBeLessThanOrEqual(5);
      expect(r.sections).toHaveLength(6);
      expect(all(r)).not.toMatch(/undefined|NaN|null/);
      expect(r).toEqual(periodReading(saju, 'today', dayPillarOn('2026-11-04'), '11월 4일 수요일', 'u1:2026-11-04'));
      const m = periodReading(saju, 'month', monthYearPillarsOn('2026-11-15').month, '2026년 11월', 'u1:2026-11');
      expect(m.title.startsWith('이번 달은')).toBe(true);
    }
  });

  it('이번 주 풀이: 좋은 날과 조심할 날을 이레 중에서 고른다', () => {
    const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'].map((d) => ({ label: d.slice(5), pillar: dayPillarOn(d) }));
    for (const saju of births) {
      const r = weekReading(saju, days, '11월 2일 ~ 11월 8일', 'u1:w');
      expect(r.sections[0].title).toBe('좋은 날');
      expect(days.some((d) => r.sections[0].text.startsWith(d.label))).toBe(true);
      expect(all(r)).not.toMatch(/undefined|NaN|null/);
    }
  });

  it('상세 풀이: 여덟 칸, 오행 개수와 일주가 들어간다', () => {
    const { year, month } = monthYearPillarsOn('2026-11-04');
    for (const saju of births) {
      const r = premiumReading(saju, year, month, '평생 사주');
      expect(r.sections).toHaveLength(8);
      expect(r.summary).toContain(saju.day.ko);
      expect(r.sections[1].text).toContain(`목 ${saju.counts.wood}`);
      expect(all(r)).not.toMatch(/undefined|NaN|null/);
    }
  });
});
