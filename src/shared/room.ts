// 나의 방(미니룸) 규칙: 소품 목록, 배치 검사, 기본 방 세트, 방 안 길찾기 (PROJECT_GUIDE.md 6장).
// 화면과 서버가 함께 쓴다. 서버는 저장할 때 validateLayout으로 다시 검사한다.
//
// 좌표: 바닥 한 칸 = 1. x는 오른쪽, z는 앞쪽(카메라 쪽). 뒤 벽은 z = 0, 왼쪽 벽은 x = 0.
// 바닥 소품의 (x, z)는 차지하는 칸 중 가장 왼쪽 위 칸이다. rot는 90도 단위 (0이면 정면이 +z).
// 벽 소품은 wall('back' | 'left')과 벽을 따라 몇 번째 칸인지(x)만 쓴다.
import { roomConfig } from '../config/game';

export type FurnitureKind = 'floor' | 'rug' | 'wall';
/** 누르면 하는 일 */
export type FurnitureAction = 'bgm' | 'archive' | 'frame' | 'guestbook' | 'wardrobe' | 'window';

export interface FurnitureDef {
  /** manifest 키 */
  key: string;
  name: string;
  kind: FurnitureKind;
  /** 바닥: [가로, 세로] 칸. 벽: [벽을 따라 차지하는 칸, 1] */
  size: [number, number];
  action?: FurnitureAction;
  /** 방에 하나만 둘 수 있다 (기능 소품) */
  unique?: boolean;
  /** 벽 소품 가운데 높이 */
  mountY?: number;
}

export const FURNITURE: readonly FurnitureDef[] = [
  { key: 'furn.turntable', name: '턴테이블', kind: 'floor', size: [1, 1], action: 'bgm', unique: true },
  { key: 'furn.desk', name: '책상', kind: 'floor', size: [2, 1], action: 'archive', unique: true },
  { key: 'furn.mailbox', name: '우편함', kind: 'floor', size: [1, 1], action: 'guestbook', unique: true },
  { key: 'furn.wardrobe', name: '옷장', kind: 'floor', size: [1, 1], action: 'wardrobe', unique: true },
  { key: 'furn.bookshelf', name: '책장', kind: 'floor', size: [1, 1] },
  { key: 'furn.sofa', name: '소파', kind: 'floor', size: [2, 1] },
  { key: 'furn.bed', name: '침대', kind: 'floor', size: [1, 2] },
  { key: 'furn.chair', name: '의자', kind: 'floor', size: [1, 1] },
  { key: 'furn.table', name: '탁자', kind: 'floor', size: [1, 1] },
  { key: 'furn.plant', name: '화분', kind: 'floor', size: [1, 1] },
  { key: 'furn.lamp', name: '스탠드 조명', kind: 'floor', size: [1, 1] },
  { key: 'furn.rug', name: '러그', kind: 'rug', size: [2, 2] },
  { key: 'furn.window', name: '창문', kind: 'wall', size: [2, 1], action: 'window', mountY: 1.65 },
  { key: 'furn.frame', name: '사진 액자', kind: 'wall', size: [1, 1], action: 'frame', mountY: 1.55 },
  { key: 'furn.clock', name: '시계', kind: 'wall', size: [1, 1], mountY: 2.2 },
  { key: 'furn.shelf', name: '벽 선반', kind: 'wall', size: [1, 1], mountY: 1.4 },
];

export const furnitureDef = (key: string) => FURNITURE.find((f) => f.key === key);

export type Wall = 'back' | 'left';
export type Rot = 0 | 1 | 2 | 3;

export interface PlacedItem {
  /** 방 안에서 소품 하나를 가리키는 id */
  id: string;
  key: string;
  x: number;
  z: number;
  rot: Rot;
  wall?: Wall;
  /** 사진 액자에 건 사진 */
  photoId?: string;
}

// ───────────────────────── 벽지와 바닥 ─────────────────────────

export const WALLPAPERS = [
  { id: 'mint', label: '민트' },
  { id: 'sky', label: '하늘' },
  { id: 'cream', label: '크림' },
  { id: 'peach', label: '복숭아' },
  { id: 'lilac', label: '라일락' },
  { id: 'mint-stripe', label: '민트 줄무늬' },
  { id: 'sky-dot', label: '하늘 물방울' },
  { id: 'night', label: '밤하늘' },
] as const;
export type WallpaperId = (typeof WALLPAPERS)[number]['id'];

