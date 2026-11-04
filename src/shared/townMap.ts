// Tiled JSON 마을 맵(가운데 중앙광장 + 둘레 다섯 지역)을 읽어 충돌·소품·스폰·집터·지역 정보로 바꾼다. 서버와 클라이언트가 함께 쓴다.
// 좌표: 타일 한 칸 = 월드 1단위. 월드 x = 타일 열, 월드 z = 타일 행 (북쪽이 z=0).
import { DISTRICTS, isDistrict, type District } from './districts';
import { themedKey } from './flora';
/** Tiled 맵의 타일 크기 (px). 타일 한 칸 = 월드 1단위. */
export const TILE_PX = 32;

interface TiledLayerBase {
  name: string;
  type: string;
}
interface TiledTileLayer extends TiledLayerBase {
  type: 'tilelayer';
  data: number[];
}
interface TiledObject {
  name: string;
  type?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  properties?: { name: string; value: unknown }[];
}
interface TiledObjectLayer extends TiledLayerBase {
  type: 'objectgroup';
  objects: TiledObject[];
}
export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  layers: (TiledTileLayer | TiledObjectLayer)[];
  tilesets: {
    firstgid: number;
    name: string;
    columns: number;
    tilecount: number;
    tiles?: { id: number; properties?: { name: string; value: unknown }[] }[];
  }[];
}

export interface PropPlacement {
  /** manifest 키 */
  key: string;
  /** 소품 바닥 가운데 (월드 좌표) */
  x: number;
  z: number;
  /** 방향 (라디안). 0이면 +Z(남쪽, 카메라 쪽)를 본다. */
  yaw: number;
  /** 지역 소품이면 그 지역 (지역 색으로 칠한다) */
  district?: District;
  /** 놓을 높이 (없으면 땅 높이). 물 위 연잎처럼 땅이 아닌 곳에 놓을 때 쓴다 */
  y?: number;
  /** 화면에서만: TINT_MATERIAL을 이 색으로 칠한다 (상가 점포 차양처럼 주인이 고른 색). 지역 색보다 먼저 */
  tint?: string;
}

/** 집터: 주민의 집이 서는 자리. 빈 집터는 울타리만 있다. 집터는 늘 막혀 있다. */
export interface Lot {
  district: District;
  index: number;
  x: number;
  z: number;
  /** 집이 바라보는 방향 (라디안) */
  yaw: number;
}

export interface Rect {
  x: number;
  z: number;
  w: number;
  h: number;
}

export interface TownMap {
  width: number;
  height: number;
  /** ground 레이어 gid (0 = 빈 칸) */
  ground: number[];
  tileset: { key: string; firstgid: number; columns: number; count: number };
  /** 타일 gid → 땅 종류 (타일셋 타일 속성 terrain) */
  terrain: Record<number, string>;
  /** 타일 gid → 솟은 높이 (타일셋 타일 속성 height) */
  tileHeights: Record<number, number>;
  /** 1 = 막힘 */
  blocked: Uint8Array;
  props: PropPlacement[];
  /** 중앙광장 스폰 */
  spawn: Rect;
  /** 이름별 스폰 ("spawn" = 중앙광장, "spawn.wood" = 숲 지역 입구) */
  spawns: Record<string, Rect>;
  /** 지역별 집터 (번호 순). 동네 틀 맵은 withDistrict로 지역을 입힌 뒤에 채워진다. */
  lots: Record<District, Lot[]>;
  /** 동네 틀 맵(map.hood)의 집터 (지역 없음, "hood.번호") */
  hoodLots: Omit<Lot, 'district'>[];
  /** 칸별 지역 (DISTRICTS 번호). 광장·길·바닷가는 -1 */
  districtGrid: Int8Array;
}

function layer<T extends TiledLayerBase['type']>(map: TiledMap, name: string, type: T) {
  const l = map.layers.find((x) => x.name === name);
  if (!l || l.type !== type) throw new Error(`맵에 ${type} 레이어 "${name}"이 없습니다`);
  return l as T extends 'tilelayer' ? TiledTileLayer : TiledObjectLayer;
}

function optionalLayer<T extends TiledLayerBase['type']>(map: TiledMap, name: string, type: T) {
  return map.layers.some((x) => x.name === name) ? layer(map, name, type) : null;
}

