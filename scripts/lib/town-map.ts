// 마을 전체 초기 맵(Tiled JSON)을 만든다. 한 번 만든 뒤에는 Tiled에서 직접 고친다.
// 구조: 가운데 중앙광장 → 둘레 길 → 16유형 마을(북쪽부터 시계 방향, 기질 그룹 NT·NF·SJ·SP가 한 사분면씩) → 모래사장 → 바다
//
// 레이어
//   ground    (타일) 땅 종류. 타일셋 타일 속성 terrain(string), height(float)
//   deco      (오브젝트) 소품. name = manifest 키, type = "prop", (x, y) = 바닥 가운데 px, rotation = 방향(도, 시계 방향)
//             마을 소품은 사용자 속성 district = 유형 코드 (그 마을 색으로 칠한다)
//   collision (타일) 0이 아니면 막힘 (바다, 소품, 집터)
//   spawn     (사각형) "spawn" = 중앙광장, "spawn.ENFP" 등 = 마을 입구, "gate.ENFP" 등 = 동네 길 앞
//   lots      (점) 집터. name = "유형.번호", rotation = 집이 바라보는 방향(도). 집터는 늘 막혀 있다(빈 집터는 울타리).
//   districts (타일) 마을 땅: 1~16 = DISTRICTS 순서, 0 = 광장·길·바닷가
//
// 동네 틀 맵(buildHoodMap): 마을 1동(본섬) 집터가 다 차면 열리는 2동·3동…이 함께 쓰는 작은 섬.
//   마을은 정해 두지 않는다. 화면과 서버가 그 동네의 마을을 입힌다 (townMap.ts withDistrict).
//   lots 이름은 "hood.번호", districts 레이어는 땅 전체가 1, 마을 색 소품은 district 속성(아무 마을)만 표시해 둔다.
import { playConfig, townConfig } from '../../src/config/game';
import { DISTRICTS, THEMES, THEME_DISTRICT, themeOf, type District, type Theme } from '../../src/shared/districts';
import { fruitTreeKey } from '../../src/shared/play';
import { BEACH_TREES, FLORA, HILL_FLORA, PLAZA_TREES, TEMPLATE_BUSH, TEMPLATE_ROCK, TEMPLATE_TREE, pickWeighted } from '../../src/shared/flora';

export const TOWN_TILES = ['grass', 'grass2', 'stone', 'path', 'water', 'flowerbed', 'hedge', 'stoneEdge', 'sand'] as const;
type TileName = (typeof TOWN_TILES)[number];

/** 본섬 크기 (칸). 16개 마을이 좁지 않게 2026-11-05에 88 → 136으로 넓혔다 */
const SIZE = 136;
const T = 32;
const C = SIZE / 2;
/** 동네 틀 맵 크기 */
const HOOD_SIZE = 48;

/** 가운데에서 잰 반지름 (칸) */
export const TOWN_RADII = {
  stone: 6.5,
  stoneEdge: 7.4,
  ringIn: 11.6,
  ringOut: 13.2,
  /** 여기부터 바닷가까지가 마을 땅이다 */
  land: 13.2,
  /** 마을을 잇는 둥근 거리 둘 */
  streetA: 30,
  streetB: 46,
  /** 마을 입구 (스폰 자리)와 열매 나무 */
  entrance: 17.5,
  shore: 60,
  beach: 3.5,
} as const;

/** 집터 줄: 반지름과 그 줄의 집이 바라보는 둥근 거리. 줄마다 큰길 양쪽으로 LOT_GAP 칸 간격 */
const LOT_ROWS: { r: number; street: 'streetA' | 'streetB' }[] = [
  { r: 34.5, street: 'streetA' },
  { r: 42, street: 'streetB' },
  { r: 50.5, street: 'streetB' },
  { r: 26, street: 'streetA' },
];
const LOT_GAP = 3.6;

/** 기질 그룹마다 명소 하나 (manifest 키). 그룹 가운데(둘째·셋째 마을 사이) 안쪽 풀밭에 선다 */
const LANDMARK: Record<Theme, string> = {
  NT: 'prop.district.workshop',
  NF: 'prop.district.greenhouse',
  SJ: 'prop.district.pier',
  SP: 'prop.district.stage',
};
/** 명소가 서는 반지름 (집 줄 안쪽의 빈 풀밭) */
const LANDMARK_R = 22;

/** 동네 길(본섬 ↔ 2동·3동…) 아치 */
export const GATE_KEY = 'prop.hood.gate';

/** 마을 하나에 심을 나무·덤불·큰 돌 수 (기질 그룹 풍경마다. 어떤 종류인지는 src/shared/flora.ts) */
const PLANTING: Record<Theme, { trees: number; bushes: number; rocks: number }> = {
  NF: { trees: 34, bushes: 14, rocks: 4 },
  SP: { trees: 22, bushes: 10, rocks: 3 },
  NT: { trees: 24, bushes: 7, rocks: 4 },
  SJ: { trees: 22, bushes: 10, rocks: 3 },
};
/** 바닷가 야자수 */
const BEACH_PALMS = 40;
/** 심은 것 둘레에 비워 둘 거리 (칸) */
const SPACING = { tree: 0.95, bush: 0.7, rock: 0.8 } as const;

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

/** 마을 i의 가운데 방향 (라디안). 북쪽에서 시계 방향. */
export function districtAngle(i: number): number {
  return -Math.PI / 2 + i * SECTOR;
}

/** 기질 그룹 k(0~3)의 가운데 방향: 둘째·셋째 마을 사이 */
function themeAngle(k: number): number {
  return districtAngle(k * 4 + 1.5);
}

