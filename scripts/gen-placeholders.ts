// 아트가 나오기 전에 쓸 임시(_ph) 에셋을 실제 규격대로 만든다 (PROJECT_GUIDE.md 16장).
// - _ph 파일은 매번 다시 만든다.
// - manifest.json에는 없는 키만 추가한다. 이미 있는 키(실제 에셋으로 바꾼 키)는 건드리지 않는다.
// - maps/town.json은 없을 때만 만든다. Tiled에서 고친 맵을 덮어쓰지 않기 위해서다. 다시 만들려면 --map.
// - LICENSES.md는 없는 파일의 줄을 지우고, 새 파일의 줄을 더한다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { MBTI_TYPES, groupOf } from '../src/design/mbti';
import { tokens } from '../src/design/tokens';
import { TILE_PX } from '../src/shared/plazaMap';
import { Bitmap, hex } from './lib/bitmap';
import {
  PROP_MATERIALS, benchParts, boardParts, buildSkinned, buildStatic, chibiCharacterSpec, flagParts, fountainParts,
  groupPropParts, houseParts, lampParts, signParts, treeParts, villageFlagParts, type Part,
} from './lib/models';
import { TOWN_TILES, buildTownMap } from './lib/town-map';

const ROOT = join(import.meta.dirname, '..', 'public', 'assets');
const TODAY = new Date().toISOString().slice(0, 10);
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

async function model(key: string, file: string, bytes: Promise<Uint8Array>, extra: Record<string, unknown> = {}) {
  save(file, await bytes);
  register(key, { file, ...extra });
  record(file);
}

// ───────────────────────── 캐릭터 ─────────────────────────

async function genCharacters() {
  await model('char.base', 'characters/char_base_ph.glb', buildSkinned('char_base', chibiCharacterSpec()));
  // 유형 소품: 임시로 기질 그룹마다 하나씩 만들고, 같은 그룹 유형은 같은 파일을 쓴다
  for (const group of ['NT', 'NF', 'SJ', 'SP'] as const) {
    const file = `characters/char_${group.toLowerCase()}_prop_ph.glb`;
    save(file, await buildStatic(`prop_${group}`, groupPropParts(group), { base: { roughness: 0.6 }, outfit: { roughness: 0.7 } }));
    record(file);
  }
  for (const code of MBTI_TYPES) {
    register(`char.${code.toLowerCase()}.prop`, { file: `characters/char_${groupOf(code).toLowerCase()}_prop_ph.glb` });
  }
}

// ───────────────────────── 광장 소품 ─────────────────────────

async function genProps() {
  const props: [string, Part[]][] = [
    ['fountain', fountainParts()],
    ['bench', benchParts()],
    ['board', boardParts()],
    ['flag', flagParts(tokens.color.accent)],
    ['tree', treeParts()],
    ['lamp', lampParts()],
  ];
  for (const [name, parts] of props) {
    await model(`prop.plaza.${name}`, `props/prop_plaza_${name}_ph.glb`, buildStatic(`prop_plaza_${name}`, parts, PROP_MATERIALS));
  }
  // 유형 마을 소품: outfit 재질 부분은 화면에서 마을 유형 색으로 칠한다
  const village: [string, Part[]][] = [
    ['house', houseParts()],
    ['flag', villageFlagParts()],
    ['sign', signParts()],
  ];
  for (const [name, parts] of village) {
    await model(`prop.village.${name}`, `props/prop_village_${name}_ph.glb`, buildStatic(`prop_village_${name}`, parts, PROP_MATERIALS));
  }
}

// ───────────────────────── Tiled 타일셋 견본 ─────────────────────────

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

function genTileset() {
  const cols = 4;
  const b = new Bitmap(cols * TILE_PX, Math.ceil(TOWN_TILES.length / cols) * TILE_PX);
  TOWN_TILES.forEach((name, i) => {
    const ox = (i % cols) * TILE_PX;
    const oy = Math.floor(i / cols) * TILE_PX;
    b.fillRect(ox, oy, TILE_PX, TILE_PX, hex(SWATCH[name]));
    b.fillRect(ox, oy, TILE_PX, 1, hex('#FFFFFF', 90));
    b.fillRect(ox, oy, 1, TILE_PX, hex('#FFFFFF', 90));
  });
  const file = 'tiles/tile_town_ph.png';
  save(file, b.toPng());
  register('tile.town', { file, tile: [TILE_PX, TILE_PX], columns: cols, count: TOWN_TILES.length });
  record(file);
}

// ───────────────────────── UI 아이콘 (SVG, currentColor) ─────────────────────────
// 머리 위 이모티콘 말풍선도 이 아이콘으로 그린다.

