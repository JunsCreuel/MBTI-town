import { describe, expect, it } from 'vitest';
import { DISTRICTS } from './districts';
import { RESIDENTS, RESIDENT_CYCLE, RESIDENT_WALK_SPEED, residentArea, residentDef, residentDoor, residentPose } from './residents';
import { loadTownMapForTest } from './testMap';
import { isBlockedAt } from './townMap';

const map = loadTownMapForTest();

describe('동물 주민', () => {
  it('마을마다 주민이 한두 마리 산다 (같은 마을은 다른 동물, 집끼리는 떨어져 있다)', () => {
    expect(map.residents.map((h) => h.id).sort()).toEqual(RESIDENTS.map((r) => r.id).sort());
    expect(new Set(RESIDENTS.map((r) => r.name)).size).toBe(RESIDENTS.length);
    for (const d of DISTRICTS) {
      const here = map.residents.filter((h) => h.district === d);
      expect(here.length).toBeGreaterThanOrEqual(1);
      expect(here.length).toBeLessThanOrEqual(2);
      expect(new Set(here.map((h) => residentDef(h.id)!.species)).size).toBe(here.length);
    }
    for (const a of map.residents) for (const b of map.residents) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(7);
    for (const h of map.residents) {
      // 집 바닥은 막혀 있고 집 모델이 서 있다. 문 앞은 열려 있고 둘레에 돌아다닐 자리가 있다
      expect(isBlockedAt(map, h.x, h.z)).toBe(true);
      expect(map.props.some((p) => p.key === 'prop.town.house' && Math.hypot(p.x - h.x, p.z - h.z) < 0.01 && p.district === h.district)).toBe(true);
      const door = residentDoor(h);
      expect(isBlockedAt(map, door.x, door.z)).toBe(false);
      expect(residentArea(map, h).length).toBeGreaterThan(10);
    }
  });

  it('일과: 집 안에 있다가 나와서 막히지 않은 길로 걷고 다시 들어간다 (같은 시각이면 같은 자리)', () => {
    const dt = 0.25;
    for (const h of map.residents) {
      let prev = residentPose(map, h, 1_800_000_000);
      let inside = 0;
      let outside = 0;
      for (let t = 1_800_000_000 + dt; t < 1_800_000_000 + RESIDENT_CYCLE * 3; t += dt) {
        const p = residentPose(map, h, t);
        expect(residentPose(map, h, t)).toEqual(p);
        if (p.inside) inside += dt;
        else outside += dt;
        // 문을 드나드는 동안(흐려질 때)만 집 벽 안에 들어간다
        if (!p.inside && p.opacity === 1) expect(isBlockedAt(map, p.x, p.z)).toBe(false);
        // 순간이동하지 않는다 (같은 바퀴 안에서)
        if (!p.inside && !prev.inside && p.cycle === prev.cycle) expect(Math.hypot(p.x - prev.x, p.z - prev.z)).toBeLessThanOrEqual(RESIDENT_WALK_SPEED * dt * 1.05 + 1e-6);
        prev = p;
      }
      expect(inside).toBeGreaterThanOrEqual(14 * 3 - 1);
      expect(outside).toBeGreaterThan(20 * 3);
    }
  });
});