const toRect = (o: TiledObject): Rect => ({
  x: o.x / TILE_PX,
  z: o.y / TILE_PX,
  w: (o.width ?? 0) / TILE_PX,
  h: (o.height ?? 0) / TILE_PX,
});

export function parseTownMap(json: TiledMap): TownMap {
  if (json.tilewidth !== TILE_PX) throw new Error(`타일 크기가 ${TILE_PX}px가 아닙니다`);
  const ground = layer(json, 'ground', 'tilelayer').data;
  const collision = layer(json, 'collision', 'tilelayer').data;
  const deco = layer(json, 'deco', 'objectgroup').objects;
  const spawnObjs = layer(json, 'spawn', 'objectgroup').objects;
  const spawnObj = spawnObjs.find((o) => o.name === 'spawn');
  if (!spawnObj) throw new Error('spawn 레이어에 spawn 사각형이 없습니다');
  const lotObjs = optionalLayer(json, 'lots', 'objectgroup')?.objects ?? [];
  const districtData = optionalLayer(json, 'districts', 'tilelayer')?.data;
  const lots = emptyLots();
  const hoodLots: Omit<Lot, 'district'>[] = [];
  for (const o of lotObjs) {
    const [d, n] = o.name.split('.');
    if (!/^\d+$/.test(n)) continue;
    const l = { index: Number(n), x: o.x / TILE_PX, z: o.y / TILE_PX, yaw: -((o.rotation ?? 0) * Math.PI) / 180 };
    if (isDistrict(d)) lots[d].push({ district: d, ...l });
    else if (d === 'hood') hoodLots.push(l);
  }
  for (const d of DISTRICTS) lots[d].sort((a, b) => a.index - b.index);
  hoodLots.sort((a, b) => a.index - b.index);
  const ts = json.tilesets[0];
  const tileHeights: Record<number, number> = {};
  const terrain: Record<number, string> = {};
  for (const tile of ts.tiles ?? []) {
    const h = tile.properties?.find((p) => p.name === 'height')?.value;
    if (typeof h === 'number' && h > 0) tileHeights[ts.firstgid + tile.id] = h;
    const t = tile.properties?.find((p) => p.name === 'terrain')?.value;
    if (typeof t === 'string') terrain[ts.firstgid + tile.id] = t;
  }
  const blocked = new Uint8Array(json.width * json.height);
  collision.forEach((gid, i) => (blocked[i] = gid ? 1 : 0));
  return {
    width: json.width,
    height: json.height,
    ground,
    tileset: { key: ts.name, firstgid: ts.firstgid, columns: ts.columns, count: ts.tilecount },
    terrain,
    tileHeights,
    blocked,
    props: deco
      .filter((o) => o.type === 'prop')
      // Tiled의 rotation은 위에서 본 시계 방향 각도다
      .map((o) => {
        const district = o.properties?.find((p) => p.name === 'district')?.value;
        return {
          key: o.name,
          x: o.x / TILE_PX,
          z: o.y / TILE_PX,
          yaw: -((o.rotation ?? 0) * Math.PI) / 180,
          ...(isDistrict(district) ? { district } : {}),
        };
      }),
    spawn: toRect(spawnObj),
    spawns: Object.fromEntries(spawnObjs.map((o) => [o.name, toRect(o)])),
    lots,
    hoodLots,
    districtGrid: Int8Array.from(districtData ?? new Array(json.width * json.height).fill(0), (v) => (v >= 1 && v <= DISTRICTS.length ? v - 1 : -1)),
  };
}

const emptyLots = () => Object.fromEntries(DISTRICTS.map((d) => [d, [] as Lot[]])) as Record<District, Lot[]>;

/**
 * 동네 틀 맵(map.hood)에 지역을 입힌다: 땅 전체가 그 지역 땅이 되고, 지역 색 소품과 집터도 그 지역 것이 된다.
 * 2동·3동…은 모두 같은 틀 맵을 쓰고 지역만 다르다.
 */
export function withDistrict(map: TownMap, d: District): TownMap {
  const di = DISTRICTS.indexOf(d);
  const lots = emptyLots();
  lots[d] = map.hoodLots.map((l) => ({ ...l, district: d }));
  return {
    ...map,
    lots,
    districtGrid: map.districtGrid.map((v) => (v >= 0 ? di : -1)),
    // 지역 색 소품은 그 지역 색으로, 자리표시 식물은 그 지역 식물로
    props: map.props.map((p) => (p.district ? { ...p, district: d, key: themedKey(d, p.key, p.x, p.z) } : p)),
  };
}