const ICONS: Record<string, string> = {
  cheer:
    '<path d="M12 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/><path d="M4.5 4.5 9 10h6l4.5-5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 10v5l-1.5 6.5M15 10v5l1.5 6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  clap:
    '<path d="M7.5 20.5 4 13.5a1.6 1.6 0 0 1 2.8-1.5L9 15.5V6.5a1.5 1.5 0 0 1 3 0v6h.5V4.5a1.5 1.5 0 0 1 3 0v8h.5V6.5a1.5 1.5 0 0 1 3 0V15c0 3-2 5.5-5 5.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M3 5l1.5 1.5M6 2.5l.5 2M20.5 3l-1.5 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  heart: '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z"/>',
  question:
    '<path d="M8.5 9a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.2-1.5 2.3v.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="19" r="1.4"/>',
  wow: '<path d="M12 4v10.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="19.2" r="1.6"/>',
  exit:
    '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9.5 16.5 5 12l4.5-4.5M5 12h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  map:
    '<path d="M3.5 6.2 9 4l6 2.2 5.5-2.2v13.8L15 20l-6-2.2-5.5 2.2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 4v13.8M15 6.2V20" stroke="currentColor" stroke-width="2"/>',
};

function genIcons() {
  for (const [name, body] of Object.entries(ICONS)) {
    const file = `ui/ui_icon_${name}_ph.svg`;
    save(file, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">${body}</svg>\n`);
    register(`ui.icon.${name}`, { file });
    record(file);
  }
}

// ───────────────────────── 결과 카드 배경 (1080×1350) ─────────────────────────
// 글자는 코드가 올린다. 배경에는 하늘·구름·언덕만 그린다.

function genCardBackground() {
  const W = 1080;
  const H = 1350;
  const b = new Bitmap(W, H);
  const top = hex(tokens.scene.skyTop);
  const mid = hex(tokens.scene.skyHorizon);
  const lerp = (x: number, y: number, t: number) => Math.round(x + (y - x) * t);
  for (let y = 0; y < H; y++) {
    const t = Math.min(1, y / (H * 0.75));
    const c: [number, number, number, number] = [lerp(top[0], mid[0], t), lerp(top[1], mid[1], t), lerp(top[2], mid[2], t), 255];
    b.fillRect(0, y, W, 1, c);
  }
  const cloud = hex(tokens.scene.cloud, 235);
  for (const [cx, cy, s] of [[170, 120, 1], [880, 210, 1.3], [520, 70, 0.8], [120, 1180, 0.9], [960, 1230, 1.1]]) {
    b.fillEllipse(cx, cy, 90 * s, 46 * s, cloud);
    b.fillEllipse(cx - 70 * s, cy + 14 * s, 60 * s, 34 * s, cloud);
    b.fillEllipse(cx + 75 * s, cy + 12 * s, 64 * s, 36 * s, cloud);
  }
  b.fillEllipse(260, H + 120, 620, 300, hex(tokens.scene.grassDark));
  b.fillEllipse(860, H + 160, 640, 330, hex(tokens.scene.grass));
  const file = 'cards/card_bg_default_ph.png';
  save(file, b.toPngUpFilter());
  register('card.bg.default', { file, size: [W, H] });
  record(file);
}

function genMap() {
  const file = 'maps/town.json';
  if (FORCE_MAP || !existsSync(join(ROOT, file))) {
    save(file, JSON.stringify(buildTownMap(manifest['tile.town'].file as string)) + '\n');
  }
  register('map.town', { file });
  record(file, '자체 제작 (scripts/lib/town-map.ts, Tiled JSON)');
}

function writeLicenses() {
  const path = join(ROOT, 'LICENSES.md');
  const header = [
    '# 에셋 출처와 라이선스',
    '',
    '외부 에셋은 상업적 이용이 가능한 것만 쓴다. 추가할 때마다 한 줄씩 기록한다 (PROJECT_GUIDE.md 15장).',
    'AI로 생성한 이미지·모델은 출처 칸에 사용한 도구를 적는다.',
    '',
    '| 파일 | 출처 | 라이선스 | 받은 날짜 |',
    '|---|---|---|---|',
    '| fonts/pretendard/ (pretendard.css, PretendardVariable.subset.*.woff2) | https://github.com/orioncactus/pretendard (npm pretendard@1.3.9) | SIL Open Font License 1.1 | 2026-11-02 |',
  ].join('\n');
  const text = existsSync(path) ? readFileSync(path, 'utf8') : header + '\n';
  const lines = text.trimEnd().split('\n').filter((line) => {
    const file = line.match(/^\| ([^|]+?) \|/)?.[1];
    // 폴더 단위 줄과 표 머리는 남기고, 없어진 파일의 줄은 지운다
    return !file || file.includes(' ') || file.endsWith('/') || file === '파일' || existsSync(join(ROOT, file));
  });
  for (const m of made) {
    if (!lines.some((l) => l.startsWith(`| ${m.file} |`))) lines.push(`| ${m.file} | ${m.source} | ${SELF_LICENSE} | ${TODAY} |`);
  }
  save('LICENSES.md', lines.join('\n') + '\n');
}

await genCharacters();
await genProps();
genTileset();
genIcons();
genCardBackground();
genMap();
register('font.pretendard', { file: 'fonts/pretendard/pretendard.css' });
save('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
writeLicenses();

console.log(`임시 에셋 ${made.length}개를 만들었습니다.`);
console.log(added.length ? `manifest에 새 키 ${added.length}개 추가: ${added.join(', ')}` : 'manifest 새 키 없음');