/** 중앙광장 장식 방향 (광장 안 길 다섯 갈래, 예전 배치를 그대로 쓴다) */
const PLAZA_SPOKES = 5;
function plazaAngle(k: number): number {
  return -Math.PI / 2 + (k * 2 * Math.PI) / PLAZA_SPOKES;
}
function plazaSpokeAt(angle: number): number {
  const step = (2 * Math.PI) / PLAZA_SPOKES;
  return ((Math.round(wrap(angle - plazaAngle(0)) / step) % PLAZA_SPOKES) + PLAZA_SPOKES) % PLAZA_SPOKES;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** 이 방향이 몇 번째 지역인지 */
function districtIndexAt(angle: number): number {
  return ((Math.round(wrap(angle - districtAngle(0)) / SECTOR) % DISTRICTS.length) + DISTRICTS.length) % DISTRICTS.length;
}

function shoreAt(angle: number): number {
  return TOWN_RADII.shore + Math.sin(angle * 4 + 0.7) * 1.0 + Math.sin(angle * 9 + 2.1) * 0.5;
}

/** 마을 i의 동네 길 아치 자리 (큰길 끝, 바닷가 조금 안쪽) */
function gateRadius(i: number): number {
  return shoreAt(districtAngle(i)) - 1.6;
}

/** 맵 하나를 그리는 도구들 (땅·충돌·지역 칸, 소품·집터 점, 좌표 계산) */
function canvas(size: number) {
  const N = size * size;
  const c = size / 2;
  const ground: number[] = new Array(N).fill(gid('water'));
  const collision: number[] = new Array(N).fill(0);
  const districtGrid: number[] = new Array(N).fill(0);
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size;
  const set = (layer: number[], x: number, y: number, v: number) => {
    if (inside(x, y)) layer[y * size + x] = v;
  };
  const get = (layer: number[], x: number, y: number) => (inside(x, y) ? layer[y * size + x] : 0);
  const block = (x: number, y: number) => set(collision, x, y, 1);
  const isBlocked = (x: number, y: number) => get(collision, Math.floor(x), Math.floor(y)) !== 0;
  const polar = (x: number, y: number) => {
    const dx = x + 0.5 - c;
    const dy = y + 0.5 - c;
    return { d: Math.hypot(dx, dy), a: Math.atan2(dy, dx) };
  };
  const objects: Record<string, unknown>[] = [];
  const lots: Record<string, unknown>[] = [];
  let nextId = 1;
  const id = () => nextId++;
  const taken: { x: number; y: number; r: number }[] = [];
  const prop = (key: string, x: number, y: number, footprint: [number, number][], rot = 0, district?: District) => {
    objects.push({
      id: id(), name: key, type: 'prop', x: x * T, y: y * T, width: 0, height: 0, point: true, rotation: rot, visible: true,
      ...(district ? { properties: [{ name: 'district', type: 'string', value: district }] } : {}),
    });
    for (const [fx, fy] of footprint) block(fx, fy);
  };
  /** 놓은 소품 중 test에 맞는 것을 뺀다 (한 칸짜리 소품만: 그 칸을 다시 지나갈 수 있게 한다). 뺀 개수 */
  const unprop = (test: (key: string, x: number, y: number) => boolean) => {
    let n = 0;
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i] as { type: string; name: string; x: number; y: number };
      if (o.type !== 'prop' || !test(o.name, o.x / T, o.y / T)) continue;
      objects.splice(i, 1);
      set(collision, Math.floor(o.x / T), Math.floor(o.y / T), 0);
      n++;
    }
    return n;
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
  const at = (r: number, a: number) => ({ x: c + Math.cos(a) * r, y: c + Math.sin(a) * r });
  const snap = (v: number) => Math.floor(v) + 0.5;
  /** 집터 하나: 점을 남기고 집 바닥을 막는다 */
  const lot = (name: string, x: number, y: number, rot: number) => {
    lots.push({ id: id(), name, type: 'lot', x: x * T, y: y * T, width: 0, height: 0, point: true, rotation: rot, visible: true });
    for (const [fx, fy] of rectTiles(x, y, 1.25, 1.15, rot)) block(fx, fy);
    taken.push({ x, y, r: 1.9 });
  };
  /** 동네 길 아치: 기둥만 막고, 앞(바라보는 쪽)에 들어서는 자리를 둔다 */
  const gate = (x: number, y: number, rot: number, district: District) => {
    const yaw = (-rot * Math.PI) / 180;
    const side = (s: number): [number, number] => [Math.floor(x + Math.cos(yaw) * s), Math.floor(y - Math.sin(yaw) * s)];
    prop(GATE_KEY, x, y, [side(-1.05), side(1.05)], rot, district);
    taken.push({ x, y, r: 2 });
  };
  /** 내 둘레 칸 중 길이 있는지 */
  const onPath = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (get(ground, Math.floor(x) + dx, Math.floor(y) + dy) === gid('path')) return true;
    }
    return false;
  };
  const spawnRect = (name: string, x: number, y: number, w: number, h: number) => ({
    id: id(), name, type: 'spawn', x: x * T, y: y * T, width: w * T, height: h * T, rotation: 0, visible: true,
  });
  const toTiled = (tilesetFile: string, spawns: unknown[]) => {
    const tileLayer = (lid: number, name: string, data: number[], opacity = 1) => ({
      id: lid, name, type: 'tilelayer', x: 0, y: 0, width: size, height: size, opacity, visible: true, data,
    });
    const objectLayer = (lid: number, name: string, objs: unknown[]) => ({
      id: lid, name, type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: objs,
    });
    return {
      type: 'map',
      version: '1.10',
      tiledversion: '1.10.2',
      orientation: 'orthogonal',
      renderorder: 'right-down',
      infinite: false,
      width: size,
      height: size,
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
          tiles: TOWN_TILES.map((name, tid) => ({
            id: tid,
            properties: [
              { name: 'terrain', type: 'string', value: name },
              ...(TILE_HEIGHT[name] ? [{ name: 'height', type: 'float', value: TILE_HEIGHT[name] }] : []),
            ],
          })),
        },
      ],
    };
  };
  return {
    ground, districtGrid, set, get, block, isBlocked, polar, taken, prop, unprop, facing, rectTiles, square, at, snap,
    lot, gate, onPath, spawnRect, toTiled,
  };
}