/** 이 자리의 지역 (광장·길·바닷가는 null) */
export function districtAt(map: TownMap, x: number, z: number): District | null {
  const tx = Math.floor(x);
  const tz = Math.floor(z);
  if (tx < 0 || tz < 0 || tx >= map.width || tz >= map.height) return null;
  const i = map.districtGrid[tz * map.width + tx];
  return i >= 0 ? DISTRICTS[i] : null;
}

/** 집 문 앞 (집터 가운데에서 집이 바라보는 쪽으로) */
export function lotDoor(lot: Lot, distance = 1.9): { x: number; z: number } {
  return { x: lot.x + Math.sin(lot.yaw) * distance, z: lot.z + Math.cos(lot.yaw) * distance };
}

/** 지역 가운데쯤 (지역 입구 스폰 사각형 가운데) */
export function districtCenter(map: TownMap, d: District): { x: number; z: number } {
  const r = map.spawns[`spawn.${d}`] ?? map.spawn;
  return { x: r.x + r.w / 2, z: r.z + r.h / 2 };
}

export function isBlockedTile(map: TownMap, tx: number, tz: number): boolean {
  if (tx < 0 || tz < 0 || tx >= map.width || tz >= map.height) return true;
  return map.blocked[tz * map.width + tx] === 1;
}

/** 바다·호수 수면 높이 */
export const WATER_LEVEL = -0.14;
/** 땅 종류별 바닥 높이. 섞어서 부드러운 지형을 만든다 (산울타리·화단은 그 위에 따로 세운다) */
const TERRAIN_HEIGHT: Record<string, number> = { stone: 0.05, stoneEdge: 0.05, path: -0.02, sand: -0.04, water: -0.6 };
/** 땅 높이·색을 섞는 반지름 (칸). 칸 경계가 둥글게 이어진다 */
export const GROUND_BLEND_RADIUS = 1.15;

const baseHeights = new WeakMap<TownMap, Float32Array>();
function baseHeightGrid(map: TownMap): Float32Array {
  let g = baseHeights.get(map);
  if (!g) {
    g = Float32Array.from(map.ground, (gid) => TERRAIN_HEIGHT[map.terrain[gid] ?? 'grass'] ?? 0);
    baseHeights.set(map, g);
  }
  return g;
}

/** 칸 가운데에서 떨어진 거리로 섞는 무게 */
export const blendWeight = (d: number) => (d >= GROUND_BLEND_RADIUS ? 0 : (1 - d / GROUND_BLEND_RADIUS) ** 2);

/**
 * 발밑 땅 높이. 주변 칸 바닥 높이를 거리로 섞어서, 화면의 땅과 캐릭터가 같은 높이를 쓴다.
 * 모래사장은 물 쪽으로 완만하게 내려가고, 중앙광장 돌바닥은 살짝 솟아 있다.
 */
export function groundHeightAt(map: TownMap, x: number, z: number): number {
  const g = baseHeightGrid(map);
  let sum = 0;
  let wsum = 0;
  const r = GROUND_BLEND_RADIUS;
  for (let tz = Math.floor(z - r - 0.5); tz <= Math.floor(z + r - 0.5) + 1; tz++) {
    for (let tx = Math.floor(x - r - 0.5); tx <= Math.floor(x + r - 0.5) + 1; tx++) {
      const w = blendWeight(Math.hypot(tx + 0.5 - x, tz + 0.5 - z));
      if (!w) continue;
      const inside = tx >= 0 && tz >= 0 && tx < map.width && tz < map.height;
      sum += w * (inside ? g[tz * map.width + tx] : TERRAIN_HEIGHT.water);
      wsum += w;
    }
  }
  return wsum ? sum / wsum : 0;
}

/** 물가인지: 반지름 r칸 안에 연못(물 타일)이나 바다(빈 칸·맵 밖)가 있으면 낚시할 수 있다 */
export function nearWater(map: TownMap, x: number, z: number, r = 1.7): boolean {
  for (let tz = Math.floor(z - r); tz <= Math.floor(z + r); tz++) {
    for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
      if (Math.hypot(tx + 0.5 - x, tz + 0.5 - z) > r) continue;
      if (tx < 0 || tz < 0 || tx >= map.width || tz >= map.height) return true;
      const g = map.ground[tz * map.width + tx];
      if (!g || map.terrain[g] === 'water') return true;
    }
  }
  return false;
}

