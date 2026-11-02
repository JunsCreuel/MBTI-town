// 마을 전체 초기 맵(Tiled JSON)을 만든다. 한 번 만든 뒤에는 Tiled에서 직접 고친다.
// 구조: 가운데 광장 → 둘레 길 → 16개 유형 마을(땅) → 모래사장 → 바다
//
// 레이어
//   ground    (타일) 땅 종류. 타일셋 타일 속성 terrain(string), height(float)
//   deco      (오브젝트) 소품. name = manifest 키, type = "prop", (x, y) = 바닥 가운데 px, rotation = 방향(도, 시계 방향)
//             마을 소품은 property "village" = 유형 코드 (그 유형 색으로 칠한다)
//   collision (타일) 0이 아니면 막힘
//   spawn     (사각형) "spawn" = 광장, "spawn.ENFP" = ENFP 마을
//   villages  (점) name = 유형 코드, (x, y) = 마을 한가운데
//   territory (타일) 0이 아니면 땅따먹기로 주인이 바뀌는 땅
import { MBTI_TYPES } from '../../src/design/mbti';

export const TOWN_TILES = ['grass', 'grass2', 'stone', 'path', 'water', 'flowerbed', 'hedge', 'stoneEdge', 'sand'] as const;
type TileName = (typeof TOWN_TILES)[number];

const SIZE = 96;
const T = 32;
const C = SIZE / 2;

/** 가운데에서 잰 반지름 (칸) */
export const TOWN_RADII = {
  stone: 6.5,
  stoneEdge: 7.4,
  ringIn: 12,
  ringOut: 13.6,
  /** 여기부터 바닷가까지가 유형 마을 땅이다 */
  land: 14.5,
  village: 27,
  shore: 41,
  beach: 3.2,
} as const;

const gid = (name: TileName) => TOWN_TILES.indexOf(name) + 1;
const TILE_HEIGHT: Partial<Record<TileName, number>> = { stone: 0.05, stoneEdge: 0.05, flowerbed: 0.18, hedge: 0.75 };

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 마을 i의 방향 (라디안). 북쪽에서 시계 방향으로 MBTI_TYPES 순서. 네 기질 그룹이 한 사분면씩 차지한다. */
export function villageAngle(i: number): number {
  return -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / MBTI_TYPES.length;
}

/** 바닷가 반지름. 둥근 섬이 너무 반듯해 보이지 않게 살짝 굽힌다. */
function shoreAt(angle: number): number {
  return TOWN_RADII.shore + Math.sin(angle * 5 + 0.7) * 1.1 + Math.sin(angle * 9 + 2.1) * 0.6;
}