export const FLOORS = [
  { id: 'oak', label: '밝은 원목' },
  { id: 'walnut', label: '짙은 원목' },
  { id: 'tile', label: '하얀 타일' },
  { id: 'mint-tile', label: '민트 타일' },
  { id: 'carpet', label: '하늘 카펫' },
] as const;
export type FloorId = (typeof FLOORS)[number]['id'];

export interface RoomLayout {
  wallpaper: WallpaperId;
  floor: FloorId;
  items: PlacedItem[];
}

// ───────────────────────── 칸 계산 ─────────────────────────

/** 돌린 뒤의 [가로, 세로] */
export function footprintSize(def: FurnitureDef, rot: Rot): [number, number] {
  const [w, d] = def.size;
  return rot % 2 === 0 ? [w, d] : [d, w];
}

/** 바닥 소품이 차지하는 칸 */
export function footprint(item: PlacedItem, def = furnitureDef(item.key)): [number, number][] {
  if (!def || def.kind === 'wall') return [];
  const [w, d] = footprintSize(def, item.rot);
  const cells: [number, number][] = [];
  for (let z = item.z; z < item.z + d; z++) for (let x = item.x; x < item.x + w; x++) cells.push([x, z]);
  return cells;
}

/** 소품 가운데 (월드 좌표) */
export function itemCenter(item: PlacedItem, def = furnitureDef(item.key)): { x: number; y: number; z: number } {
  if (!def) return { x: 0, y: 0, z: 0 };
  if (def.kind === 'wall') {
    const along = item.x + def.size[0] / 2;
    return item.wall === 'left' ? { x: 0, y: def.mountY ?? 1.5, z: along } : { x: along, y: def.mountY ?? 1.5, z: 0 };
  }
  const [w, d] = footprintSize(def, item.rot);
  return { x: item.x + w / 2, y: 0, z: item.z + d / 2 };
}

const wallLength = (wall: Wall) => (wall === 'back' ? roomConfig.width : roomConfig.depth);

/** 바닥 칸 막힘 표 (러그는 막지 않는다). 걷기와 빈 자리 찾기에 쓴다. */
export function blockedCells(items: readonly PlacedItem[], except?: string): Uint8Array {
  const grid = new Uint8Array(roomConfig.width * roomConfig.depth);
  for (const it of items) {
    if (it.id === except) continue;
    const def = furnitureDef(it.key);
    if (!def || def.kind !== 'floor') continue;
    for (const [x, z] of footprint(it, def)) {
      if (x >= 0 && z >= 0 && x < roomConfig.width && z < roomConfig.depth) grid[z * roomConfig.width + x] = 1;
    }
  }
  return grid;
}

/** 소품 하나를 이 자리에 둘 수 있는지 (다른 소품과 겹침, 방 범위) */
export function canPlace(items: readonly PlacedItem[], item: PlacedItem): boolean {
  const def = furnitureDef(item.key);
  if (!def) return false;
  if (def.kind === 'wall') {
    if (item.wall !== 'back' && item.wall !== 'left') return false;
    const len = wallLength(item.wall);
    if (!Number.isInteger(item.x) || item.x < 0 || item.x + def.size[0] > len) return false;
    return !items.some((o) => {
      if (o.id === item.id || o.wall !== item.wall) return false;
      const od = furnitureDef(o.key);
      if (!od || od.kind !== 'wall') return false;
      return item.x < o.x + od.size[0] && o.x < item.x + def.size[0];
    });
  }
  if (![0, 1, 2, 3].includes(item.rot) || !Number.isInteger(item.x) || !Number.isInteger(item.z)) return false;
  const [w, d] = footprintSize(def, item.rot);
  if (item.x < 0 || item.z < 0 || item.x + w > roomConfig.width || item.z + d > roomConfig.depth) return false;
  const mine = new Set(footprint(item, def).map(([x, z]) => `${x},${z}`));
  return !items.some((o) => {
    if (o.id === item.id) return false;
    const od = furnitureDef(o.key);
    // 러그끼리는 겹치지 않고, 러그와 다른 바닥 소품은 겹쳐도 된다
    if (!od || od.kind === 'wall' || (od.kind === 'rug') !== (def.kind === 'rug')) return false;
    return footprint(o, od).some(([x, z]) => mine.has(`${x},${z}`));
  });
}