export function buildTownMap(tilesetFile: string) {
  const { ground, districtGrid, set, get, block, isBlocked, polar, taken, prop, unprop, facing, rectTiles, square, at, snap, lot, gate, onPath, spawnRect, toTiled } =
    canvas(SIZE);
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

  // 2. 길: 중앙광장 돌바닥, 광장 안 길 다섯 갈래, 둘레 길, 마을마다 큰길 하나(바닷가 동네 길까지), 마을을 잇는 둥근 거리 둘
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const { d, a } = polar(x, y);
      const i = districtIndexAt(a);
      const across = Math.abs(Math.sin(wrap(a - districtAngle(i))) * d);
      const toward = Math.cos(wrap(a - districtAngle(i))) > 0;
      const k = plazaSpokeAt(a);
      const plazaAcross = Math.abs(Math.sin(wrap(a - plazaAngle(k))) * d);
      if (d <= TOWN_RADII.stone) set(ground, x, y, gid('stone'));
      else if (d <= TOWN_RADII.stoneEdge) set(ground, x, y, gid('stoneEdge'));
      else if (d >= TOWN_RADII.ringIn && d < TOWN_RADII.ringOut) set(ground, x, y, gid('path'));
      else if (d < TOWN_RADII.ringIn && plazaAcross < 1.2) set(ground, x, y, gid('path'));
      else if (d >= TOWN_RADII.ringOut && toward && across < 1.2 && d < gateRadius(i) + 0.6) set(ground, x, y, gid('path'));
      else if (Math.abs(d - TOWN_RADII.streetA) < 0.95 || Math.abs(d - TOWN_RADII.streetB) < 0.85) {
        if (d < shoreAt(a) - 0.5) set(ground, x, y, gid('path'));
      }
    }
  }

  // 3. 기질 그룹 경계: 낮은 산울타리 (같은 그룹 네 마을 사이는 막지 않는다. 둥근 거리가 지나는 자리는 열어 둔다)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const { d, a } = polar(x, y);
      if (d < TOWN_RADII.ringOut + 1.5 || d > shoreAt(a) - 0.6) continue;
      const nearBoundary = THEMES.some((_, k) => Math.abs(wrap(a - (districtAngle(k * 4) - SECTOR / 2))) * d < 0.72);
      const onStreet = Math.abs(d - TOWN_RADII.streetA) < 1.4 || Math.abs(d - TOWN_RADII.streetB) < 1.3;
      if (nearBoundary && !onStreet) {
        set(ground, x, y, gid('hedge'));
        block(x, y);
      }
    }
  }

  // 4. 소품
  // 중앙광장: 분수, 게시판(오늘의 토론), 깃발, 벤치, 가로등, 화단, 나무. 큰길 사이 방향에 둔다.
  prop('prop.plaza.fountain', C, C, square(C - 1, C - 1, 3, 3));
  const between = (k: number) => plazaAngle(k) + Math.PI / PLAZA_SPOKES;
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
  for (let k = 1; k < PLAZA_SPOKES; k++) {
    const b = at(4.6, between(k));
    const rot = facing(b.x, b.y, C, C);
    prop('prop.plaza.bench', b.x, b.y, rectTiles(b.x, b.y, 0.9, 0.3, rot), rot);
  }
  for (let k = 0; k < PLAZA_SPOKES; k++) {
    const l = at(6.4, plazaAngle(k) + 0.32);
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
      prop(pickWeighted(PLAZA_TREES, rand()), snap(t.x), snap(t.y), [[Math.floor(t.x), Math.floor(t.y)]]);
      taken.push({ x: t.x, y: t.y, r: 1.2 });
    }
  }

  // 기질 그룹마다 명소 하나: 둘째·셋째 마을 사이 안쪽 풀밭. 관리자(SJ)는 작은 못과 부두
  THEMES.forEach((theme, k) => {
    const a0 = themeAngle(k);
    if (theme === 'SJ') {
      const p = at(LANDMARK_R - 2.4, a0);
      for (let y = Math.floor(p.y - 3); y <= Math.ceil(p.y + 3); y++) {
        for (let x = Math.floor(p.x - 3); x <= Math.ceil(p.x + 3); x++) {
          if (Math.hypot((x + 0.5 - p.x) / 1.9, (y + 0.5 - p.y) / 1.5) <= 1 && get(ground, x, y) !== gid('path')) {
            set(ground, x, y, gid('water'));
            block(x, y);
          }
        }
      }
      taken.push({ x: p.x, y: p.y, r: 1.9 });
    }
    const lm = at(LANDMARK_R + (theme === 'SJ' ? 0.6 : 0), a0);
    const lmRot = facing(lm.x, lm.y, C, C);
    const lmSize = theme === 'SJ' ? [0.7, 1.2] : [1.65, 1.25];
    prop(LANDMARK[theme], lm.x, lm.y, rectTiles(lm.x, lm.y, lmSize[0], lmSize[1], lmRot), lmRot, THEME_DISTRICT[theme]);
    taken.push({ x: lm.x, y: lm.y, r: 1.9 });
  });

  // 마을마다 집터: 큰길 양쪽, 바깥쪽 두 줄
  DISTRICTS.forEach((district, i) => {
    const a0 = districtAngle(i);
    // 집터: 줄마다 큰길을 비우고 양쪽으로 둔다 (집은 가까운 둥근 거리를 바라본다)
    const candidates: { x: number; y: number; rot: number; row: number; off: number }[] = [];
    LOT_ROWS.forEach((row, ri) => {
      const half = SECTOR / 2 - 1.7 / row.r;
      const step = LOT_GAP / row.r;
      for (let k = -Math.floor(half / step); k <= Math.floor(half / step); k++) {
        const da = k * step;
        if (Math.abs(da) * row.r < 2.6) continue; // 큰길
        const p = at(row.r, a0 + da);
        const target = at(TOWN_RADII[row.street], a0 + da);
        candidates.push({ x: p.x, y: p.y, rot: facing(p.x, p.y, target.x, target.y), row: ri, off: Math.abs(da) });
      }
    });
    candidates.sort((p, q) => p.row - q.row || p.off - q.off);
    const usable = candidates.filter((c) => !taken.some((t) => Math.hypot(t.x - c.x, t.y - c.y) < t.r + 1.2));
    if (usable.length < townConfig.lotsPerDistrict) throw new Error(`${district} 마을 집터가 ${usable.length}개뿐입니다`);
    usable.slice(0, townConfig.lotsPerDistrict).forEach((c, n) => lot(`${district}.${n}`, c.x, c.y, c.rot));
  });

  // 동네 길: 큰길 끝 바닷가의 아치. 1동 집터가 다 차면 열리는 2동·3동…으로 간다.
  DISTRICTS.forEach((district, i) => {
    const g = at(gateRadius(i), districtAngle(i));
    gate(g.x, g.y, facing(g.x, g.y, C, C), district);
  });

  // 스폰 자리 (지역 입구, 동네 길 앞)는 비워 둔다
  const spawnSpots = DISTRICTS.flatMap((_, i) => [at(TOWN_RADII.entrance, districtAngle(i)), at(gateRadius(i) - 2.6, districtAngle(i))]);
  const inSpawn = (x: number, y: number) => spawnSpots.some((p) => Math.abs(p.x - x) < 2.6 && Math.abs(p.y - y) < 2.6);
  const onPathTile = (x: number, y: number) => get(ground, Math.floor(x), Math.floor(y)) === gid('path');

  // 놀거리: 지역 입구의 열매 나무, 광장의 운세 나무와 비콘(낚시터·클럽).
  // 원하는 자리 근처에서 길·집터·스폰과 겹치지 않는 가장 가까운 빈 칸을 고른다.
  const freeSpot = (r: number, a: number, clear: number, size = 1) => {
    const want = at(r, a);
    for (let ring = 0; ring <= 12; ring++) {
      for (let k = 0; k < Math.max(1, ring * 6); k++) {
        const t = (k / Math.max(1, ring * 6)) * Math.PI * 2;
        const x = snap(want.x + Math.cos(t) * ring * 0.5);
        const y = snap(want.y + Math.sin(t) * ring * 0.5);
        const tiles = size > 1 ? square(Math.floor(x - size / 2 + 0.5), Math.floor(y - size / 2 + 0.5), size, size) : [[Math.floor(x), Math.floor(y)] as [number, number]];
        if (tiles.some(([tx, ty]) => isBlocked(tx + 0.5, ty + 0.5) || get(ground, tx, ty) === gid('path') || get(ground, tx, ty) === gid('stone') || get(ground, tx, ty) === gid('stoneEdge'))) continue;
        if (inSpawn(x, y)) continue;
        if (taken.some((q) => Math.hypot(q.x - x, q.y - y) < q.r + clear)) continue;
        return { x, y, tiles };
      }
    }
    throw new Error(`빈 자리를 찾지 못했습니다 (r=${r}, a=${a.toFixed(2)})`);
  };
  DISTRICTS.forEach((district, i) => {
    const a0 = districtAngle(i);
    const wants: [number, number][] = [[TOWN_RADII.entrance + 1, 0.1], [TOWN_RADII.entrance + 1, -0.1], [TOWN_RADII.entrance + 5, 0.1]].slice(0, playConfig.fruitTreesPerDistrict) as [number, number][];
    for (const [r, da] of wants) {
      const s = freeSpot(r, a0 + da, 1.3);
      prop(fruitTreeKey(themeOf(district)), s.x, s.y, s.tiles, Math.round(rand() * 360), district);
      taken.push({ x: s.x, y: s.y, r: 1.3 });
    }
  });
  {
    // 운세 나무: 광장 북서쪽 풀밭 (돌 화단 2×2)
    const s = freeSpot(8.6, plazaAngle(0) + 0.36, 1.2, 2);
    prop('prop.plaza.fortune_tree', s.x, s.y, s.tiles, facing(s.x, s.y, C, C));
    taken.push({ x: s.x, y: s.y, r: 1.6 });
    // 비콘: 광장 가장자리 (예전 배치 그대로)
    const bf = freeSpot(8.4, plazaAngle(4) + 0.36, 1.0);
    prop('prop.plaza.beacon_fishing', bf.x, bf.y, bf.tiles, facing(bf.x, bf.y, C, C));
    taken.push({ x: bf.x, y: bf.y, r: 1.2 });
    const bc = freeSpot(8.4, plazaAngle(1) + 0.36, 1.0);
    prop('prop.plaza.beacon_club', bc.x, bc.y, bc.tiles, facing(bc.x, bc.y, C, C));
    taken.push({ x: bc.x, y: bc.y, r: 1.2 });
  }

  /** 식물을 심지 않는 네모 (명소를 가리지 않게) */
  const keepClear: { x0: number; x1: number; y0: number; y1: number }[] = [];

  // 나무·덤불·큰 돌: 마을마다 그 기질 풍경 식물을 정해진 수만큼 흩어 심는다 (길·집터·명소와 떨어뜨린다)
  DISTRICTS.forEach((district, i) => {
    const f = FLORA[themeOf(district)];
    for (const kind of ['tree', 'bush', 'rock'] as const) {
      const want = PLANTING[themeOf(district)][kind === 'tree' ? 'trees' : kind === 'bush' ? 'bushes' : 'rocks'];
      const list = kind === 'tree' ? f.trees : kind === 'bush' ? f.bushes : f.rocks;
      let planted = 0;
      for (let tries = 0; tries < 6000 && planted < want; tries++) {
        const a = districtAngle(i) + (rand() - 0.5) * (SECTOR - 0.08);
        const d = TOWN_RADII.land + 1.5 + Math.sqrt(rand()) * (shoreAt(a) - TOWN_RADII.land - 2.5);
        const x = snap(C + Math.cos(a) * d);
        const y = snap(C + Math.sin(a) * d);
        // 나무는 길가에도 심는다 (가로수). 길 위와 스폰 자리는 비운다.
        if (isBlocked(x, y) || (kind === 'tree' ? onPathTile(x, y) : onPath(x, y)) || inSpawn(x, y)) continue;
        if (taken.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + SPACING[kind])) continue;
        if (keepClear.some((z) => x > z.x0 && x < z.x1 && y > z.y0 && y < z.y1)) continue;
        prop(pickWeighted(list, rand()), x, y, [[Math.floor(x), Math.floor(y)]], Math.round(rand() * 360), district);
        taken.push({ x, y, r: SPACING[kind] });
        planted++;
      }
    }
  });

  // 바닷가 야자수 (모래사장 위)
  {
    let planted = 0;
    for (let tries = 0; tries < 3000 && planted < BEACH_PALMS; tries++) {
      const a = rand() * 2 * Math.PI;
      const d = shoreAt(a) + 0.4 + rand() * (TOWN_RADII.beach - 1.2);
      const x = snap(C + Math.cos(a) * d);
      const y = snap(C + Math.sin(a) * d);
      if (get(ground, Math.floor(x), Math.floor(y)) !== gid('sand') || isBlocked(x, y) || onPath(x, y)) continue;
      if (taken.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + 2)) continue;
      prop(pickWeighted(BEACH_TREES, rand()), x, y, [[Math.floor(x), Math.floor(y)]], Math.round(rand() * 360));
      taken.push({ x, y, r: 1.2 });
      planted++;
    }
  }

  // 4-1. 상가 비콘: 광장 가장자리 (맨 나중에 놓아서 앞의 배치가 그대로다)
  {
    const bm = freeSpot(8.4, plazaAngle(2) + 0.36, 1.0);
    prop('prop.plaza.beacon_market', bm.x, bm.y, bm.tiles, facing(bm.x, bm.y, C, C));
    taken.push({ x: bm.x, y: bm.y, r: 1.2 });
  }

  // 4-3. 광장 전광판 (MBTI 마을 대항전 순위·오늘의 토론·소식): 분수 북서쪽 광장 가장자리, 스폰 쪽을 본다.
  // 맨 나중에 놓아서 앞의 배치가 그대로다. 폭 7칸쯤을 막는다 (화면 아래로 지나가지 않게)
  {
    const want = { x: C - 3, y: C - 6.3 };
    let best: { x: number; y: number; rot: number; tiles: [number, number][] } | null = null;
    let bestD = Infinity;
    for (let dy = -2; dy <= 2; dy += 0.5) {
      for (let dx = -2; dx <= 2; dx += 0.5) {
        const x = want.x + dx;
        const y = want.y + dy;
        const rot = facing(x, y, C, C + 4);
        const tiles = rectTiles(x, y, 3.55, 0.3, rot);
        if (tiles.some(([tx, ty]) => isBlocked(tx + 0.5, ty + 0.5) || get(ground, tx, ty) === gid('path') || get(ground, tx, ty) === gid('water'))) continue;
        if (inSpawn(x, y)) continue;
        const d = Math.hypot(dx, dy);
        if (d < bestD) {
          bestD = d;
          best = { x, y, rot, tiles };
        }
      }
    }
    if (!best) throw new Error('광장 전광판 자리를 찾지 못했습니다');
    prop('prop.plaza.screen', best.x, best.y, best.tiles, best.rot);
    taken.push({ x: best.x, y: best.y, r: 3.8 });
    // 화면 앞을 가리는 식물은 뺀다
    const b = best;
    unprop((key, x, y) => /^prop\.nature\./.test(key) && Math.hypot(x - b.x, y - b.y) < 4.2);
  }

  // 5. 스폰: 광장은 분수 남쪽, 마을은 큰길 입구, 동네 길은 아치 앞
  const spawns = [
    spawnRect('spawn', C - 3, C + 3, 6, 2),
    ...DISTRICTS.map((d, i) => {
      const p = at(TOWN_RADII.entrance, districtAngle(i));
      return spawnRect(`spawn.${d}`, p.x - 1.5, p.y - 1.5, 3, 3);
    }),
    ...DISTRICTS.map((d, i) => {
      const p = at(gateRadius(i) - 2.6, districtAngle(i));
      return spawnRect(`gate.${d}`, p.x - 1, p.y - 1, 2, 2);
    }),
  ];
  return toTiled(tilesetFile, spawns);
}

