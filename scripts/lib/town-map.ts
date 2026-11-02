// 마을 전체 초기 맵(Tiled JSON)을 만든다. 한 번 만든 뒤에는 Tiled에서 직접 고친다.
// 구조: 가운데 중앙광장 → 둘레 길 → 다섯 지역(오행, 북쪽부터 시계 방향 목·화·토·금·수) → 모래사장 → 바다
//
// 레이어
//   ground    (타일) 땅 종류. 타일셋 타일 속성 terrain(string), height(float)
//   deco      (오브젝트) 소품. name = manifest 키, type = "prop", (x, y) = 바닥 가운데 px, rotation = 방향(도, 시계 방향)
//             지역 소품은 사용자 속성 district = 지역 id (그 지역 색으로 칠한다)
//   collision (타일) 0이 아니면 막힘 (바다, 소품, 집터)
//   spawn     (사각형) "spawn" = 중앙광장, "spawn.wood" 등 = 지역 입구
//   lots      (점) 집터. name = "지역.번호", rotation = 집이 바라보는 방향(도). 집터는 늘 막혀 있다(빈 집터는 울타리).
//   districts (타일) 지역 땅: 1~5 = DISTRICTS 순서, 0 = 광장·길·바닷가
import { townConfig } from '../../src/config/game';
import { DISTRICTS, type District } from '../../src/shared/districts';

export const TOWN_TILES = ['grass', 'grass2', 'stone', 'path', 'water', 'flowerbed', 'hedge', 'stoneEdge', 'sand'] as const;
type TileName = (typeof TOWN_TILES)[number];

const SIZE = 88;
const T = 32;
const C = SIZE / 2;

/** 가운데에서 잰 반지름 (칸) */
export const TOWN_RADII = {
  stone: 6.5,
  stoneEdge: 7.4,
  ringIn: 11.6,
  ringOut: 13.2,
  /** 여기부터 바닷가까지가 지역 땅이다 */
  land: 13.2,
  streetA: 22.5,
  streetB: 36.2,
  rowA: 19,
  rowB: 26,
  rowC: 32.8,
  landmark: 29.5,
  shore: 40,
  beach: 3,
} as const;

/** 지역마다 명소 (manifest 키) */
const LANDMARK: Record<District, string> = {
  wood: 'prop.district.greenhouse',
  fire: 'prop.district.stage',
  earth: 'prop.district.shop',
  metal: 'prop.district.workshop',
  water: 'prop.district.pier',
};

/** 지역마다 나무를 얼마나 심을지 */
const TREES: Record<District, number> = { wood: 46, fire: 16, earth: 20, metal: 12, water: 20 };