/** 새 소품을 둘 빈 자리 (방 가운데에서 가까운 순). 없으면 null. */
export function findFreeSpot(items: readonly PlacedItem[], key: string, id: string): PlacedItem | null {
  const def = furnitureDef(key);
  if (!def) return null;
  if (def.kind === 'wall') {
    for (const wall of ['back', 'left'] as const) {
      for (let x = 0; x + def.size[0] <= wallLength(wall); x++) {
        const it: PlacedItem = { id, key, x, z: 0, rot: 0, wall };
        if (canPlace(items, it)) return it;
      }
    }
    return null;
  }
  const cx = roomConfig.width / 2;
  const cz = roomConfig.depth / 2;
  const spots: PlacedItem[] = [];
  for (const rot of [0, 1] as Rot[]) {
    for (let z = 0; z < roomConfig.depth; z++) for (let x = 0; x < roomConfig.width; x++) spots.push({ id, key, x, z, rot });
  }
  spots.sort((a, b) => {
    const ca = itemCenter(a, def);
    const cb = itemCenter(b, def);
    return Math.hypot(ca.x - cx, ca.z - cz) - Math.hypot(cb.x - cx, cb.z - cz) || a.rot - b.rot;
  });
  return spots.find((s) => canPlace(items, s)) ?? null;
}

// ───────────────────────── 저장 검사 ─────────────────────────

const ID = /^[A-Za-z0-9_-]{1,24}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 받은 값에서 소품 하나에 필요한 칸만 남긴다 (자리 검사는 따로) */
function shapeItem(r: Partial<PlacedItem>, def: FurnitureDef): PlacedItem {
  return {
    id: String(r.id),
    key: def.key,
    x: Number(r.x),
    z: def.kind === 'wall' ? 0 : Number(r.z),
    rot: def.kind === 'wall' ? 0 : (Number(r.rot) as Rot),
    ...(def.kind === 'wall' ? { wall: r.wall as Wall } : {}),
    ...(def.action === 'frame' && typeof r.photoId === 'string' && UUID.test(r.photoId) ? { photoId: r.photoId } : {}),
  };
}

/**
 * 소품 하나를 검사한다 (실시간 방 꾸미기 알림). 있는 소품이고 방 안의 올바른 자리면 필요한 칸만 남겨 돌려준다.
 * 다른 소품과 겹치는지는 보지 않는다 (저장할 때 validateLayout이 본다)
 */
export function cleanPlacedItem(v: unknown): PlacedItem | null {
  const r = v as Partial<PlacedItem> | null;
  if (!r || typeof r !== 'object' || typeof r.key !== 'string' || typeof r.id !== 'string' || !ID.test(r.id)) return null;
  const def = furnitureDef(r.key);
  if (!def) return null;
  const item = shapeItem(r, def);
  return canPlace([], item) ? item : null;
}

export type LayoutResult = { ok: true; layout: RoomLayout } | { ok: false; error: string };

/** 저장 전에 방 배치를 검사하고 필요한 값만 남긴다 */
export function validateLayout(v: unknown): LayoutResult {
  const raw = v as Partial<RoomLayout> | null;
  if (!raw || typeof raw !== 'object') return { ok: false, error: '방 정보가 없어요.' };
  if (!WALLPAPERS.some((w) => w.id === raw.wallpaper)) return { ok: false, error: '없는 벽지예요.' };
  if (!FLOORS.some((f) => f.id === raw.floor)) return { ok: false, error: '없는 바닥이에요.' };
  if (!Array.isArray(raw.items)) return { ok: false, error: '소품 목록이 없어요.' };
  if (raw.items.length > roomConfig.maxItems) return { ok: false, error: `소품은 ${roomConfig.maxItems}개까지 둘 수 있어요.` };
  const items: PlacedItem[] = [];
  const ids = new Set<string>();
  for (const r of raw.items as Partial<PlacedItem>[]) {
    const def = typeof r?.key === 'string' ? furnitureDef(r.key) : undefined;
    if (!def) return { ok: false, error: '없는 소품이 있어요.' };
    if (typeof r.id !== 'string' || !ID.test(r.id) || ids.has(r.id)) return { ok: false, error: '소품 id가 올바르지 않아요.' };
    ids.add(r.id);
    const item = shapeItem(r, def);
    if (!canPlace(items, item)) return { ok: false, error: `${def.name}을(를) 그 자리에 둘 수 없어요.` };
    if (def.unique && items.some((o) => o.key === def.key)) return { ok: false, error: `${def.name}은(는) 하나만 둘 수 있어요.` };
    items.push(item);
  }
  return { ok: true, layout: { wallpaper: raw.wallpaper as WallpaperId, floor: raw.floor as FloorId, items } };
}