// ───────────────────────── 동네 틀 맵 (2동·3동…) ─────────────────────────

/** 동네 틀 맵에서 가운데부터 잰 반지름 (칸) */
export const HOOD_RADII = {
  stone: 3.2,
  stoneEdge: 3.9,
  /** 안쪽 집 줄 (바깥을 본다) */
  inner: 6.9,
  ringIn: 9.4,
  ringOut: 10.8,
  /** 바깥 집 줄 (안쪽 둘레 길을 본다) */
  outer: 13.6,
  shore: 19.6,
  beach: 2.2,
} as const;

/** 들어오는 길(동네 길 아치)은 남쪽 */
const HOOD_ENTRANCE = Math.PI / 2;
/** 가운데에서 둘레 길로 가는 길 넷 (북·동·남·서). 남쪽 길만 바닷가 아치까지 이어진다. */
const HOOD_SPOKES = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
const HOOD_PLANTING = { trees: 30, bushes: 14, rocks: 5 } as const;

function hoodShoreAt(angle: number): number {
  return HOOD_RADII.shore + Math.sin(angle * 3 + 0.4) * 0.8 + Math.sin(angle * 7 + 1.3) * 0.4;
}

export function buildHoodMap(tilesetFile: string) {
  const { ground, districtGrid, set, block, isBlocked, polar, taken, prop, facing, square, at, snap, lot, gate, onPath, spawnRect, toTiled } =
    canvas(HOOD_SIZE);
  const c = HOOD_SIZE / 2;
  const rand = rng(20261103);
  // 지역 색 소품에는 아무 지역이나 표시해 둔다. 실제 지역은 화면·서버가 입힌다.
  const ANY: District = DISTRICTS[0];
  const gateR = hoodShoreAt(HOOD_ENTRANCE) - 1.6;

  // 1. 섬과 길
  for (let y = 0; y < HOOD_SIZE; y++) {
    for (let x = 0; x < HOOD_SIZE; x++) {
      const { d, a } = polar(x, y);
      const shore = hoodShoreAt(a);
      if (d < shore) {
        set(ground, x, y, rand() < 0.22 ? gid('grass2') : gid('grass'));
        set(districtGrid, x, y, 1);
      } else if (d < shore + HOOD_RADII.beach) {
        set(ground, x, y, gid('sand'));
        continue;
      } else {
        block(x, y);
        continue;
      }
      const spoke = HOOD_SPOKES.some((s) => {
        const across = Math.abs(Math.sin(wrap(a - s)) * d);
        const toward = Math.cos(wrap(a - s)) > 0;
        const end = s === HOOD_ENTRANCE ? gateR + 0.6 : HOOD_RADII.ringOut;
        return toward && across < 1.1 && d < end;
      });
      if (d <= HOOD_RADII.stone) set(ground, x, y, gid('stone'));
      else if (d <= HOOD_RADII.stoneEdge) set(ground, x, y, gid('stoneEdge'));
      else if ((d >= HOOD_RADII.ringIn && d < HOOD_RADII.ringOut) || spoke) set(ground, x, y, gid('path'));
    }
  }

  // 2. 동네 쉼터: 가운데 큰 나무, 벤치 둘, 가로등 둘
  prop(TEMPLATE_TREE, c, c, square(c - 1, c - 1, 2, 2), 0, ANY);
  taken.push({ x: c, y: c, r: 3.9 });
  for (const a of [-Math.PI / 4, (-3 * Math.PI) / 4]) {
    const b = at(2.6, a);
    prop('prop.plaza.bench', b.x, b.y, [[Math.floor(b.x), Math.floor(b.y)]], facing(b.x, b.y, c, c));
  }
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4]) {
    const l = at(3.5, a);
    prop('prop.plaza.lamp', snap(l.x), snap(l.y), [[Math.floor(l.x), Math.floor(l.y)]]);
  }

  // 3. 동네 길 아치 (본섬으로 돌아가는 길)
  {
    const g = at(gateR, HOOD_ENTRANCE);
    gate(g.x, g.y, facing(g.x, g.y, c, c), ANY);
  }

  // 4. 집터: 안쪽 줄(바깥을 본다) → 바깥 줄(안쪽 둘레 길을 본다), 줄마다 들어오는 길에서 가까운 순서
  const candidates: { x: number; y: number; rot: number; row: number; off: number }[] = [];
  [
    { r: HOOD_RADII.inner, face: HOOD_RADII.ringIn, spokes: HOOD_SPOKES },
    { r: HOOD_RADII.outer, face: HOOD_RADII.ringOut, spokes: [HOOD_ENTRANCE] },
  ].forEach((row, ri) => {
    const n = Math.floor((2 * Math.PI * row.r) / 3.35);
    for (let k = 0; k < n; k++) {
      const a = HOOD_ENTRANCE + (k * 2 * Math.PI) / n;
      if (row.spokes.some((s) => Math.abs(wrap(a - s)) * row.r < 2.6)) continue;
      const p = at(row.r, a);
      const t = at(row.face, a);
      candidates.push({ x: p.x, y: p.y, rot: facing(p.x, p.y, t.x, t.y), row: ri, off: Math.abs(wrap(a - HOOD_ENTRANCE)) });
    }
  });
  candidates.sort((p, q) => p.row - q.row || p.off - q.off);
  const usable = candidates.filter((cd) => !taken.some((t) => Math.hypot(t.x - cd.x, t.y - cd.y) < t.r + 1.2));
  if (usable.length < townConfig.hoodLots) throw new Error(`동네 집터가 ${usable.length}개뿐입니다`);
  usable.slice(0, townConfig.hoodLots).forEach((cd, n) => lot(`hood.${n}`, cd.x, cd.y, cd.rot));

  // 5. 나무·덤불·돌: 바깥 집 줄과 바닷가 사이. 자리표시 키로 심고, 지역을 입힐 때 그 지역 식물로 바뀐다.
  for (const [kind, key, want] of [
    ['tree', TEMPLATE_TREE, HOOD_PLANTING.trees],
    ['bush', TEMPLATE_BUSH, HOOD_PLANTING.bushes],
    ['rock', TEMPLATE_ROCK, HOOD_PLANTING.rocks],
  ] as const) {
    let planted = 0;
    for (let tries = 0; tries < 4000 && planted < want; tries++) {
      const a = rand() * 2 * Math.PI;
      const d = HOOD_RADII.outer + 1.8 + rand() * (hoodShoreAt(a) - HOOD_RADII.outer - 2.8);
      const x = snap(c + Math.cos(a) * d);
      const y = snap(c + Math.sin(a) * d);
      if (isBlocked(x, y) || onPath(x, y)) continue;
      if (taken.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + SPACING[kind])) continue;
      prop(key, x, y, [[Math.floor(x), Math.floor(y)]], Math.round(rand() * 360), ANY);
      taken.push({ x, y, r: SPACING[kind] });
      planted++;
    }
  }

  // 6. 스폰: 아치 앞 (들어오는 곳)
  const s = at(gateR - 2.6, HOOD_ENTRANCE);
  return toTiled(tilesetFile, [spawnRect('spawn', s.x - 1.5, s.y - 1, 3, 2)]);
}

