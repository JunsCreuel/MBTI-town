import { describe, expect, it } from 'vitest';
import { landConfig } from '../config/game';
import { MBTI_TYPES } from '../design/mbti';
import { assignTerritory, equalShares, landTransfer, ownerAt, sharesFrom, takeRate } from './territory';
import { loadPlazaMapForTest } from './testMap';

const map = loadPlazaMapForTest();
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

describe('땅 지분', () => {
  it('처음에는 16개 유형이 똑같이 나눠 갖는다', () => {
    const s = equalShares();
    expect(sum(s)).toBeCloseTo(1);
    expect(s.ENFP).toBeCloseTo(1 / 16);
  });

  it('득표율 차가 클수록 많이 가져오고, 상한이 있다', () => {
    expect(takeRate(0)).toBeCloseTo(landConfig.takeBase);
    expect(takeRate(8)).toBeCloseTo(landConfig.takeBase + 8 * landConfig.takePerPoint);
    expect(takeRate(100)).toBe(landConfig.takeMax);
  });

  it('이긴 팀이 진 팀 땅을 가져온다 (합은 그대로)', () => {
    const s = equalShares();
    const c = landTransfer(s, ['ENTP'], ['INFJ'], 8)!;
    expect(c.rate).toBeCloseTo(0.09);
    expect(c.delta.INFJ).toBeCloseTo(-s.INFJ * 0.09, 6);
    expect(c.delta.ENTP).toBeCloseTo(s.INFJ * 0.09, 6);
    expect(sum(c.delta as Record<string, number>)).toBeCloseTo(0, 9);
    const next = sharesFrom([c]);
    expect(next.ENTP).toBeGreaterThan(s.ENTP);
    expect(next.INFJ).toBeLessThan(s.INFJ);
    expect(next.ISTJ).toBeCloseTo(s.ISTJ, 9);
  });

  it('팀이 여러 유형이면 나눠 갖고, 최소 지분 밑으로는 줄지 않는다', () => {
    const c = landTransfer(equalShares(), ['ENFP', 'ENTP'], ['ISTJ', 'ESTJ'], 20)!;
    expect(c.delta.ENFP).toBeCloseTo(c.delta.ENTP!, 6);
    // 계속 지면 최소 지분까지만 줄어든다
    const history = [];
    let s = equalShares();
    for (let i = 0; i < 200; i++) {
      const ch = landTransfer(s, ['ENFP'], ['ISTJ'], 100);
      if (ch) history.push(ch);
      s = sharesFrom(history);
    }
    expect(s.ISTJ).toBeGreaterThanOrEqual(landConfig.minShare - 1e-6);
    expect(landTransfer(s, ['ENFP'], ['ISTJ'], 100)).toBeNull();
    expect(sum(s)).toBeCloseTo(1);
  });

  it('잘못된 기록은 무시한다', () => {
    const s = sharesFrom([null, undefined, { rate: 0.1, delta: { XXXX: 0.5 } as never }]);
    expect(s).toEqual(equalShares());
  });
});

describe('땅 칸 나누기', () => {
  it('지분이 같으면 마을 땅 칸 수가 거의 같다', () => {
    const t = assignTerritory(map, equalShares());
    const mean = t.total / 16;
    for (const type of MBTI_TYPES) {
      expect(Math.abs(t.tiles[type] - mean) / mean).toBeLessThan(0.03);
      const c = map.villages[type]!;
      expect(ownerAt(map, t, c.x, c.z)).toBe(type);
    }
    expect(sum(t.tiles)).toBe(t.total);
    expect(ownerAt(map, t, 48.5, 48.5)).toBeNull(); // 광장
  });

  it('땅을 가져오면 이긴 마을은 넓어지고 진 마을은 좁아진다', () => {
    const before = assignTerritory(map, equalShares());
    const history = [];
    let s = equalShares();
    for (let i = 0; i < 4; i++) {
      const ch = landTransfer(s, ['ENTP'], ['INFJ'], 30)!;
      history.push(ch);
      s = sharesFrom(history);
    }
    const after = assignTerritory(map, s);
    expect(after.tiles.ENTP).toBeGreaterThan(before.tiles.ENTP * 1.25);
    expect(after.tiles.INFJ).toBeLessThan(before.tiles.INFJ * 0.8);
    // 칸 수는 지분과 거의 맞는다
    for (const type of MBTI_TYPES) {
      expect(Math.abs(after.tiles[type] / after.total - s[type])).toBeLessThan(0.004);
    }
    // 마을 한가운데는 그대로 그 마을 땅이다
    for (const type of MBTI_TYPES) {
      const c = map.villages[type]!;
      expect(ownerAt(map, after, c.x, c.z)).toBe(type);
    }
  });

  it('마을 땅은 한 덩어리로 이어져 있다', () => {
    const s = sharesFrom([landTransfer(equalShares(), ['ESFP'], ['ISTJ'], 60)]);
    const t = assignTerritory(map, s);
    for (const type of MBTI_TYPES) {
      const id = MBTI_TYPES.indexOf(type);
      const c = map.villages[type]!;
      const start = Math.floor(c.z) * map.width + Math.floor(c.x);
      const seen = new Set([start]);
      const queue = [start];
      while (queue.length) {
        const i = queue.pop()!;
        for (const d of [1, -1, map.width, -map.width]) {
          const j = i + d;
          if (!seen.has(j) && t.owner[j] === id && Math.abs((j % map.width) - (i % map.width)) <= 1) {
            seen.add(j);
            queue.push(j);
          }
        }
      }
      expect(seen.size).toBe(t.tiles[type]);
    }
  });

  it('같은 지분이면 늘 같은 결과', () => {
    const s = sharesFrom([landTransfer(equalShares(), ['ENFP'], ['ISTP'], 12)]);
    expect(assignTerritory(map, s).owner).toEqual(assignTerritory(map, s).owner);
  });
});
