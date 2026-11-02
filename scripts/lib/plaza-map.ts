// 광장 초기 맵(Tiled JSON)을 만든다. 한 번 만든 뒤에는 Tiled에서 직접 고친다.
// 레이어: ground(타일), deco(소품 오브젝트), collision(타일, 0이 아니면 막힘), spawn(사각형 오브젝트)
// deco 오브젝트: name = manifest 키, type = "prop", (x, y) = 소품 바닥 가운데 (px), rotation = 방향 (도, 시계 방향)
// 타일셋 타일 속성: terrain(string) = 땅 종류, height(float) = 솟은 높이 (월드 단위)
// 타일셋 그림은 Tiled에서 칠할 때 보는 견본이다. 광장 화면은 terrain 속성으로 3D 땅을 만든다.

export const PLAZA_TILES = ['grass', 'grass2', 'stone', 'path', 'water', 'flowerbed', 'hedge', 'stoneEdge'] as const;
type TileName = (typeof PLAZA_TILES)[number];

const W = 32;
const H = 24;
const T = 32;
const CENTER = { x: 16, y: 12 };

const gid = (name: TileName) => PLAZA_TILES.indexOf(name) + 1;

/** 솟은 땅 높이 (월드 단위) */
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

export function buildPlazaMap(tilesetFile: string) {
  const ground: number[] = new Array(W * H).fill(gid('grass'));
  const collision: number[] = new Array(W * H).fill(0);
  const set = (layer: number[], x: number, y: number, v: number) => {
    if (x >= 0 && y >= 0 && x < W && y < H) layer[y * W + x] = v;
  };
  const block = (x: number, y: number) => set(collision, x, y, gid('hedge'));

  const rand = rng(20261102);
  for (let i = 0; i < ground.length; i++) if (rand() < 0.22) ground[i] = gid('grass2');

  // 길: 가로 3줄, 세로 3줄
  for (let x = 1; x < W - 1; x++) for (let y = CENTER.y - 1; y <= CENTER.y + 1; y++) set(ground, x, y, gid('path'));
  for (let y = 1; y < H - 1; y++) for (let x = CENTER.x - 1; x <= CENTER.x + 1; x++) set(ground, x, y, gid('path'));

  // 가운데 원형 광장
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - CENTER.x, y - CENTER.y);
      if (d <= 6.5) set(ground, x, y, gid('stone'));
      else if (d <= 7.4) set(ground, x, y, gid('stoneEdge'));
    }
  }

  // 화단 (밟지 않는다)
  for (const [x0, y0] of [[3, 3], [25, 3], [3, 18], [25, 18]]) {
    for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 4; x++) {
      set(ground, x, y, gid('flowerbed'));
      block(x, y);
    }
  }

  // 테두리 산울타리
  for (let x = 0; x < W; x++) {
    set(ground, x, 0, gid('hedge')); block(x, 0);
    set(ground, x, H - 1, gid('hedge')); block(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    set(ground, 0, y, gid('hedge')); block(0, y);
    set(ground, W - 1, y, gid('hedge')); block(W - 1, y);
  }

  // 소품. (x, y)는 소품 바닥 가운데 (타일 단위), footprint는 막히는 타일들, rot은 방향 (도)
  const objects: Record<string, unknown>[] = [];
  let nextId = 1;
  const prop = (key: string, x: number, y: number, footprint: [number, number][], rot = 0) => {
    objects.push({ id: nextId++, name: key, type: 'prop', x: x * T, y: y * T, width: 0, height: 0, point: true, rotation: rot, visible: true });
    for (const [fx, fy] of footprint) block(fx, fy);
  };
  const fountain: [number, number][] = [];
  for (let y = CENTER.y - 1; y <= CENTER.y + 1; y++) for (let x = CENTER.x - 1; x <= CENTER.x + 1; x++) fountain.push([x, y]);
  prop('prop.plaza.fountain', CENTER.x + 0.5, CENTER.y + 0.5, fountain);
  prop('prop.plaza.board', CENTER.x + 0.5, 5.5, [[15, 5], [16, 5], [17, 5]]);
  prop('prop.plaza.flag', 13.5, 5.5, [[13, 5]]);
  prop('prop.plaza.flag', 19.5, 5.5, [[19, 5]]);
  // 벤치는 광장 가운데를 바라본다
  for (const [x, y, rot] of [[11, 9, 0], [20, 9, 0], [11, 16, 180], [20, 16, 180]]) {
    prop('prop.plaza.bench', x + 1, y + 0.5, [[x, y], [x + 1, y]], rot);
  }
  for (const [x, y] of [[10, 10], [22, 10], [10, 14], [22, 14]]) {
    prop('prop.plaza.lamp', x + 0.5, y + 0.5, [[x, y]]);
  }
  for (const [x, y] of [[5, 8], [9, 3], [22, 3], [26, 8], [5, 15], [26, 15], [9, 20], [22, 20]]) {
    prop('prop.plaza.tree', x + 0.5, y + 0.5, [[x, y]]);
  }

  const spawn = { id: nextId++, name: 'spawn', type: 'spawn', x: 13 * T, y: 17 * T, width: 7 * T, height: 3 * T, rotation: 0, visible: true };

  return {
    type: 'map',
    version: '1.10',
    tiledversion: '1.10.2',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    infinite: false,
    width: W,
    height: H,
    tilewidth: T,
    tileheight: T,
    nextlayerid: 5,
    nextobjectid: nextId,
    layers: [
      { id: 1, name: 'ground', type: 'tilelayer', x: 0, y: 0, width: W, height: H, opacity: 1, visible: true, data: ground },
      { id: 2, name: 'deco', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects },
      { id: 3, name: 'collision', type: 'tilelayer', x: 0, y: 0, width: W, height: H, opacity: 0.5, visible: true, data: collision },
      { id: 4, name: 'spawn', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: [spawn] },
    ],
    tilesets: [
      {
        firstgid: 1,
        // name은 manifest 키다. 코드는 image 경로가 아니라 이 키로 타일셋 그림을 찾는다.
        name: 'tile.plaza',
        image: `../${tilesetFile}`,
        imagewidth: 4 * T,
        imageheight: Math.ceil(PLAZA_TILES.length / 4) * T,
        tilewidth: T,
        tileheight: T,
        columns: 4,
        tilecount: PLAZA_TILES.length,
        margin: 0,
        spacing: 0,
        tiles: PLAZA_TILES.map((name, id) => ({
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