// ───────────────────────── 놀이터 맵: 낚시터·클럽 ─────────────────────────
// 중앙광장의 비콘으로 가는 작은 섬. 집터는 없고, 남쪽 비콘으로 광장에 돌아간다.

const SPOT_SIZE = 48;
const SOUTH = Math.PI / 2;

export function buildSpotMap(kind: 'fishing' | 'club' | 'market', tilesetFile: string) {
  if (kind === 'club') return buildClubMap(tilesetFile);
  if (kind === 'market') return buildMarketMap(tilesetFile);
  const { ground, set, get, block, isBlocked, polar, taken, prop, facing, square, at, snap, onPath, spawnRect, toTiled } = canvas(SPOT_SIZE);
  const c = SPOT_SIZE / 2;
  const rand = rng(kind === 'fishing' ? 20261104 : 20261105);
  const shoreAt = (a: number) => (kind === 'fishing' ? 18 : 15.5) + Math.sin(a * 3 + 0.7) * 0.8 + Math.sin(a * 5 + 1.1) * 0.4;
  const beaconR = shoreAt(SOUTH) - 3.2;
  // 낚시터 연못 (타원): 가운데보다 조금 북쪽
  const pond = { x: c, y: c - 2.5, rx: 8.5, ry: 6.2 };
  const inPond = (x: number, y: number, k = 1) => Math.hypot((x + 0.5 - pond.x) / pond.rx, (y + 0.5 - pond.y) / pond.ry) <= k;

  // 1. 섬: 잔디 → 모래사장 → 바다
  for (let y = 0; y < SPOT_SIZE; y++) {
    for (let x = 0; x < SPOT_SIZE; x++) {
      const { d, a } = polar(x, y);
      const shore = shoreAt(a);
      if (d < shore) set(ground, x, y, rand() < 0.22 ? gid('grass2') : gid('grass'));
      else if (d < shore + 2.4) set(ground, x, y, gid('sand'));
      else block(x, y);
    }
  }

  // 2. 길과 바닥
  for (let y = 0; y < SPOT_SIZE; y++) {
    for (let x = 0; x < SPOT_SIZE; x++) {
      const { d } = polar(x, y);
      if (d >= shoreAt(polar(x, y).a)) continue;
      const southPath = Math.abs(x + 0.5 - c) < 1.2 && y + 0.5 > c && y + 0.5 < c + beaconR + 1.5;
      if (inPond(x, y)) {
        set(ground, x, y, gid('water'));
        block(x, y);
      } else if (inPond(x, y, 1.28) || (southPath && !inPond(x, y, 1))) set(ground, x, y, gid('path'));
    }
  }

  // 3. 소품: 부두, 연못 둘레 벤치·가로등
  // 부두: 연못 남쪽 가장자리에서 연못 쪽을 본다
  const pier = { x: c + 3.5, y: pond.y + pond.ry - 0.6 };
  prop('prop.district.pier', pier.x, pier.y, [], 180, THEME_DISTRICT.SJ);
  taken.push({ x: pier.x, y: pier.y, r: 1.8 });
  // 연못 둘레 벤치·가로등
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2;
    const p = { x: pond.x + Math.cos(a) * pond.rx * 1.42, y: pond.y + Math.sin(a) * pond.ry * 1.42 };
    if (Math.abs(p.x - c) < 2 && p.y > c) continue;
    const key = k % 2 ? 'prop.plaza.bench' : 'prop.plaza.lamp';
    const x = snap(p.x);
    const y = snap(p.y);
    if (isBlocked(x, y) || get(ground, Math.floor(x), Math.floor(y)) === gid('path')) continue;
    prop(key, x, y, [[Math.floor(x), Math.floor(y)]], key === 'prop.plaza.bench' ? facing(x, y, pond.x, pond.y) : 0);
    taken.push({ x, y, r: 1.2 });
  }
  // 광장으로 돌아가는 비콘 (남쪽 길 옆)
  {
    const b = at(beaconR, SOUTH);
    const x = snap(b.x + 2.2);
    const y = snap(b.y);
    prop(kind === 'fishing' ? 'prop.plaza.beacon_fishing' : 'prop.plaza.beacon_club', x, y, [[Math.floor(x), Math.floor(y)]], 180);
    taken.push({ x, y, r: 1.4 });
  }

  // 4. 나무: 길·연못·무대와 떨어진 곳 (낚시터는 호숫가(SJ), 클럽은 노을 거리(SP) 식물)
  const flora = FLORA[kind === 'fishing' ? 'SJ' : 'SP'];
  const spawnAt = at(beaconR - 1.2, SOUTH);
  for (const [kindKey, list, want] of [
    ['tree', flora.trees, kind === 'fishing' ? 40 : 28],
    ['bush', flora.bushes, 16],
    ['rock', flora.rocks, 6],
  ] as const) {
    let planted = 0;
    for (let tries = 0; tries < 4000 && planted < want; tries++) {
      const a = rand() * 2 * Math.PI;
      const inner = kind === 'fishing' ? 0 : 10.8;
      const d = inner + Math.sqrt(rand()) * (shoreAt(a) - inner - 0.8);
      const x = snap(c + Math.cos(a) * d);
      const y = snap(c + Math.sin(a) * d);
      if (isBlocked(x, y) || onPath(x, y)) continue;
      if (kind === 'fishing' && inPond(x, y, 1.45)) continue;
      if (Math.hypot(x - spawnAt.x, y - spawnAt.y) < 3) continue;
      if (taken.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + SPACING[kindKey])) continue;
      prop(pickWeighted(list, rand()), x, y, [[Math.floor(x), Math.floor(y)]], Math.round(rand() * 360), THEME_DISTRICT[kind === 'fishing' ? 'SJ' : 'SP']);
      taken.push({ x, y, r: SPACING[kindKey] });
      planted++;
    }
  }
  // 바닷가 야자수
  for (let k = 0, planted = 0; k < 1500 && planted < 10; k++) {
    const a = rand() * 2 * Math.PI;
    const d = shoreAt(a) + 0.4 + rand() * 1.2;
    const x = snap(c + Math.cos(a) * d);
    const y = snap(c + Math.sin(a) * d);
    if (get(ground, Math.floor(x), Math.floor(y)) !== gid('sand') || isBlocked(x, y)) continue;
    if (Math.abs(wrap(a - SOUTH)) < 0.3 || taken.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + 2)) continue;
    prop(pickWeighted(BEACH_TREES, rand()), x, y, [[Math.floor(x), Math.floor(y)]], Math.round(rand() * 360));
    taken.push({ x, y, r: 1.2 });
    planted++;
  }

  // 5. 스폰: 남쪽 비콘 앞
  return toTiled(tilesetFile, [spawnRect('spawn', spawnAt.x - 1.5, spawnAt.y - 1, 3, 2)]);
}

