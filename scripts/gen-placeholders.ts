// 아트가 나오기 전에 쓸 임시(_ph) 에셋을 실제 규격대로 만든다 (PROJECT_GUIDE.md 20장).
// - _ph 파일은 매번 다시 만든다.
// - manifest.json에는 없는 키만 추가한다. 이미 있는 키(실제 에셋으로 바꾼 키)는 건드리지 않는다.
// - 파일이 없어진 _ph 키는 manifest에서 지운다 (더 쓰지 않는 임시 에셋 정리).
// - LICENSES.md는 없는 파일의 줄을 지우고, 새 파일의 줄을 더한다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tokens } from '../src/design/tokens';
import { BGM_TRACKS } from '../src/shared/bgm';
import { THEMES, type Theme } from '../src/shared/districts';
import { EMOTIONS } from '../src/shared/records';
import { FURNITURE } from '../src/shared/room';
import { encodeTrack, TRACKS } from './lib/bgm';
import { Bitmap, hex, type RGBA } from './lib/bitmap';
import { FURNITURE_MATERIALS, FURNITURE_PARTS } from './lib/furniture';
import { buildSkinned, buildStatic, chibiCharacterSpec, groupPropParts, type Part } from './lib/models';
import { fishIcons, fruitIcons } from './lib/item-icons';
import { bartenderBearSpec, djRaccoonSpec, guideCatSpec } from './lib/npc';
import { rodParts, beaconParts, clubBarParts, clubDoorParts, clubSofaParts, clubWallParts, djBoothParts, fortuneTreeParts, fruitTreeParts, marketStallParts, plazaScreenParts, speakerParts } from './lib/play-props';
import { FRUITS, fruitTreeKey } from '../src/shared/play';
import { TOWN_TILES, buildHoodMap, buildSpotMap, buildTownMap } from './lib/town-map';
import {
  PROP_MATERIALS, benchParts, boardParts, flagParts, fountainParts, gateParts, greenhouseParts, houseParts, lampParts, lotParts,
  pierParts, shopParts, stageParts, treeParts, workshopParts,
} from './lib/town-props';
import { TILE_PX } from '../src/shared/townMap';

const ROOT = join(import.meta.dirname, '..', 'public', 'assets');
const TODAY = new Date().toISOString().slice(0, 10);
const SKIP_AUDIO = process.argv.includes('--no-audio');
const FORCE_MAP = process.argv.includes('--map');
const SELF = '자체 제작 임시 에셋 (scripts/gen-placeholders.ts)';
const SELF_LICENSE = '프로젝트 소유';

const manifest: Record<string, Record<string, unknown>> = existsSync(join(ROOT, 'manifest.json'))
  ? JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'))
  : {};
const made: { file: string; source: string }[] = [];
const added: string[] = [];