const gid = (name: TileName) => TOWN_TILES.indexOf(name) + 1;
const TILE_HEIGHT: Partial<Record<TileName, number>> = { stone: 0.05, stoneEdge: 0.05, flowerbed: 0.18, hedge: 0.75 };
const SECTOR = (2 * Math.PI) / DISTRICTS.length;

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 지역 i의 가운데 방향 (라디안). 북쪽에서 시계 방향. */
export function districtAngle(i: number): number {
  return -Math.PI / 2 + i * SECTOR;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** 이 방향이 몇 번째 지역인지 */
function districtIndexAt(angle: number): number {
  return ((Math.round(wrap(angle - districtAngle(0)) / SECTOR) % DISTRICTS.length) + DISTRICTS.length) % DISTRICTS.length;
}

function shoreAt(angle: number): number {
  return TOWN_RADII.shore + Math.sin(angle * 4 + 0.7) * 1.0 + Math.sin(angle * 9 + 2.1) * 0.5;
}

export function buildTownMap(tilesetFile: string) {
  const N = SIZE * SIZE;
  const ground: number[] = new Array(N).fill(gid('water'));
  const collision: number[] = new Array(N).fill(0);
  const districtGrid: number[] = new Array(N).fill(0);
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
  const set = (layer: number[], x: number, y: number, v: number) => {
    if (inside(x, y)) layer[y * SIZE + x] = v;
  };
  const get = (layer: number[], x: number, y: number) => (inside(x, y) ? layer[y * SIZE + x] : 0);
  const block = (x: number, y: number) => set(collision, x, y, 1);
  const polar = (x: number, y: number) => {
    const dx = x + 0.5 - C;
    const dy = y + 0.5 - C;
    return { d: Math.hypot(dx, dy), a: Math.atan2(dy, dx) };
  };
  const rand = rng(20261102);

  // 1. 섬: 잔디 → 모래사장 → 바다, 지역 땅 표시
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const { d, a } = polar(x, y);
      const shore = shoreAt(a);
      if (d < shore) {
        set(ground, x, y, rand() < 0.22 ? gid('grass2') : gid('grass'));
        if (d >= TOWN_RADII.land) set(districtGrid, x, y, districtIndexAt(a) + 1);
      } else if (d < shore + TOWN_RADII.beach) {
        set(ground, x, y, gid('sand'));
      } else {
        block(x, y);
      }
    }
  }

  // 2. 길: 중앙광장 돌바닥, 둘레 길, 지역으로 가는 큰길 다섯, 지역을 잇는 둥근 거리 둘
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const { d, a } = polar(x, y);
      const i = districtIndexAt(a);
      const across = Math.abs(Math.sin(wrap(a - districtAngle(i))) * d);
      const toward = Math.cos(wrap(a - districtAngle(i))) > 0;
      if (d <= TOWN_RADII.stone) set(ground, x, y, gid('stone'));
      else if (d <= TOWN_RADII.stoneEdge) set(ground, x, y, gid('stoneEdge'));
      else if (d >= TOWN_RADII.ringIn && d < TOWN_RADII.ringOut) set(ground, x, y, gid('path'));
      else if (toward && across < 1.2 && d < TOWN_RADII.streetB + 1) set(ground, x, y, gid('path'));
      else if (Math.abs(d - TOWN_RADII.streetA) < 0.95 || Math.abs(d - TOWN_RADII.streetB) < 0.85) {
        if (d < shoreAt(a) - 0.5) set(ground, x, y, gid('path'));
      }
    }
  }

  // 3. 지역 경계: 낮은 산울타리 (둥근 거리가 지나는 자리는 열어 둔다)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const { d, a } = polar(x, y);
      if (d < TOWN_RADII.ringOut + 1.5 || d > shoreAt(a) - 0.6) continue;
      const i = districtIndexAt(a);
      const offset = Math.abs(wrap(a - (districtAngle(i) + SECTOR / 2)));
      const offset2 = Math.abs(wrap(a - (districtAngle(i) - SECTOR / 2)));
      const nearBoundary = Math.min(offset, offset2) * d < 0.72;
      const onStreet = Math.abs(d - TOWN_RADII.streetA) < 1.4 || Math.abs(d - TOWN_RADII.streetB) < 1.3;
      if (nearBoundary && !onStreet) {
        set(ground, x, y, gid('hedge'));
        block(x, y);
      }
    }
  }

  // 4. 소품
  const objects: Record<string, unknown>[] = [];
  let nextId = 1;
  const taken: { x: number; y: number; r: number }[] = [];
  const prop = (key: string, x: number, y: number, footprint: [number, number][], rot = 0, district?: District) => {
    objects.push({
      id: nextId++, name: key, type: 'prop', x: x * T, y: y * T, width: 0, height: 0, point: true, rotation: rot, visible: true,
      ...(district ? { properties: [{ name: 'district', type: 'string', value: district }] } : {}),
    });
    for (const [fx, fy] of footprint) block(fx, fy);
  };
  /** (x, y)에서 (tx, ty)를 바라보는 Tiled 회전 각도 (모델 정면 = +Z = 남쪽) */
  const facing = (x: number, y: number, tx: number, ty: number) => Math.round((-Math.atan2(tx - x, ty - y) * 180) / Math.PI);
  /** 회전한 직사각형이 덮는 칸 */
  const rectTiles = (x: number, y: number, hw: number, hd: number, rotDeg: number): [number, number][] => {
    const yaw = (-rotDeg * Math.PI) / 180;
    const out: [number, number][] = [];
    for (let ty = Math.floor(y - 3); ty <= Math.ceil(y + 3); ty++) {
      for (let tx = Math.floor(x - 3); tx <= Math.ceil(x + 3); tx++) {
        const dx = tx + 0.5 - x;
        const dy = ty + 0.5 - y;
        const lx = dx * Math.cos(yaw) - dy * Math.sin(yaw);
        const lz = dx * Math.sin(yaw) + dy * Math.cos(yaw);
        if (Math.abs(lx) <= hw && Math.abs(lz) <= hd) out.push([tx, ty]);
      }
    }
    return out;
  };
  const square = (x0: number, y0: number, w: number, h: number) => {
    const out: [number, number][] = [];
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) out.push([x, y]);
    return out;
  };
  const at = (r: number, a: number) => ({ x: C + Math.cos(a) * r, y: C + Math.sin(a) * r });
  const snap = (v: number) => Math.floor(v) + 0.5;

  // 중앙광장: 분수, 게시판(오늘의 토론), 깃발, 벤치, 가로등, 화단, 나무. 큰길 사이 방향에 둔다.
  prop('prop.plaza.fountain', C, C, square(C - 1, C - 1, 3, 3));
  const between = (k: number) => districtAngle(k) + SECTOR / 2;
  {
    const a = between(0);
    const b = at(5.4, a);
    const rot = facing(b.x, b.y, C, C);
    prop('prop.plaza.board', b.x, b.y, rectTiles(b.x, b.y, 1.05, 0.3, rot), rot);
    for (const s of [-1, 1]) {
      const f = at(5.6, a + s * 0.42);
      prop('prop.plaza.flag', snap(f.x), snap(f.y), [[Math.floor(f.x), Math.floor(f.y)]]);
    }
  }
  for (let k = 1; k < DISTRICTS.length; k++) {
    const b = at(4.6, between(k));
    const rot = facing(b.x, b.y, C, C);
    prop('prop.plaza.bench', b.x, b.y, rectTiles(b.x, b.y, 0.9, 0.3, rot), rot);
  }
  for (let k = 0; k < DISTRICTS.length; k++) {
    const l = at(6.4, districtAngle(k) + 0.32);
    prop('prop.plaza.lamp', snap(l.x), snap(l.y), [[Math.floor(l.x), Math.floor(l.y)]]);
    const fb = at(9.4, between(k));
    const fx = Math.floor(fb.x - 1);
    const fy = Math.floor(fb.y - 1);
    for (const [x, y] of square(fx, fy, 2, 2)) {
      set(ground, x, y, gid('flowerbed'));
      block(x, y);
    }
    taken.push({ x: fx + 1, y: fy + 1, r: 2 });
    for (const s of [-0.26, 0.26]) {
      const t = at(9.8, between(k) + s);
      prop('prop.plaza.tree', snap(t.x), snap(t.y), [[Math.floor(t.x), Math.floor(t.y)]]);
      taken.push({ x: t.x, y: t.y, r: 1.2 });
    }
  }

  // 지역: 집터 3줄, 명소, 호수
  const lots: Record<string, unknown>[] = [];
  DISTRICTS.forEach((district, i) => {
    const a0 = districtAngle(i);
    // 명소: 큰길 오른쪽, 2번째와 3번째 집 줄 사이
    const lm = at(TOWN_RADII.landmark, a0 + 4.2 / TOWN_RADII.landmark);
    const lmRot = facing(lm.x, lm.y, C, C);
    const lmSize = district === 'water' ? [0.7, 1.2] : [1.65, 1.25];
    prop(LANDMARK[district], lm.x, lm.y, rectTiles(lm.x, lm.y, lmSize[0], lmSize[1], lmRot), lmRot, district);
    taken.push({ x: lm.x, y: lm.y, r: 1.9 });
    if (district === 'water') {
      // 호수: 명소(부두) 옆 작은 못
      const p = at(TOWN_RADII.landmark, a0 + 7.6 / TOWN_RADII.landmark);
      for (let y = Math.floor(p.y - 3); y <= Math.ceil(p.y + 3); y++) {
        for (let x = Math.floor(p.x - 3); x <= Math.ceil(p.x + 3); x++) {
          if (Math.hypot((x + 0.5 - p.x) / 2.1, (y + 0.5 - p.y) / 1.6) <= 1 && get(ground, x, y) !== gid('path')) {
            set(ground, x, y, gid('water'));
            block(x, y);
          }
        }
      }
      taken.push({ x: p.x, y: p.y, r: 1.9 });
    }
    // 집터: 줄마다 큰길을 비우고 양쪽으로 둔다
    const rows: { r: number; outward: boolean }[] = [
      { r: TOWN_RADII.rowA, outward: true },
      { r: TOWN_RADII.rowB, outward: false },
      { r: TOWN_RADII.rowC, outward: true },
    ];
    const candidates: { x: number; y: number; rot: number; row: number; off: number }[] = [];
    rows.forEach((row, ri) => {
      const half = SECTOR / 2 - 1.7 / row.r;
      const step = 3.35 / row.r;
      for (let k = -Math.floor(half / step); k <= Math.floor(half / step); k++) {
        const da = k * step;
        if (Math.abs(da) * row.r < 2.6) continue; // 큰길
        const p = at(row.r, a0 + da);
        const street = row.outward ? (ri === 0 ? TOWN_RADII.streetA : TOWN_RADII.streetB) : TOWN_RADII.streetA;
        const target = at(street, a0 + da);
        candidates.push({ x: p.x, y: p.y, rot: facing(p.x, p.y, target.x, target.y), row: ri, off: Math.abs(da) });
      }
    });
    candidates.sort((p, q) => p.row - q.row || p.off - q.off);
    const usable = candidates.filter((c) => !taken.some((t) => Math.hypot(t.x - c.x, t.y - c.y) < t.r + 1.2));
    if (usable.length < townConfig.lotsPerDistrict) throw new Error(`${district} 지역 집터가 ${usable.length}개뿐입니다`);
    usable.slice(0, townConfig.lotsPerDistrict).forEach((c, n) => {
      lots.push({ id: nextId++, name: `${district}.${n}`, type: 'lot', x: c.x * T, y: c.y * T, width: 0, height: 0, point: true, rotation: c.rot, visible: true });
      for (const [fx, fy] of rectTiles(c.x, c.y, 1.25, 1.15, c.rot)) block(fx, fy);
      taken.push({ x: c.x, y: c.y, r: 1.9 });
    });
  });

  // 나무: 지역마다 정해진 수만큼 흩어 심는다 (길·집터·명소와 떨어뜨린다)
  const onPath = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (get(ground, Math.floor(x) + dx, Math.floor(y) + dy) === gid('path')) return true;
    }
    return false;
  };
  DISTRICTS.forEach((district, i) => {
    let planted = 0;
    for (let tries = 0; tries < 4000 && planted < TREES[district]; tries++) {
      const a = districtAngle(i) + (rand() - 0.5) * (SECTOR - 0.08);
      const d = TOWN_RADII.land + 1.5 + Math.sqrt(rand()) * (shoreAt(a) - TOWN_RADII.land - 2.5);
      const x = snap(C + Math.cos(a) * d);
      const y = snap(C + Math.sin(a) * d);
      if (get(collision, Math.floor(x), Math.floor(y)) || onPath(x, y)) continue;
      if (taken.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + 1.1)) continue;
      prop('prop.plaza.tree', x, y, [[Math.floor(x), Math.floor(y)]], 0, district);
      taken.push({ x, y, r: 1.1 });
      planted++;
    }
  });

  // 5. 스폰: 광장은 분수 남쪽, 지역은 큰길 입구
  const spawns = [
    { id: nextId++, name: 'spawn', type: 'spawn', x: (C - 3) * T, y: (C + 3) * T, width: 6 * T, height: 2 * T, rotation: 0, visible: true },
    ...DISTRICTS.map((d, i) => {
      const p = at(16.2, districtAngle(i));
      return { id: nextId++, name: `spawn.${d}`, type: 'spawn', x: (p.x - 1.5) * T, y: (p.y - 1.5) * T, width: 3 * T, height: 3 * T, rotation: 0, visible: true };
    }),
  ];

  const tileLayer = (id: number, name: string, data: number[], opacity = 1) => ({
    id, name, type: 'tilelayer', x: 0, y: 0, width: SIZE, height: SIZE, opacity, visible: true, data,
  });
  const objectLayer = (id: number, name: string, objs: unknown[]) => ({
    id, name, type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: objs,
  });

  return {
    type: 'map',
    version: '1.10',
    tiledversion: '1.10.2',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    infinite: false,
    width: SIZE,
    height: SIZE,
    tilewidth: T,
    tileheight: T,
    nextlayerid: 7,
    nextobjectid: nextId,
    layers: [
      tileLayer(1, 'ground', ground),
      objectLayer(2, 'deco', objects),
      tileLayer(3, 'collision', collision.map((v) => (v ? gid('hedge') : 0)), 0.5),
      objectLayer(4, 'spawn', spawns),
      objectLayer(5, 'lots', lots),
      tileLayer(6, 'districts', districtGrid, 0.3),
    ],
    tilesets: [
      {
        firstgid: 1,
        // name은 manifest 키다. 코드는 image 경로가 아니라 이 키로 타일셋 그림을 찾는다.
        name: 'tile.town',
        image: `../${tilesetFile}`,
        imagewidth: 4 * T,
        imageheight: Math.ceil(TOWN_TILES.length / 4) * T,
        tilewidth: T,
        tileheight: T,
        columns: 4,
        tilecount: TOWN_TILES.length,
        margin: 0,
        spacing: 0,
        tiles: TOWN_TILES.map((name, id) => ({
          id,
          properties: [
            { name: 'terrain', type: 'string', value: name },
            ...(TILE_HEIGHT[name] ? [{ name: 'height', type: 'float', value: TILE_HEIGHT[name] }] : []),
          ],
        })),
      },
    ],
  };
}