// ───────────────────────── 실내 클럽 ─────────────────────────
// 사방이 벽으로 막힌 홀. 벽 밖은 비워 둔다 (화면은 어둠으로 그린다).
// 가운데 무대(춤추는 바닥), 북쪽 DJ 부스와 스피커, 동쪽 바, 서쪽 소파, 남쪽 출입문과 광장으로 돌아가는 비콘.

const CLUB_SIZE = 36;
/** 홀 안쪽 칸 범위: 가로 20칸, 세로 18칸 (가운데가 맵 가운데) */
export const CLUB_HALL = { halfW: 10, halfD: 9 };

function buildClubMap(tilesetFile: string) {
  const { ground, set, block, prop, facing, rectTiles, square, spawnRect, toTiled } = canvas(CLUB_SIZE);
  const c = CLUB_SIZE / 2;
  const x0 = c - CLUB_HALL.halfW;
  const x1 = c + CLUB_HALL.halfW;
  const y0 = c - CLUB_HALL.halfD;
  const y1 = c + CLUB_HALL.halfD;

  // 1. 바닥: 홀 안은 돌바닥(화면이 짙은 클럽 바닥으로 칠한다), 벽 자리는 테두리, 밖은 막힌 빈 곳
  for (let y = 0; y < CLUB_SIZE; y++) {
    for (let x = 0; x < CLUB_SIZE; x++) {
      const hall = x >= x0 && x < x1 && y >= y0 && y < y1;
      const ring = x >= x0 - 1 && x <= x1 && y >= y0 - 1 && y <= y1;
      if (hall) set(ground, x, y, gid('stone'));
      else {
        if (ring) set(ground, x, y, gid('stoneEdge'));
        block(x, y);
      }
    }
  }

  // 2. 벽: 폭 2칸짜리 벽을 홀 둘레에 세운다. 벽 안쪽 면이 홀 경계에 오게 둔다 (정면 = 홀 안쪽)
  const T2 = 0.2;
  for (let x = x0 - 1; x <= x1; x += 2) {
    prop('prop.club.wall', x + 1, y0 - T2, [], 0);
    // 남쪽 가운데는 출입문
    prop(x + 1 === c ? 'prop.club.door' : 'prop.club.wall', x + 1, y1 + T2, [], 180);
  }
  for (let y = y0; y < y1; y += 2) {
    prop('prop.club.wall', x0 - T2, y + 1, [], facing(x0, y + 1, c, y + 1));
    prop('prop.club.wall', x1 + T2, y + 1, [], facing(x1, y + 1, c, y + 1));
  }

  // 3. 북쪽 DJ 부스와 스피커 둘 (홀 쪽을 본다)
  // 부스 뒤 한 줄은 비워 둔다 (DJ 자리에 설 수 있다)
  const booth = { x: c, y: y0 + 2.5 };
  prop('prop.club.booth', booth.x, booth.y, square(Math.floor(booth.x) - 1, Math.floor(booth.y), 3, 1), 0);
  for (const s of [-1, 1]) {
    const sp = { x: c + s * 3.8 + 0.5 * s, y: y0 + 1.6 };
    prop('prop.club.speaker', sp.x, sp.y, [[Math.floor(sp.x), Math.floor(sp.y)]], facing(sp.x, sp.y, c, c));
  }

  // 4. 동쪽 바 (서쪽을 본다): 벽에 붙인다
  {
    const rot = facing(x1, c, c, c);
    const bar = { x: x1 - 0.95, y: c - 2 };
    // 선반·카운터·의자 자리 (벽 쪽 세 칸 × 네 칸. 카운터와 의자가 홀 쪽으로 나와 있다)
    prop('prop.club.bar', bar.x, bar.y, square(x1 - 3, bar.y - 2, 3, 4), rot);
  }

  // 5. 서쪽 소파 둘 (동쪽을 본다)
  for (const y of [c - 4, c + 3]) {
    const rot = facing(x0, y, c, y);
    const sofa = { x: x0 + 0.55, y };
    prop('prop.club.sofa', sofa.x, sofa.y, rectTiles(sofa.x, sofa.y, 1.2, 0.45, rot), rot);
  }

  // 6. 광장으로 돌아가는 비콘: 출입문 옆 안쪽
  {
    const x = c + 2.5;
    const y = y1 - 1.5;
    prop('prop.plaza.beacon_club', x, y, [[Math.floor(x), Math.floor(y)]], 180);
  }

  // 7. 스폰: 출입문 앞
  return toTiled(tilesetFile, [spawnRect('spawn', c - 1.5, y1 - 3.5, 3, 2)]);
}