const isWaterTile = (map: TownMap, tx: number, tz: number) => {
  if (tx < 0 || tz < 0 || tx >= map.width || tz >= map.height) return true;
  const g = map.ground[tz * map.width + tx];
  return !g || map.terrain[g] === 'water';
};

/**
 * 낚시 찌를 던질 물 위 자리: 둘레 물 칸 중 약 2.8칸 떨어진 곳 (너무 가깝거나 먼 곳은 피한다).
 * yaw(바라보는 방향)를 주면 그쪽에 가까운 물을 먼저 고른다 (다른 사람이 던진 찌 자리를 짐작할 때).
 */
export function castTarget(map: TownMap, x: number, z: number, yaw?: number): { x: number; z: number } | null {
  const R = 4.5;
  let best: { x: number; z: number } | null = null;
  let bestScore = Infinity;
  for (let tz = Math.floor(z - R); tz <= Math.floor(z + R); tz++) {
    for (let tx = Math.floor(x - R); tx <= Math.floor(x + R); tx++) {
      const cx = tx + 0.5;
      const cz = tz + 0.5;
      const d = Math.hypot(cx - x, cz - z);
      if (d < 1.4 || d > R || !isWaterTile(map, tx, tz)) continue;
      let score = Math.abs(d - 2.8);
      // 물가 가장자리 칸보다 물 안쪽 칸 (둘레도 물)
      if (!isWaterTile(map, tx + 1, tz) || !isWaterTile(map, tx - 1, tz) || !isWaterTile(map, tx, tz + 1) || !isWaterTile(map, tx, tz - 1)) score += 0.6;
      if (yaw !== undefined) {
        const diff = Math.abs(Math.atan2(Math.sin(Math.atan2(cx - x, cz - z) - yaw), Math.cos(Math.atan2(cx - x, cz - z) - yaw)));
        score += diff * 1.5;
      }
      if (score < bestScore) {
        bestScore = score;
        best = { x: cx, z: cz };
      }
    }
  }
  return best;
}

/** 월드 좌표의 발 위치가 막힌 칸인지 */
export function isBlockedAt(map: TownMap, x: number, z: number): boolean {
  return isBlockedTile(map, Math.floor(x), Math.floor(z));
}

/** 스폰 이름: 중앙광장(동네는 입구)은 "spawn", 지역은 "spawn.wood", 동네 길 앞은 "gate.wood" */
export const spawnName = (place: District | 'plaza') => (place === 'plaza' ? 'spawn' : `spawn.${place}`);
export const gateSpawnName = (d: District) => `gate.${d}`;

/**
 * 스폰 사각형 안의 막히지 않은 칸 하나를 골라 그 칸 가운데 근처에 세운다 (사각형 밖으로는 나가지 않는다).
 * 그 이름의 스폰이 없으면 광장.
 */
export function randomSpawnPoint(
  map: TownMap,
  rand: () => number = Math.random,
  name = 'spawn',
): { x: number; z: number } {
  const { x, z, w, h } = map.spawns[name] ?? map.spawn;
  const cells: [number, number][] = [];
  // 칸 가운데가 사각형 안에 있는 칸만 고른다
  for (let tz = Math.ceil(z - 0.5); tz + 0.5 <= z + h; tz++) {
    for (let tx = Math.ceil(x - 0.5); tx + 0.5 <= x + w; tx++) {
      if (!isBlockedTile(map, tx, tz)) cells.push([tx, tz]);
    }
  }
  if (!cells.length) throw new Error('스폰 영역에 걸을 수 있는 칸이 없습니다');
  const [tx, tz] = cells[Math.floor(rand() * cells.length)];
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  // 가장자리에서 조금 안쪽까지만 (실시간 서버는 위치를 32비트 실수로 보내므로 경계값은 밖으로 반올림될 수 있다)
  const EDGE = 0.02;
  return {
    x: clamp(tx + 0.35 + rand() * 0.3, Math.max(x + EDGE, tx + 0.05), Math.min(x + w - EDGE, tx + 0.95)),
    z: clamp(tz + 0.35 + rand() * 0.3, Math.max(z + EDGE, tz + 0.05), Math.min(z + h - EDGE, tz + 0.95)),
  };
}
