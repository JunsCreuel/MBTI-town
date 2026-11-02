// Tiled JSON 광장 맵을 읽어 충돌·소품·스폰 정보로 바꾼다. 서버와 클라이언트가 함께 쓴다.
// 좌표: 타일 한 칸 = 월드 1단위. 월드 x = 타일 열, 월드 z = 타일 행 (북쪽이 z=0).
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
}

export interface Rect {
  x: number;
  z: number;
  w: number;
  h: number;
}

export interface PlazaMap {
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
  spawn: Rect;
}

function layer<T extends TiledLayerBase['type']>(map: TiledMap, name: string, type: T) {
  const l = map.layers.find((x) => x.name === name);
  if (!l || l.type !== type) throw new Error(`맵에 ${type} 레이어 "${name}"이 없습니다`);
  return l as T extends 'tilelayer' ? TiledTileLayer : TiledObjectLayer;
}

export function parsePlazaMap(json: TiledMap): PlazaMap {
  if (json.tilewidth !== TILE_PX) throw new Error(`타일 크기가 ${TILE_PX}px가 아닙니다`);
  const ground = layer(json, 'ground', 'tilelayer').data;
  const collision = layer(json, 'collision', 'tilelayer').data;
  const deco = layer(json, 'deco', 'objectgroup').objects;
  const spawnObj = layer(json, 'spawn', 'objectgroup').objects.find((o) => o.name === 'spawn');
  if (!spawnObj) throw new Error('spawn 레이어에 spawn 사각형이 없습니다');
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
      .map((o) => ({ key: o.name, x: o.x / TILE_PX, z: o.y / TILE_PX, yaw: -((o.rotation ?? 0) * Math.PI) / 180 })),
    spawn: {
      x: spawnObj.x / TILE_PX,
      z: spawnObj.y / TILE_PX,
      w: (spawnObj.width ?? 0) / TILE_PX,
      h: (spawnObj.height ?? 0) / TILE_PX,
    },
  };
}

export function isBlockedTile(map: PlazaMap, tx: number, tz: number): boolean {
  if (tx < 0 || tz < 0 || tx >= map.width || tz >= map.height) return true;
  return map.blocked[tz * map.width + tx] === 1;
}

/** 발밑 땅 높이 (걸을 수 있는 칸은 돌바닥 정도만 살짝 솟아 있다) */
export function groundHeightAt(map: PlazaMap, x: number, z: number): number {
  const tx = Math.floor(x);
  const tz = Math.floor(z);
  if (tx < 0 || tz < 0 || tx >= map.width || tz >= map.height) return 0;
  return map.tileHeights[map.ground[tz * map.width + tx]] ?? 0;
}

/** 월드 좌표의 발 위치가 막힌 칸인지 */
export function isBlockedAt(map: PlazaMap, x: number, z: number): boolean {
  return isBlockedTile(map, Math.floor(x), Math.floor(z));
}

/** 스폰 사각형 안의 막히지 않은 칸 중앙 하나를 고른다 */
export function randomSpawnPoint(map: PlazaMap, rand: () => number = Math.random): { x: number; z: number } {
  const { x, z, w, h } = map.spawn;
  const cells: [number, number][] = [];
  for (let tz = Math.floor(z); tz < Math.ceil(z + h); tz++) {
    for (let tx = Math.floor(x); tx < Math.ceil(x + w); tx++) {
      if (!isBlockedTile(map, tx, tz)) cells.push([tx, tz]);
    }
  }
  if (!cells.length) throw new Error('스폰 영역에 걸을 수 있는 칸이 없습니다');
  const [tx, tz] = cells[Math.floor(rand() * cells.length)];
  return { x: tx + 0.35 + rand() * 0.3, z: tz + 0.35 + rand() * 0.3 };
}