// ───────────────────────── 상가 ─────────────────────────
// 중앙광장 비콘(언덕 지역 쪽)으로 가는 섬. 가운데 분수 광장을 점포 20칸이 네모나게 둘러싼다 (모두 광장 쪽을 본다).
// 점포 번호는 소품 순서 그대로: 북서쪽에서 시계 방향으로 1~20호 (북 6 · 동 5 · 남 4 · 서 5). 남쪽 가운데는 입구.

/** 점포가 광장 가운데에서 떨어진 거리 (칸) */
const STALL_RING = 9;

function buildMarketMap(tilesetFile: string) {
  const { ground, set, get, block, isBlocked, polar, taken, prop, facing, rectTiles, square, at, snap, onPath, spawnRect, toTiled } = canvas(SPOT_SIZE);
  const c = SPOT_SIZE / 2;
  const rand = rng(20261106);
  const shoreAt = (a: number) => 19.6 + Math.sin(a * 3 + 0.4) * 0.6 + Math.sin(a * 5 + 1.7) * 0.3;
  const beaconR = shoreAt(SOUTH) - 3.0;
  const PLAZA = 10.5;
  const inPlaza = (x: number, y: number) => Math.abs(x + 0.5 - c) <= PLAZA && Math.abs(y + 0.5 - c) <= PLAZA;

  // 1. 섬: 잔디 → 모래사장 → 바다. 가운데 네모난 돌바닥 광장, 남쪽 입구 길
  for (let y = 0; y < SPOT_SIZE; y++) {
    for (let x = 0; x < SPOT_SIZE; x++) {
      const { d, a } = polar(x, y);
      const shore = shoreAt(a);
      if (d >= shore + 2.4) {
        block(x, y);
        continue;
      }
      if (d >= shore) set(ground, x, y, gid('sand'));
      else if (inPlaza(x, y)) set(ground, x, y, Math.abs(x + 0.5 - c) > PLAZA - 1 || Math.abs(y + 0.5 - c) > PLAZA - 1 ? gid('stoneEdge') : gid('stone'));
      else if (Math.abs(x + 0.5 - c) < 1.3 && y + 0.5 > c && y + 0.5 < c + beaconR + 1.5) set(ground, x, y, gid('path'));
      else set(ground, x, y, rand() < 0.22 ? gid('grass2') : gid('grass'));
    }
  }

  // 2. 점포 20칸 (정면 = 광장 가운데 쪽)
  const stalls: { x: number; y: number }[] = [
    ...[-8, -4.8, -1.6, 1.6, 4.8, 8].map((dx) => ({ x: c + dx, y: c - STALL_RING })),
    ...[-6.4, -3.2, 0, 3.2, 6.4].map((dy) => ({ x: c + STALL_RING, y: c + dy })),
    ...[8, 4.8, -4.8, -8].map((dx) => ({ x: c + dx, y: c + STALL_RING })),
    ...[6.4, 3.2, 0, -3.2, -6.4].map((dy) => ({ x: c - STALL_RING, y: c + dy })),
  ];
  for (const st of stalls) {
    // 가로줄은 남북을, 세로줄은 동서를 본다
    const rot = Math.abs(st.y - c) === STALL_RING ? facing(st.x, st.y, st.x, c) : facing(st.x, st.y, c, st.y);
    prop('prop.market.stall', st.x, st.y, rectTiles(st.x, st.y, 1.2, 0.65, rot), rot);
    taken.push({ x: st.x, y: st.y, r: 1.8 });
  }

  // 3. 가운데 분수, 둘레 가로등·벤치 (남쪽 입구 쪽 벤치는 비운다)
  prop('prop.plaza.fountain', c, c, square(c - 1, c - 1, 3, 3));
  taken.push({ x: c, y: c, r: 2.4 });
  for (const [dx, dy] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]]) {
    const x = snap(c + dx);
    const y = snap(c + dy);
    prop('prop.plaza.lamp', x, y, [[Math.floor(x), Math.floor(y)]]);
    taken.push({ x, y, r: 1 });
  }
  for (const [dx, dy] of [[0, -4.6], [4.6, 0], [-4.6, 0]]) {
    const x = c + dx;
    const y = c + dy;
    prop('prop.plaza.bench', x, y, [[Math.floor(x), Math.floor(y)]], facing(x, y, c, c));
    taken.push({ x, y, r: 1.2 });
  }

  // 4. 광장으로 돌아가는 비콘 (남쪽 길 옆)
  {
    const b = at(beaconR, SOUTH);
    const x = snap(b.x + 2.2);
    const y = snap(b.y);
    prop('prop.plaza.beacon_market', x, y, [[Math.floor(x), Math.floor(y)]], 180);
    taken.push({ x, y, r: 1.4 });
  }

  // 5. 나무: 광장 밖 풀밭 (언덕 풍경 식물)
  const flora = HILL_FLORA;
  const spawnAt = at(beaconR - 1.2, SOUTH);
  for (const [kindKey, list, want] of [
    ['tree', flora.trees, 30],
    ['bush', flora.bushes, 16],
    ['rock', flora.rocks, 5],
  ] as const) {
    let planted = 0;
    for (let tries = 0; tries < 4000 && planted < want; tries++) {
      const a = rand() * 2 * Math.PI;
      const d = PLAZA + 1.5 + Math.sqrt(rand()) * Math.max(0, shoreAt(a) - PLAZA - 2.3);
      const x = snap(c + Math.cos(a) * d);
      const y = snap(c + Math.sin(a) * d);
      if (isBlocked(x, y) || onPath(x, y) || inPlaza(Math.floor(x), Math.floor(y))) continue;
      if (Math.hypot(x - spawnAt.x, y - spawnAt.y) < 3) continue;
      if (taken.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + SPACING[kindKey])) continue;
      prop(pickWeighted(list, rand()), x, y, [[Math.floor(x), Math.floor(y)]], Math.round(rand() * 360));
      taken.push({ x, y, r: SPACING[kindKey] });
      planted++;
    }
  }
  // 바닷가 야자수
  for (let k = 0, planted = 0; k < 1500 && planted < 8; k++) {
    const a = rand() * 2 * Math.PI;
    const d = shoreAt(a) + 0.4 + rand() * 1.2;
    const x = snap(c + Math.cos(a) * d);
    const y = snap(c + Math.sin(a) * d);
    if (get(ground, Math.floor(x), Math.floor(y)) !== gid('sand') || isBlocked(x, y)) continue;
    if (Math.abs(wrap(a - SOUTH)) < 0.3 || taken.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + 2)) continue;
    prop(pickWeighted(BEACH_TREES, rand()), x, y, [[Math.floor(x), Math.floor(y)]], Math.round(rand() * 360));
    taken.push({ x, y, r: 1.2 });
    planted++;
  }

  // 6. 스폰: 남쪽 비콘 앞
  return toTiled(tilesetFile, [spawnRect('spawn', spawnAt.x - 1.5, spawnAt.y - 1, 3, 2)]);
}
