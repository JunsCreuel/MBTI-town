// 탭 이동용 길찾기. 8방향 A*로 칸 경로를 구한 뒤, 직선으로 갈 수 있는 구간은 합쳐서 자연스럽게 만든다.
import { isBlockedAt, isBlockedTile, type PlazaMap } from './plazaMap';

export interface Point {
  x: number;
  z: number;
}

const NEIGHBORS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
] as const;

/** start에서 goal까지 월드 좌표 경로 (start 제외, goal 포함). 갈 수 없으면 null. */
export function findPath(map: PlazaMap, start: Point, goal: Point, maxNodes = 4000): Point[] | null {
  const sx = Math.floor(start.x);
  const sz = Math.floor(start.z);
  let gx = Math.floor(goal.x);
  let gz = Math.floor(goal.z);
  let goalPoint = goal;
  if (isBlockedTile(map, gx, gz)) {
    // 막힌 칸을 눌렀으면 가장 가까운 빈 칸으로 간다
    const near = nearestOpenTile(map, gx, gz);
    if (!near) return null;
    [gx, gz] = near;
    goalPoint = { x: gx + 0.5, z: gz + 0.5 };
  }
  if (sx === gx && sz === gz) return [goalPoint];

  const W = map.width;
  const idx = (x: number, z: number) => z * W + x;
  const g = new Map<number, number>([[idx(sx, sz), 0]]);
  const parent = new Map<number, number>();
  const open: { i: number; f: number }[] = [{ i: idx(sx, sz), f: 0 }];
  const closed = new Set<number>();
  const h = (x: number, z: number) => {
    const dx = Math.abs(x - gx);
    const dz = Math.abs(z - gz);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  };

  while (open.length && closed.size < maxNodes) {
    let best = 0;
    for (let k = 1; k < open.length; k++) if (open[k].f < open[best].f) best = k;
    const { i } = open.splice(best, 1)[0];
    if (closed.has(i)) continue;
    closed.add(i);
    const cx = i % W;
    const cz = Math.floor(i / W);
    if (cx === gx && cz === gz) {
      const cells: Point[] = [];
      for (let c: number | undefined = i; c !== undefined && c !== idx(sx, sz); c = parent.get(c)) {
        cells.push({ x: (c % W) + 0.5, z: Math.floor(c / W) + 0.5 });
      }
      cells.reverse();
      cells[cells.length - 1] = goalPoint;
      return smoothPath(map, start, cells);
    }
    for (const [dx, dz, cost] of NEIGHBORS) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (isBlockedTile(map, nx, nz)) continue;
      // 대각선으로 모서리를 깎고 지나가지 않는다
      if (dx && dz && (isBlockedTile(map, cx + dx, cz) || isBlockedTile(map, cx, cz + dz))) continue;
      const ni = idx(nx, nz);
      if (closed.has(ni)) continue;
      const ng = g.get(i)! + cost;
      if (ng < (g.get(ni) ?? Infinity)) {
        g.set(ni, ng);
        parent.set(ni, i);
        open.push({ i: ni, f: ng + h(nx, nz) });
      }
    }
  }
  return null;
}

function nearestOpenTile(map: PlazaMap, tx: number, tz: number): [number, number] | null {
  for (let r = 1; r <= 4; r++) {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (isBlockedTile(map, tx + dx, tz + dz)) continue;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = [tx + dx, tz + dz];
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/** a에서 b까지 직선으로 막힘 없이 갈 수 있는지 (발 주변 여유 포함) */
export function hasLineOfSight(map: PlazaMap, a: Point, b: Point, radius = 0.3): boolean {
  const dist = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.max(1, Math.ceil(dist / 0.2));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    if (
      isBlockedAt(map, x, z) ||
      isBlockedAt(map, x + radius, z) || isBlockedAt(map, x - radius, z) ||
      isBlockedAt(map, x, z + radius) || isBlockedAt(map, x, z - radius)
    ) return false;
  }
  return true;
}

function smoothPath(map: PlazaMap, start: Point, cells: Point[]): Point[] {
  const out: Point[] = [];
  let from = start;
  let k = 0;
  while (k < cells.length) {
    let far = k;
    for (let j = cells.length - 1; j > k; j--) {
      if (hasLineOfSight(map, from, cells[j])) {
        far = j;
        break;
      }
    }
    out.push(cells[far]);
    from = cells[far];
    k = far + 1;
  }
  return out;
}