/** 액자에 건 사진들 (방을 볼 수 있는 사람에게 보인다) */
export function framedPhotoIds(layout: RoomLayout): string[] {
  return layout.items.filter((i) => i.photoId).map((i) => i.photoId!);
}

// ───────────────────────── 기본 방 세트 (첫 집 꾸미기) ─────────────────────────

const f = (id: string, key: string, x: number, z: number, rot: Rot = 0): PlacedItem => ({ id, key: `furn.${key}`, x, z, rot });
const w = (id: string, key: string, wall: Wall, x: number): PlacedItem => ({ id, key: `furn.${key}`, x, z: 0, rot: 0, wall });

export const STARTER_ROOMS = [
  {
    id: 'cozy',
    name: '아늑한 방',
    description: '침대와 러그, 창가의 화분',
    layout: {
      wallpaper: 'cream',
      floor: 'oak',
      items: [
        f('bed', 'bed', 0, 0), f('plant', 'plant', 1, 0), f('desk', 'desk', 3, 0), f('tt', 'turntable', 5, 0),
        f('ward', 'wardrobe', 0, 3, 1), f('lamp', 'lamp', 0, 5), f('mail', 'mailbox', 5, 4), f('rug', 'rug', 2, 2),
        w('win', 'window', 'back', 1), w('frame', 'frame', 'left', 2), w('clock', 'clock', 'back', 4),
      ],
    },
  },
  {
    id: 'music',
    name: '음악 방',
    description: '소파에 기대 듣는 턴테이블',
    layout: {
      wallpaper: 'mint-stripe',
      floor: 'walnut',
      items: [
        f('desk', 'desk', 0, 0), f('tt', 'turntable', 3, 0), f('books', 'bookshelf', 4, 0), f('lamp', 'lamp', 5, 0),
        f('sofa', 'sofa', 0, 2, 1), f('rug', 'rug', 1, 2), f('table', 'table', 1, 3), f('ward', 'wardrobe', 0, 5, 1),
        f('mail', 'mailbox', 5, 4),
        w('win', 'window', 'back', 2), w('frame', 'frame', 'left', 3), w('shelf', 'shelf', 'left', 1),
      ],
    },
  },
  {
    id: 'study',
    name: '책 읽는 방',
    description: '책장과 책상, 조용한 창가',
    layout: {
      wallpaper: 'sky',
      floor: 'tile',
      items: [
        f('books1', 'bookshelf', 0, 0, 1), f('books2', 'bookshelf', 0, 1, 1), f('lamp', 'lamp', 0, 2),
        f('desk', 'desk', 2, 0), f('chair', 'chair', 2, 1, 2), f('plant', 'plant', 4, 0), f('tt', 'turntable', 5, 0),
        f('rug', 'rug', 2, 3), f('ward', 'wardrobe', 0, 4, 1), f('mail', 'mailbox', 5, 4),
        w('win', 'window', 'back', 4), w('frame', 'frame', 'left', 3), w('clock', 'clock', 'back', 1),
      ],
    },
  },
] as const satisfies readonly { id: string; name: string; description: string; layout: RoomLayout }[];

export type StarterRoomId = (typeof STARTER_ROOMS)[number]['id'];