function save(file: string, data: Uint8Array | string): void {
  const path = join(ROOT, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

function register(key: string, entry: Record<string, unknown>): void {
  if (!(key in manifest)) {
    manifest[key] = entry;
    added.push(key);
  }
}

function record(file: string, source = SELF): void {
  if (!made.some((m) => m.file === file)) made.push({ file, source });
}

// ───────────────────────── 아바타 ─────────────────────────

async function genAvatar() {
  const file = 'characters/char_base_ph.glb';
  save(file, await buildSkinned('char_base', chibiCharacterSpec()));
  register('char.base', { file });
  record(file);
  // 광장 안내 NPC 몬냥이 (베이스 캐릭터와 같은 뼈대·동작)
  const npc = 'characters/char_npc_monnyang_ph.glb';
  save(npc, await buildSkinned('char_npc_monnyang', guideCatSpec()));
  register('char.npc.monnyang', { file: npc });
  record(npc);
  // 클럽 NPC: DJ 너구리, 바텐더 곰 (클럽 맵에서만 받는다)
  for (const [key, name, spec] of [
    ['char.npc.dj', 'char_npc_dj', djRaccoonSpec()],
    ['char.npc.bartender', 'char_npc_bartender', bartenderBearSpec()],
  ] as const) {
    const f = `characters/${name}_ph.glb`;
    save(f, await buildSkinned(name, spec));
    register(key, { file: f });
    record(f);
  }
  const acc = { glasses: 'NT', flower: 'NF', cap: 'SJ', headphones: 'SP' } as const;
  for (const [name, group] of Object.entries(acc)) {
    const f = `characters/char_acc_${name}_ph.glb`;
    save(f, await buildStatic(`acc_${name}`, groupPropParts(group), { base: { roughness: 0.6 }, outfit: { roughness: 0.7 } }));
    register(`char.acc.${name}`, { file: f });
    record(f);
  }
}

// ───────────────────────── 안내 캐릭터 (SVG) ─────────────────────────
// 최종 디자인은 [결정 필요]. 몬냥이: 입이 없는 미니멀한 고양이 같은 친구. 구름이: 안내하는 구름.

const GUIDES: Record<string, string> = {
  monnyang: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <ellipse cx="60" cy="108" rx="30" ry="5" fill="#000" opacity=".08"/>
  <path d="M26 44 L30 14 L50 32 Z" fill="#FFF6EA" stroke="#3D4250" stroke-width="3" stroke-linejoin="round"/>
  <path d="M94 44 L90 14 L70 32 Z" fill="#FFF6EA" stroke="#3D4250" stroke-width="3" stroke-linejoin="round"/>
  <path d="M31 22 L34 33 L42 30 Z" fill="#FFC9B3"/><path d="M89 22 L86 33 L78 30 Z" fill="#FFC9B3"/>
  <ellipse cx="60" cy="62" rx="40" ry="34" fill="#FFF6EA" stroke="#3D4250" stroke-width="3"/>
  <ellipse cx="60" cy="98" rx="24" ry="10" fill="#FFF6EA" stroke="#3D4250" stroke-width="3"/>
  <circle cx="45" cy="60" r="4.5" fill="#3D4250"/><circle cx="75" cy="60" r="4.5" fill="#3D4250"/>
  <ellipse cx="36" cy="72" rx="6" ry="3.5" fill="#FFB3B3" opacity=".8"/><ellipse cx="84" cy="72" rx="6" ry="3.5" fill="#FFB3B3" opacity=".8"/>
</svg>`,
  gureum: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <ellipse cx="60" cy="100" rx="34" ry="5" fill="#000" opacity=".07"/>
  <path d="M30 86 C14 86 10 66 24 60 C20 42 40 34 50 42 C54 26 78 24 84 40 C98 36 110 50 102 62 C114 70 106 88 92 86 Z"
    fill="#FFFFFF" stroke="#78B8E6" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="50" cy="64" r="4" fill="#3D4250"/><circle cx="72" cy="64" r="4" fill="#3D4250"/>
  <ellipse cx="42" cy="72" rx="5" ry="3" fill="#FFB3B3" opacity=".8"/><ellipse cx="80" cy="72" rx="5" ry="3" fill="#FFB3B3" opacity=".8"/>
  <path d="M57 72 Q61 75 65 72" fill="none" stroke="#3D4250" stroke-width="2" stroke-linecap="round"/>
</svg>`,
};

function genGuides() {
  for (const [name, svg] of Object.entries(GUIDES)) {
    const file = `characters/char_guide_${name}_ph.svg`;
    save(file, svg + '\n');
    register(`char.guide.${name}`, { file });
    record(file);
  }
}

// ───────────────────────── 방 소품 (GLB) ─────────────────────────

async function genFurniture() {
  for (const def of FURNITURE) {
    const name = def.key.split('.')[1];
    const file = `furniture/furn_${name}_ph.glb`;
    save(file, await buildStatic(`furn_${name}`, FURNITURE_PARTS[def.key](), FURNITURE_MATERIALS));
    register(def.key, { file });
    record(file);
  }
}

// ───────────────────────── 마을 소품 (GLB) ─────────────────────────

async function genTownProps() {
  const props: [string, string, Part[]][] = [
    ['prop.plaza.fountain', 'prop_plaza_fountain', fountainParts()],
    ['prop.plaza.bench', 'prop_plaza_bench', benchParts()],
    ['prop.plaza.board', 'prop_plaza_board', boardParts()],
    ['prop.plaza.flag', 'prop_plaza_flag', flagParts(tokens.color.accent)],
    ['prop.plaza.tree', 'prop_plaza_tree', treeParts()],
    ['prop.plaza.lamp', 'prop_plaza_lamp', lampParts()],
    ['prop.town.house', 'prop_town_house', houseParts()],
    ['prop.town.lot', 'prop_town_lot', lotParts()],
    ['prop.district.greenhouse', 'prop_district_greenhouse', greenhouseParts()],
    ['prop.district.stage', 'prop_district_stage', stageParts()],
    ['prop.district.shop', 'prop_district_shop', shopParts()],
    ['prop.district.workshop', 'prop_district_workshop', workshopParts()],
    ['prop.district.pier', 'prop_district_pier', pierParts()],
    ['prop.hood.gate', 'prop_hood_gate', gateParts()],
    // 놀거리: 기질 그룹마다 열매 나무, 광장 운세 나무, 낚시터·클럽 비콘, 클럽 소품
    ...THEMES.map((t): [string, string, Part[]] => [fruitTreeKey(t), `prop_fruit_${t.toLowerCase()}`, fruitTreeParts(FRUITS[t].color)]),
    ['prop.plaza.fortune_tree', 'prop_plaza_fortune_tree', fortuneTreeParts()],
    ['prop.plaza.beacon_fishing', 'prop_plaza_beacon_fishing', beaconParts('#5BB6E8', 'fish')],
    ['prop.plaza.beacon_club', 'prop_plaza_beacon_club', beaconParts('#C77DFF', 'club')],
    ['prop.plaza.beacon_market', 'prop_plaza_beacon_market', beaconParts('#F2A23A', 'shop')],
    ['prop.market.stall', 'prop_market_stall', marketStallParts()],
    ['prop.plaza.screen', 'prop_plaza_screen', plazaScreenParts()],
    ['prop.club.booth', 'prop_club_booth', djBoothParts()],
    ['prop.club.speaker', 'prop_club_speaker', speakerParts()],
    // 실내 클럽: 벽·출입문·바·소파
    ['prop.club.wall', 'prop_club_wall', clubWallParts()],
    ['prop.club.door', 'prop_club_door', clubDoorParts()],
    ['prop.club.bar', 'prop_club_bar', clubBarParts()],
    ['prop.club.sofa', 'prop_club_sofa', clubSofaParts()],
    // 낚싯대 (낚시할 때 손에 든다)
    ['prop.tool.rod', 'prop_tool_rod', rodParts()],
  ];
  for (const [key, name, parts] of props) {
    const file = `props/${name}_ph.glb`;
    save(file, await buildStatic(name, parts, PROP_MATERIALS));
    register(key, { file });
    record(file);
  }
}

// ───────────────────────── 마을 맵 (Tiled) ─────────────────────────
// Tiled에서 땅을 칠할 때 보는 견본 그림. 마을 화면은 타일 속성 terrain으로 3D 땅을 따로 만든다.
const SWATCH: Record<(typeof TOWN_TILES)[number], string> = {
  grass: '#9ED67F',
  grass2: '#90CC70',
  stone: '#EFE3D2',
  path: '#E8D2AE',
  water: '#8ED2F2',
  flowerbed: '#C98FA0',
  hedge: '#5FAE5A',
  stoneEdge: '#D9C8B0',
  sand: '#F3E2B3',
};

function genTownMap() {
  const cols = 4;
  const b = new Bitmap(cols * TILE_PX, Math.ceil(TOWN_TILES.length / cols) * TILE_PX);
  TOWN_TILES.forEach((name, i) => {
    const ox = (i % cols) * TILE_PX;
    const oy = Math.floor(i / cols) * TILE_PX;
    b.fillRect(ox, oy, TILE_PX, TILE_PX, hex(SWATCH[name]));
    b.fillRect(ox, oy, TILE_PX, 1, hex('#FFFFFF', 90));
    b.fillRect(ox, oy, 1, TILE_PX, hex('#FFFFFF', 90));
  });
  const tiles = 'tiles/tile_town_ph.png';
  save(tiles, b.toPng());
  register('tile.town', { file: tiles, tile: [TILE_PX, TILE_PX], columns: cols, count: TOWN_TILES.length });
  record(tiles);
  // 맵은 없을 때만 만든다 (Tiled에서 고친 맵을 덮어쓰지 않게). 다시 만들려면 --map
  const file = 'maps/town.json';
  if (FORCE_MAP || !existsSync(join(ROOT, file))) save(file, JSON.stringify(buildTownMap(tiles)) + '\n');
  register('map.town', { file });
  record(file, '자체 제작 (scripts/lib/town-map.ts, Tiled JSON)');
  // 2동·3동… 동네가 함께 쓰는 틀 맵
  const hood = 'maps/hood.json';
  if (FORCE_MAP || !existsSync(join(ROOT, hood))) save(hood, JSON.stringify(buildHoodMap(tiles)) + '\n');
  register('map.hood', { file: hood });
  // 놀이터: 중앙광장 비콘으로 가는 낚시터·클럽·상가
  for (const kind of ['fishing', 'club', 'market'] as const) {
    const f = `maps/${kind}.json`;
    if (FORCE_MAP || !existsSync(join(ROOT, f))) save(f, JSON.stringify(buildSpotMap(kind, tiles)) + '\n');
    register(`map.${kind}`, { file: f });
    record(f);
  }
  record(hood, '자체 제작 (scripts/lib/town-map.ts, Tiled JSON)');
}

// ───────────────────────── 창밖 풍경 (지역마다 512×512) ─────────────────────────

function gradient(b: Bitmap, top: string, bottom: string, from = 0, to = b.height) {
  const a = hex(top);
  const c = hex(bottom);
  for (let y = from; y < to; y++) {
    const t = (y - from) / Math.max(1, to - from - 1);
    b.fillRect(0, y, b.width, 1, [0, 1, 2].map((k) => Math.round(a[k] + (c[k] - a[k]) * t)).concat(255) as RGBA);
  }
}

function cloud(b: Bitmap, x: number, y: number, s: number, c: RGBA) {
  b.fillEllipse(x, y, 40 * s, 20 * s, c);
  b.fillEllipse(x - 30 * s, y + 6 * s, 26 * s, 14 * s, c);
  b.fillEllipse(x + 32 * s, y + 5 * s, 28 * s, 15 * s, c);
}

function tree(b: Bitmap, x: number, y: number, s: number, leaf: string, dark: string) {
  b.fillRect(x - 4 * s, y, 8 * s, 30 * s, hex('#9B6B45'));
  b.fillEllipse(x, y - 8 * s, 30 * s, 32 * s, hex(dark));
  b.fillEllipse(x - 8 * s, y - 16 * s, 22 * s, 22 * s, hex(leaf));
}

function house(b: Bitmap, x: number, y: number, w: number, h: number, wall: string, roof: string, light?: string) {
  b.fillRect(x, y, w, h, hex(wall));
  b.fillPolygon([[x - 8, y], [x + w / 2, y - h * 0.7], [x + w + 8, y]], hex(roof));
  b.fillRect(x + w * 0.38, y + h * 0.45, w * 0.24, h * 0.55, hex('#B48558'));
  if (light) b.fillRect(x + w * 0.12, y + h * 0.2, w * 0.18, h * 0.2, hex(light));
}

/** 방 창밖 풍경: 사는 마을의 기질 그룹 풍경 */
const VIEWS: Record<Theme, (b: Bitmap) => void> = {
  NF: (b) => {
    gradient(b, '#9FD6F5', '#E7F7FF', 0, 330);
    cloud(b, 140, 90, 1.1, hex('#FFFFFF', 230));
    cloud(b, 380, 140, 0.8, hex('#FFFFFF', 210));
    b.fillEllipse(130, 380, 260, 120, hex('#9BD49C'));
    b.fillEllipse(420, 400, 240, 120, hex('#86C98E'));
    b.fillRect(0, 380, 512, 132, hex('#86C98E'));
    // 온실
    b.fillRect(300, 270, 130, 100, hex('#DFF6F0', 230));
    b.fillPolygon([[292, 272], [365, 215], [438, 272]], hex('#CDEFE6', 240));
    for (const x of [326, 352, 378, 404]) b.fillRect(x, 270, 3, 100, hex('#FFFFFF'));
    for (const [x, y, s] of [[60, 360, 1.3], [150, 390, 1.0], [230, 350, 1.4], [470, 360, 1.2], [270, 420, 1.1], [420, 440, 1.3]]) {
      tree(b, x, y, s, '#8ED39A', '#5FAE6E');
    }
  },
  SP: (b) => {
    gradient(b, '#F7A27E', '#FFE0B5', 0, 360);
    b.fillEllipse(256, 300, 70, 70, hex('#FFF3C9', 230));
    cloud(b, 120, 110, 0.9, hex('#FFC6B0', 200));
    cloud(b, 400, 80, 1.0, hex('#FFD3B8', 200));
    b.fillRect(0, 340, 512, 172, hex('#D88072'));
    const roofs = ['#E86A5A', '#C95A50', '#F07E64'];
    for (let i = 0; i < 7; i++) {
      const x = -10 + i * 78;
      const h = 70 + ((i * 37) % 50);
      house(b, x, 420 - h * 0.6, 64, h, '#FBE3D2', roofs[i % 3], '#FFE58A');
    }
    for (let i = 0; i < 18; i++) b.fillEllipse(20 + i * 28, 470 + (i % 2) * 6, 4, 4, hex('#FFE58A'));
  },
  NT: (b) => {
    gradient(b, '#C9D6E6', '#F4F7FB', 0, 512);
    cloud(b, 130, 80, 0.9, hex('#FFFFFF', 220));
    const towers: [number, number, number][] = [[20, 150, 90], [120, 90, 110], [240, 180, 80], [330, 60, 120], [450, 140, 80]];
    for (const [x, top, w] of towers) {
      b.fillRect(x, top, w, 512 - top, hex('#AEBBCC'));
      b.fillRect(x + 6, top + 6, w - 12, 512 - top, hex('#DCE6F2', 220));
      for (let y = top + 16; y < 512; y += 22) b.fillRect(x + 8, y, w - 16, 3, hex('#FFFFFF', 200));
      b.fillRect(x + w * 0.45, top + 8, 4, 512 - top, hex('#C3CFDD'));
    }
    b.fillRect(0, 470, 512, 42, hex('#BCC7D6'));
  },
  SJ: (b) => {
    gradient(b, '#1E2B57', '#5A6FA8', 0, 300);
    const r = (k: number) => {
      const v = Math.sin(k * 12.9898) * 43758.5453;
      return v - Math.floor(v);
    };
    for (let i = 0; i < 46; i++) b.fillEllipse(r(i) * 512, r(i + 100) * 250, 1.2 + r(i + 200), 1.2 + r(i + 200), hex('#FFFFFF', 150 + Math.round(r(i + 300) * 100)));
    b.fillEllipse(380, 110, 46, 46, hex('#FFF7D6'));
    b.fillEllipse(396, 100, 42, 42, hex('#2A3A6B', 120));
    b.fillEllipse(80, 300, 200, 60, hex('#3D4E86'));
    b.fillEllipse(460, 300, 180, 50, hex('#34457A'));
    gradient(b, '#4F67A3', '#2B3A6B', 300, 512);
    b.fillEllipse(380, 360, 30, 90, hex('#FFF7D6', 70));
    for (let i = 0; i < 6; i++) b.fillRect(330 + (i % 2) * 20, 330 + i * 24, 80 - i * 6, 3, hex('#FFF7D6', 90));
    b.fillRect(0, 280, 512, 30, hex('#DDE6FF', 50));
  },
};

function genViews() {
  for (const t of THEMES) {
    const b = new Bitmap(512, 512);
    VIEWS[t](b);
    const file = `room/room_view_${t.toLowerCase()}_ph.png`;
    save(file, b.toPngUpFilter());
    register(`room.view.${t.toLowerCase()}`, { file, size: [512, 512] });
    record(file);
  }
}

// ───────────────────────── UI 아이콘 (SVG, currentColor) ─────────────────────────

const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICONS: Record<string, string> = {
  // 마을 몸짓·이모티콘 (머리 위 말풍선도 이 아이콘으로 그린다)
  cheer:
    '<path d="M12 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/><path d="M4.5 4.5 9 10h6l4.5-5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 10v5l-1.5 6.5M15 10v5l1.5 6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  clap:
    '<path d="M7.5 20.5 4 13.5a1.6 1.6 0 0 1 2.8-1.5L9 15.5V6.5a1.5 1.5 0 0 1 3 0v6h.5V4.5a1.5 1.5 0 0 1 3 0v8h.5V6.5a1.5 1.5 0 0 1 3 0V15c0 3-2 5.5-5 5.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M3 5l1.5 1.5M6 2.5l.5 2M20.5 3l-1.5 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  heart: '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z"/>',
  question:
    '<path d="M8.5 9a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.2-1.5 2.3v.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="19" r="1.4"/>',
  wow: '<path d="M12 4v10.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="19.2" r="1.6"/>',
  // 놀거리: 바구니(모은 열매·물고기), 낚싯대
  basket: `<path d="M3.5 10h17l-1.8 8.2a2 2 0 0 1-2 1.6H7.3a2 2 0 0 1-2-1.6Z" ${S}/><path d="M7.5 10 11 4.5M16.5 10 13 4.5M9 13.5v3M12 13.5v3M15 13.5v3" ${S}/>`,
  fishing: `<path d="M5 20 18.5 4.5M18.5 4.5v9.5" ${S}/><path d="M18.5 14a2 2 0 1 1-2 2" ${S}/>`,
  drink: `<path d="M4.5 4.5h15L12 12.5Z" ${S}/><path d="M12 12.5V19M8 19.5h8M15.5 4.5l2-2.5" ${S}/>`,
  // 아래 탭: 도감(펼친 책), 캐릭터(옷걸이에 건 티셔츠)
  dex: `<path d="M12 6.5C10 5 7.5 4.5 4 4.8v13.4c3.5-.3 6 .2 8 1.8 2-1.6 4.5-2.1 8-1.8V4.8c-3.5-.3-6 .2-8 1.7Z" ${S}/><path d="M12 6.5V20" ${S}/>`,
  character: `<path d="M9 4.5 4 7.5l2 3.5 2-1v9.5h8V10l2 1 2-3.5-5-3c-.5 1.5-1.7 2.3-3 2.3S9.5 6 9 4.5Z" ${S}/>`,
  // 몸짓 (안녕·꾸벅·춤·폴짝·갸웃)
  wave: `<path d="M8.5 13.5V7a1.4 1.4 0 0 1 2.8 0v4.5M11.3 11V5a1.4 1.4 0 0 1 2.8 0v6M14.1 11V6.5a1.4 1.4 0 0 1 2.8 0v7c0 4-2.6 6.5-6.2 6.5-2.8 0-4.4-1.6-5.2-3.8L4.6 12a1.3 1.3 0 0 1 2.3-1.1l1.6 2.6" ${S}/><path d="M19 3.8c1 .8 1.6 1.9 1.7 3.2M3.6 6.4c.3-1.2.9-2.1 1.9-2.8" ${S}/>`,
  bow: `<circle cx="16" cy="6.5" r="2.3" ${S}/><path d="M14.2 9 9 11.2l.6 4.6M9.6 15.8 8 21M9.6 15.8l3.6 5.2M9 11.2 6.2 14.6" ${S}/>`,
  dance: `<circle cx="11" cy="4.6" r="2" ${S}/><path d="M11 7v6l-3 7M11 13l3.4 6.8M11 9.2l5-3.4M11 9.2 6.2 11" ${S}/><path d="M18.5 12.5v5" ${S}/><circle cx="17.3" cy="17.8" r="1.3"/>`,
  jump: `<path d="M12 16V4.5M7.5 9l4.5-4.5L16.5 9M5 20.5h14" ${S}/>`,
  think: `<path d="M4.5 10.5c0-3 2.9-5 6.5-5s6.5 2 6.5 5-2.9 5-6.5 5c-1 0-1.9-.1-2.7-.4L5 16.5l.9-2.7a4.3 4.3 0 0 1-1.4-3.3Z" ${S}/><circle cx="18.6" cy="17.6" r="1.4" ${S}/><circle cx="20.8" cy="21" r=".9"/>`,
  home: `<path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1Z" ${S}/>`,
  map: `<path d="M3.5 6.2 9 4l6 2.2 5.5-2.2v13.8L15 20l-6-2.2-5.5 2.2Z" ${S}/><path d="M9 4v13.8M15 6.2V20" ${S}/>`,
  archive: `<path d="M5 4.5h10.5A2.5 2.5 0 0 1 18 7v13H7.5A2.5 2.5 0 0 1 5 17.5Z" ${S}/><path d="M5 17.5A2.5 2.5 0 0 1 7.5 15H18M9 8.5h5" ${S}/>`,
  my: `<circle cx="12" cy="8.5" r="3.8" ${S}/><path d="M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5" ${S}/>`,
  play: '<path d="M8 5.5v13l11-6.5Z"/>',
  pause: '<rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/>',
  edit: `<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z" ${S}/><path d="m13.5 6.5 4 4" ${S}/>`,
  rotate: `<path d="M19 12a7 7 0 1 1-2.05-4.95M19 4v4h-4" ${S}/>`,
  trash: `<path d="M4.5 7h15M9.5 7V5h5v2M6.5 7l1 13h9l1-13M10 11v6M14 11v6" ${S}/>`,
  plus: `<path d="M12 5v14M5 12h14" ${S}/>`,
  close: `<path d="M6 6l12 12M18 6 6 18" ${S}/>`,
  check: `<path d="m5 12.5 4.5 4.5L19 7.5" ${S}/>`,
  mail: `<rect x="3.5" y="5.5" width="17" height="13" rx="2" ${S}/><path d="m4 7 8 6 8-6" ${S}/>`,
  photo: `<rect x="3.5" y="5" width="17" height="14" rx="2.5" ${S}/><circle cx="9" cy="10" r="1.8" ${S}/><path d="m4 17 5-4.5 4 3.5 2.5-2 4.5 4" ${S}/>`,
  lock: `<rect x="5" y="10.5" width="14" height="9.5" rx="2" ${S}/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" ${S}/>`,
  friends: `<circle cx="9" cy="9" r="3.2" ${S}/><path d="M3 19c.6-3 3-4.6 6-4.6s5.4 1.6 6 4.6" ${S}/><path d="M15.5 6.2a3 3 0 1 1 .8 5.8M17 14.6c2.2.4 3.7 1.9 4 4.4" ${S}/>`,
  globe: `<circle cx="12" cy="12" r="8.5" ${S}/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5Z" ${S}/>`,
  music: `<path d="M9 18V6l10-2v12" ${S}/><circle cx="6.5" cy="18" r="2.5" ${S}/><circle cx="16.5" cy="16" r="2.5" ${S}/>`,
  back: `<path d="M15 5 8 12l7 7" ${S}/>`,
  exit: `<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9.5 16.5 5 12l4.5-4.5M5 12h10" ${S}/>`,
  share: `<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" ${S}/>`,
  flag: `<path d="M5.5 21V4.5M5.5 5h11l-2 4 2 4h-11" ${S}/>`,
  block: `<circle cx="12" cy="12" r="8.5" ${S}/><path d="m6 6 12 12" ${S}/>`,
  sparkle: '<path d="M12 3c.6 4.3 1.9 6 6 6.9-4.1.9-5.4 2.6-6 6.9-.6-4.3-1.9-6-6-6.9 4.1-.9 5.4-2.6 6-6.9Z"/><path d="M18.5 15c.3 1.8.9 2.5 2.5 2.8-1.6.3-2.2 1-2.5 2.7-.3-1.7-.9-2.4-2.5-2.7 1.6-.3 2.2-1 2.5-2.8Z"/>',
  // 오행 지역 대항전: 왕관 (우승), 막대 순위 (순위표)
  crown: `<path d="M4 18h16M4.5 15 3.5 7l5 4 3.5-6 3.5 6 5-4-1 8Z" ${S}/>`,
  ranking: `<path d="M4 20h16M6.5 20v-6M12 20V6M17.5 20v-9" ${S}/>`,
  debate: `<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h7A2.5 2.5 0 0 1 16 6.5v4a2.5 2.5 0 0 1-2.5 2.5H9l-3.5 3v-3A2.5 2.5 0 0 1 4 10.5Z" ${S}/><path d="M16 9h1.5A2.5 2.5 0 0 1 20 11.5v4A2.5 2.5 0 0 1 17.5 18v2.5L14.5 18H12" ${S}/>`,
};

// 감정 아이콘: 얼굴 모양. 색은 화면에서 감정 색 토큰으로 칠한다.
const FACE = `<circle cx="12" cy="12" r="9" ${S}/>`;
const EMOTION_ICONS: Record<(typeof EMOTIONS)[number], string> = {
  calm: `${FACE}<path d="M7.5 10.5q1.5 1.2 3 0M13.5 10.5q1.5 1.2 3 0M9 15q3 1.8 6 0" ${S}/>`,
  joy: `${FACE}<path d="M7.5 10q1.5-1.6 3 0M13.5 10q1.5-1.6 3 0M8 13.5q4 4.5 8 0Z" ${S}/>`,
  flutter: `${FACE}<path d="M9 8.6c-.9-1-2.6-.3-2.3 1 .2 1 2.3 2.3 2.3 2.3s2.1-1.3 2.3-2.3c.3-1.3-1.4-2-2.3-1ZM15 8.6c-.9-1-2.6-.3-2.3 1 .2 1 2.3 2.3 2.3 2.3s2.1-1.3 2.3-2.3c.3-1.3-1.4-2-2.3-1Z"/><path d="M9.5 15.5q2.5 1.5 5 0" ${S}/>`,
  tired: `${FACE}<path d="M7.5 10.5h3M13.5 10.5h3M10 16h4M17.5 4.5h2.5l-2.5 2.5H20" ${S}/>`,
  sad: `${FACE}<path d="M7.8 9.5l2.5 1M16.2 9.5l-2.5 1M9 16.5q3-2.2 6 0" ${S}/><path d="M8 13c-.6.9-.6 1.6 0 2 .6-.4.6-1.1 0-2Z"/>`,
  complex: `${FACE}<path d="M8 10h2.5M13.5 10H16M8.5 15.5q1-1.2 2 0t2 0 2 0" ${S}/>`,
  angry: `${FACE}<path d="M7.5 8.5l3 1.5M16.5 8.5l-3 1.5M9 16h6" ${S}/>`,
};

function svg(body: string, filled = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'currentColor'}">${body}</svg>\n`;
}

function genIcons() {
  for (const [name, body] of Object.entries(ICONS)) {
    const file = `ui/ui_icon_${name}_ph.svg`;
    save(file, svg(body));
    register(`ui.icon.${name}`, { file });
    record(file);
  }
  for (const [name, body] of Object.entries(EMOTION_ICONS)) {
    const file = `ui/ui_emotion_${name}_ph.svg`;
    save(file, svg(body));
    register(`ui.emotion.${name}`, { file });
    record(file);
  }
}

// ───────────────────────── 가방 아이템 아이콘 (열매·물고기) ─────────────────────────

function genItems() {
  for (const [kind, list] of [['fruit', fruitIcons()], ['fish', fishIcons()]] as const) {
    for (const { id, svg: body } of list) {
      const file = `items/item_${kind}_${id}_ph.svg`;
      save(file, body);
      register(`item.${kind}.${id}`, { file });
      record(file);
    }
  }
}

// ───────────────────────── BGM ─────────────────────────

function genBgm() {
  for (const t of BGM_TRACKS) {
    const name = t.key.split('.')[1];
    const ogg = `audio/bgm_${name}_ph.ogg`;
    const mp3 = `audio/bgm_${name}_ph.mp3`;
    if (!SKIP_AUDIO || !existsSync(join(ROOT, ogg))) {
      const out = encodeTrack(TRACKS[name]);
      save(ogg, out.ogg);
      save(mp3, out.mp3);
      register(t.key, { file: ogg, alt: mp3, title: t.title, mood: t.mood, seconds: out.seconds });
    }
    record(ogg);
    record(mp3);
  }
}

// ───────────────────────── 결과 카드 배경 (1080×1350) ─────────────────────────

function genCardBackground() {
  const W = 1080;
  const H = 1350;
  const b = new Bitmap(W, H);
  gradient(b, tokens.scene.skyTop, tokens.scene.skyHorizon, 0, Math.round(H * 0.75));
  b.fillRect(0, Math.round(H * 0.75), W, H, hex(tokens.scene.skyHorizon));
  const c = hex(tokens.scene.cloud, 235);
  for (const [cx, cy, s] of [[170, 120, 1], [880, 210, 1.3], [520, 70, 0.8], [120, 1180, 0.9], [960, 1230, 1.1]]) {
    cloud(b, cx, cy, s * 2.2, c);
  }
  b.fillEllipse(260, H + 120, 620, 300, hex(tokens.scene.grassDark));
  b.fillEllipse(860, H + 160, 640, 330, hex(tokens.scene.grass));
  const file = 'cards/card_bg_default_ph.png';
  save(file, b.toPngUpFilter());
  register('card.bg.default', { file, size: [W, H] });
  record(file);
}

function cleanManifest() {
  for (const [key, entry] of Object.entries(manifest)) {
    const file = entry.file as string;
    if (/_ph\.[a-z0-9]+$/.test(file) && !existsSync(join(ROOT, file))) delete manifest[key];
  }
}

function writeLicenses() {
  const path = join(ROOT, 'LICENSES.md');
  const header = [
    '# 에셋 출처와 라이선스',
    '',
    '외부 에셋은 상업적 이용이 가능한 것만 쓴다. 추가할 때마다 한 줄씩 기록한다 (PROJECT_GUIDE.md 22장).',
    'AI로 생성한 이미지·모델은 출처 칸에 사용한 도구를 적는다. 음악은 권리 허락을 확인한 곡만 넣는다.',
    '',
    '| 파일 | 출처 | 라이선스 | 받은 날짜 |',
    '|---|---|---|---|',
    '| fonts/pretendard/ (pretendard.css, PretendardVariable.subset.*.woff2) | https://github.com/orioncactus/pretendard (npm pretendard@1.3.9) | SIL Open Font License 1.1 | 2026-11-02 |',
  ].join('\n');
  const text = existsSync(path) ? readFileSync(path, 'utf8') : header + '\n';
  const lines = text.trimEnd().split('\n').filter((line) => {
    const file = line.match(/^\| ([^|]+?) \|/)?.[1];
    return !file || file.includes(' ') || file.endsWith('/') || file === '파일' || existsSync(join(ROOT, file));
  });
  for (const m of made) {
    if (!lines.some((l) => l.startsWith(`| ${m.file} |`))) lines.push(`| ${m.file} | ${m.source} | ${SELF_LICENSE} | ${TODAY} |`);
  }
  save('LICENSES.md', lines.join('\n') + '\n');
}

cleanManifest();
await genAvatar();
genGuides();
await genFurniture();
await genTownProps();
genTownMap();
genViews();
genIcons();
genItems();
genBgm();
genCardBackground();
register('font.pretendard', { file: 'fonts/pretendard/pretendard.css' });
cleanManifest();
save('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
writeLicenses();

console.log(`임시 에셋 ${made.length}개를 만들었습니다.`);
console.log(added.length ? `manifest에 새 키 ${added.length}개 추가: ${added.join(', ')}` : 'manifest 새 키 없음');