export function buildTownMap(tilesetFile: string) {
  const N = SIZE * SIZE;
  const ground: number[] = new Array(N).fill(gid('water'));
  const collision: number[] = new Array(N).fill(0);
  const territory: number[] = new Array(N).fill(0);
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
  const rand = rng(20261103);

  // 1. 섬: 잔디 → 모래사장 → 바다
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const { d, a } = polar(x, y);
      const shore = shoreAt(a);
      if (d < shore) {
        set(ground, x, y, rand() < 0.22 ? gid('grass2') : gid('grass'));
        if (d >= TOWN_RADII.land) set(territory, x, y, 1);
      } else if (d < shore + TOWN_RADII.beach) {
        set(ground, x, y, gid('sand'));
      } else {
        block(x, y);
      }
    }
  }

  // 2. 가운데 광장: 원형 돌바닥, 동서남북 길, 둘레 길
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const { d } = polar(x, y);
      const cx = Math.abs(x + 0.5 - C);
      const cy = Math.abs(y + 0.5 - C);
      if (d <= TOWN_RADII.stone) set(ground, x, y, gid('stone'));
      else if (d <= TOWN_RADII.stoneEdge) set(ground, x, y, gid('stoneEdge'));
      else if (d < TOWN_RADII.ringOut && ((cx < 1.5) || (cy < 1.5) || d >= TOWN_RADII.ringIn)) set(ground, x, y, gid('path'));
    }
  }

  // 3. 유형 마을: 광장 둘레 길에서 마을 마당까지 이어지는 길과 마당
  const villages = MBTI_TYPES.map((code, i) => {
    const a = villageAngle(i);
    const u = { x: Math.cos(a), y: Math.sin(a) };
    const v = { x: -u.y, y: u.x };
    const cx = Math.floor(C + u.x * TOWN_RADII.village) + 0.5;
    const cy = Math.floor(C + u.y * TOWN_RADII.village) + 0.5;
    return { code, a, u, v, cx, cy };
  });
  for (const vil of villages) {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const px = x + 0.5 - C;
        const py = y + 0.5 - C;
        const along = px * vil.u.x + py * vil.u.y;
        const across = Math.abs(px * vil.v.x + py * vil.v.y);
        const toCenter = Math.hypot(x + 0.5 - vil.cx, y + 0.5 - vil.cy);
        if (toCenter <= 3.1 || (across < 1 && along > TOWN_RADII.ringIn && along < TOWN_RADII.village)) {
          set(ground, x, y, gid('path'));
        }
      }
    }
  }

  // 4. 소품. (x, y)는 소품 바닥 가운데 (칸 단위), footprint는 막히는 칸, rot는 방향 (도, 시계 방향)
  const objects: Record<string, unknown>[] = [];
  let nextId = 1;
  const taken: { x: number; y: number; r: number }[] = [];
  const prop = (key: string, x: number, y: number, footprint: [number, number][], rot = 0, village?: string) => {
    objects.push({
      id: nextId++, name: key, type: 'prop', x: x * T, y: y * T, width: 0, height: 0, point: true, rotation: rot, visible: true,
      ...(village ? { properties: [{ name: 'village', type: 'string', value: village }] } : {}),
    });
    for (const [fx, fy] of footprint) block(fx, fy);
  };
  /** (x, y)에서 (tx, ty)를 바라보는 Tiled 회전 각도 (모델 정면 = +Z = 남쪽) */
  const facing = (x: number, y: number, tx: number, ty: number) => {
    const yaw = Math.atan2(tx - x, ty - y);
    return Math.round((-yaw * 180) / Math.PI);
  };
  /** 회전한 직사각형이 덮는 칸 */
  const rectTiles = (x: number, y: number, hw: number, hd: number, rotDeg: number): [number, number][] => {
    const yaw = (-rotDeg * Math.PI) / 180;
    const out: [number, number][] = [];
    for (let ty = Math.floor(y - 3); ty <= Math.ceil(y + 3); ty++) {
      for (let tx = Math.floor(x - 3); tx <= Math.ceil(x + 3); tx++) {
        const dx = tx + 0.5 - x;
        const dy = ty + 0.5 - y;
        // 월드 → 모델 좌표 (yaw만큼 반대로 돌린다)
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

  // 광장: 분수, 토론 게시판, 깃발, 벤치, 가로등, 화단, 나무 (예전 광장과 같은 배치)
  prop('prop.plaza.fountain', C, C, square(C - 1, C - 1, 3, 3));
  prop('prop.plaza.board', C + 0.5, C - 6.5, [[C - 1, C - 7], [C, C - 7], [C + 1, C - 7]]);
  prop('prop.plaza.flag', C - 2.5, C - 6.5, [[C - 3, C - 7]]);
  prop('prop.plaza.flag', C + 3.5, C - 6.5, [[C + 3, C - 7]]);
  for (const [x, y, rot] of [[-5, -3, 0], [4, -3, 0], [-5, 4, 180], [4, 4, 180]]) {
    prop('prop.plaza.bench', C + x + 1, C + y + 0.5, [[C + x, C + y], [C + x + 1, C + y]], rot);
  }
  for (const [x, y] of [[-6, -2], [6, -2], [-6, 2], [6, 2]]) prop('prop.plaza.lamp', C + x + 0.5, C + y + 0.5, [[C + x, C + y]]);
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const fx = Math.floor(C + Math.cos(a) * 9.6 - 1);
    const fy = Math.floor(C + Math.sin(a) * 9.6 - 1);
    for (const [x, y] of square(fx, fy, 2, 2)) {
      set(ground, x, y, gid('flowerbed'));
      block(x, y);
    }
    taken.push({ x: fx + 1, y: fy + 1, r: 2 });
  }
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    const x = Math.floor(C + Math.cos(a) * 10) + 0.5;
    const y = Math.floor(C + Math.sin(a) * 10) + 0.5;
    prop('prop.plaza.tree', x, y, [[Math.floor(x), Math.floor(y)]]);
  }

  // 유형 마을: 깃발(마당 가운데), 표지판(길 어귀), 집 3채(마당을 바라본다)
  for (const vil of villages) {
    const at = (du: number, dv: number) => ({
      x: vil.cx + vil.u.x * du + vil.v.x * dv,
      y: vil.cy + vil.u.y * du + vil.v.y * dv,
    });
    prop('prop.village.flag', vil.cx, vil.cy, [[Math.floor(vil.cx), Math.floor(vil.cy)]], 0, vil.code);
    taken.push({ x: vil.cx, y: vil.cy, r: 4.6 });
    const sign = at(-4.3, 1.8);
    prop('prop.village.sign', sign.x, sign.y, [[Math.floor(sign.x), Math.floor(sign.y)]], facing(sign.x, sign.y, C, C), vil.code);
    for (const [du, dv] of [[5.4, 0], [2.4, -3.8], [2.4, 3.8]]) {
      const h = at(du, dv);
      const rot = facing(h.x, h.y, vil.cx, vil.cy);
      prop('prop.village.house', h.x, h.y, rectTiles(h.x, h.y, 1.25, 1.15, rot), rot, vil.code);
      taken.push({ x: h.x, y: h.y, r: 2.4 });
    }
  }

  // 나무: 마을 땅에 고르게 흩어 심는다 (길·마당·집과 떨어뜨린다)
  const onPath = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (get(ground, Math.floor(x) + dx, Math.floor(y) + dy) === gid('path')) return true;
    }
    return false;
  };
  let planted = 0;
  for (let tries = 0; tries < 6000 && planted < 190; tries++) {
    const a = rand() * Math.PI * 2;
    const d = TOWN_RADII.land + 1.5 + Math.sqrt(rand()) * (shoreAt(a) - TOWN_RADII.land - 2.5);
    const x = Math.floor(C + Math.cos(a) * d) + 0.5;
    const y = Math.floor(C + Math.sin(a) * d) + 0.5;
    if (get(collision, Math.floor(x), Math.floor(y)) || onPath(x, y)) continue;
    if (taken.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + 1.2)) continue;
    prop('prop.plaza.tree', x, y, [[Math.floor(x), Math.floor(y)]]);
    taken.push({ x, y, r: 1.1 });
    planted++;
  }

  // 5. 스폰: 광장은 분수 남쪽, 마을은 마당 (막힌 칸은 고르지 않는다)
  const spawns = [
    { id: nextId++, name: 'spawn', type: 'spawn', x: (C - 3) * T, y: (C + 5) * T, width: 7 * T, height: 2 * T, rotation: 0, visible: true },
    ...villages.map((vil) => ({
      id: nextId++, name: `spawn.${vil.code}`, type: 'spawn',
      x: (vil.cx - 1.5 - vil.u.x) * T, y: (vil.cy - 1.5 - vil.u.y) * T, width: 3 * T, height: 3 * T, rotation: 0, visible: true,
    })),
  ];
  const villagePoints = villages.map((vil) => ({
    id: nextId++, name: vil.code, type: 'village', x: vil.cx * T, y: vil.cy * T, width: 0, height: 0, point: true, rotation: 0, visible: true,
  }));

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
      objectLayer(5, 'villages', villagePoints),
      tileLayer(6, 'territory', territory.map((v) => (v ? gid('grass') : 0)), 0.3),
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