export function starterLayout(id: string, wallpaper?: string, floor?: string): RoomLayout {
  const base = STARTER_ROOMS.find((s) => s.id === id) ?? STARTER_ROOMS[0];
  return {
    wallpaper: WALLPAPERS.some((x) => x.id === wallpaper) ? (wallpaper as WallpaperId) : base.layout.wallpaper,
    floor: FLOORS.some((x) => x.id === floor) ? (floor as FloorId) : base.layout.floor,
    items: base.layout.items.map((i) => ({ ...i })),
  };
}

// ───────────────────────── 방 안 길찾기 ─────────────────────────

export interface Point {
  x: number;
  z: number;
}

/** 캐릭터 몸 반지름 (칸). 벽과 가구에서 이만큼 떨어져 선다 */
export const ROOM_BODY_RADIUS = 0.22;

/** 이 자리에 설 수 있는지: 방 안이고, 몸 둘레가 막힌 칸에 걸치지 않는다 */
export function canStandInRoom(blocked: Uint8Array, x: number, z: number, r = ROOM_BODY_RADIUS): boolean {
  const W = roomConfig.width;
  const D = roomConfig.depth;
  if (x < r || z < r || x > W - r || z > D - r) return false;
  for (const [ox, oz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
    const cx = Math.floor(x + ox);
    const cz = Math.floor(z + oz);
    if (blocked[cz * W + cx]) return false;
  }
  return true;
}

/** 방향키 이동: 막히면 x, z를 따로 시도해 벽·가구를 따라 미끄러진다 */
export function moveInRoom(blocked: Uint8Array, x: number, z: number, dx: number, dz: number): Point {
  if (canStandInRoom(blocked, x + dx, z + dz)) return { x: x + dx, z: z + dz };
  if (dx && canStandInRoom(blocked, x + dx, z)) return { x: x + dx, z };
  if (dz && canStandInRoom(blocked, x, z + dz)) return { x, z: z + dz };
  return { x, z };
}

/** 칸 가운데를 잇는 8방향 길 (start 제외, goal 포함). 막힌 칸을 누르면 가장 가까운 빈 칸으로 간다. */
export function findRoomPath(blocked: Uint8Array, start: Point, goal: Point): Point[] | null {
  const W = roomConfig.width;
  const D = roomConfig.depth;
  const inside = (x: number, z: number) => x >= 0 && z >= 0 && x < W && z < D;
  const free = (x: number, z: number) => inside(x, z) && !blocked[z * W + x];
  const sx = Math.min(W - 1, Math.max(0, Math.floor(start.x)));
  const sz = Math.min(D - 1, Math.max(0, Math.floor(start.z)));
  let gx = Math.floor(goal.x);
  let gz = Math.floor(goal.z);
  if (!free(gx, gz)) {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - gx, z - gz);
      if (free(x, z) && d < bestD) {
        bestD = d;
        best = [x, z];
      }
    }
    if (!best) return null;
    [gx, gz] = best;
  }
  const key = (x: number, z: number) => z * W + x;
  const prev = new Map<number, number>();
  const dist = new Map<number, number>([[key(sx, sz), 0]]);
  const open = [key(sx, sz)];
  while (open.length) {
    open.sort((a, b) => dist.get(a)! - dist.get(b)!);
    const cur = open.shift()!;
    const cx = cur % W;
    const cz = Math.floor(cur / W);
    if (cx === gx && cz === gz) break;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (!free(nx, nz)) continue;
      // 대각선은 양옆이 모두 비어 있어야 간다 (모서리를 파고들지 않게)
      if (dx && dz && (!free(cx + dx, cz) || !free(cx, cz + dz))) continue;
      const nd = dist.get(cur)! + (dx && dz ? Math.SQRT2 : 1);
      const nk = key(nx, nz);
      if (nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd);
        prev.set(nk, cur);
        if (!open.includes(nk)) open.push(nk);
      }
    }
  }
  const goalKey = key(gx, gz);
  if (!dist.has(goalKey)) return null;
  const path: Point[] = [];
  for (let k = goalKey; k !== key(sx, sz); k = prev.get(k)!) path.unshift({ x: (k % W) + 0.5, z: Math.floor(k / W) + 0.5 });
  if (!path.length) return [{ x: gx + 0.5, z: gz + 0.5 }];
  return path;
}
