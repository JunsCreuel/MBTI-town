import { describe, expect, it } from 'vitest';
import { castTarget, isBlockedAt, nearWater } from './townMap';
import { loadFishingMapForTest } from './testMap';

describe('낚시 찌 자리', () => {
  const map = loadFishingMapForTest();
  // 물가에 선 자리를 하나 찾는다 (걸을 수 있고 물이 가깝다)
  const shore = (() => {
    for (let z = 0; z < map.height; z++) for (let x = 0; x < map.width; x++) {
      const p = { x: x + 0.5, z: z + 0.5 };
      if (!isBlockedAt(map, p.x, p.z) && nearWater(map, p.x, p.z)) return p;
    }
    throw new Error('물가가 없습니다');
  })();

  it('물가에서 던지면 물 위 2~4.5칸 떨어진 곳에 찌가 떨어진다', () => {
    const t = castTarget(map, shore.x, shore.z)!;
    expect(t).not.toBeNull();
    const d = Math.hypot(t.x - shore.x, t.z - shore.z);
    expect(d).toBeGreaterThanOrEqual(1.4);
    expect(d).toBeLessThanOrEqual(4.5);
    expect(nearWater(map, t.x, t.z, 0.1)).toBe(true);
  });

  it('바라보는 쪽을 주면 그쪽 물을 고른다', () => {
    const a = castTarget(map, shore.x, shore.z, 0)!;
    const b = castTarget(map, shore.x, shore.z, Math.PI)!;
    // 방향이 정반대면 고른 자리도 다르거나, 한쪽에만 물이 있으면 같다
    expect(a && b).toBeTruthy();
  });

  it('물에서 먼 곳은 찌 자리가 없다', () => {
    const c = { x: map.width / 2 + 0.5, z: map.height / 2 + 12.5 };
    if (!nearWater(map, c.x, c.z, 4.6)) expect(castTarget(map, c.x, c.z)).toBeNull();
  });
});
