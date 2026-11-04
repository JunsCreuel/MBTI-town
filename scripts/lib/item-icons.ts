// 가방(인벤토리) 아이템 아이콘: 열매 6종, 물고기 45종 (장화·병·황금 고래 포함). 64×64 컬러 SVG.
// 색은 src/shared/play.ts의 열매·물고기 색을 그대로 쓴다. 테두리는 몸 색을 진하게 한 색.
import { FISH, FORTUNE_FRUIT, FRUITS, type FishDef } from '../../src/shared/play';

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// 크기를 적어 둬야 캔버스에 그릴 때(화면 속 잡은 물고기) 어느 브라우저에서나 같은 크기로 나온다
const wrap = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${body}</svg>\n`;
const LEAF = '#5FAE5A';
const STEM = '#8A5A3A';
const SHINE = `fill="#FFFFFF" fill-opacity="0.55"`;
/** 바닥 그림자 */
const SHADOW = `<ellipse cx="32" cy="58" rx="17" ry="3.2" fill="#000000" fill-opacity="0.12"/>`;

// ───────────────────────── 열매 ─────────────────────────

function apple(c: string) {
  const o = shade(c, -0.35);
  return `${SHADOW}<path d="M32 18c-5-4-17-4-19 8-2 11 6 27 13 27 3 0 4-1.5 6-1.5s3 1.5 6 1.5c7 0 15-16 13-27-2-12-14-12-19-8Z" fill="${c}" stroke="${o}" stroke-width="2.5"/>
<path d="M32 18c0-4 1-7 3-9" stroke="${STEM}" stroke-width="3" stroke-linecap="round" fill="none"/>
<path d="M35 13c3-5 9-6 12-4-2 5-7 7-12 4Z" fill="${LEAF}"/>
<ellipse cx="22" cy="28" rx="3.5" ry="6" transform="rotate(20 22 28)" ${SHINE}/>`;
}

function peach(c: string) {
  const o = shade(c, -0.3);
  return `${SHADOW}<circle cx="32" cy="35" r="19" fill="${c}" stroke="${o}" stroke-width="2.5"/>
<path d="M32 17c-4 8-4 26 0 36" stroke="${o}" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M33 17c2-5 8-7 12-5-2 5-7 7-12 5Z" fill="${LEAF}"/>
<circle cx="40" cy="38" r="9" fill="#FF8FA3" fill-opacity="0.35"/>
<ellipse cx="22" cy="29" rx="3.5" ry="6" transform="rotate(20 22 29)" ${SHINE}/>`;
}

function persimmon(c: string) {
  const o = shade(c, -0.3);
  return `${SHADOW}<ellipse cx="32" cy="37" rx="21" ry="17" fill="${c}" stroke="${o}" stroke-width="2.5"/>
<path d="M32 22l-9-3 5 6-9 2 10 2 3 6 3-6 10-2-9-2 5-6Z" fill="${LEAF}" stroke="${shade(LEAF, -0.3)}" stroke-width="1.2" stroke-linejoin="round"/>
<rect x="30.5" y="15" width="3" height="7" rx="1.5" fill="${STEM}"/>
<ellipse cx="21" cy="36" rx="3.5" ry="6" transform="rotate(25 21 36)" ${SHINE}/>`;
}

function pear(c: string) {
  const o = shade(c, -0.35);
  return `${SHADOW}<path d="M32 13c-6 0-8 6-8 11 0 4-9 9-9 19 0 9 8 13 17 13s17-4 17-13c0-10-9-15-9-19 0-5-2-11-8-11Z" fill="${c}" stroke="${o}" stroke-width="2.5"/>
<path d="M32 13c0-3 1-5 3-7" stroke="${STEM}" stroke-width="3" stroke-linecap="round" fill="none"/>
<path d="M35 9c3-4 8-4 10-2-2 4-6 5-10 2Z" fill="${LEAF}"/>
<ellipse cx="24" cy="40" rx="3.5" ry="6" transform="rotate(15 24 40)" ${SHINE}/>
<circle cx="38" cy="44" r="1.2" fill="${o}"/><circle cx="34" cy="49" r="1.2" fill="${o}"/><circle cx="41" cy="38" r="1.2" fill="${o}"/>`;
}

function grape(c: string) {
  const o = shade(c, -0.35);
  const balls: [number, number][] = [[22, 24], [32, 23], [42, 24], [27, 33], [37, 33], [22, 41], [32, 42], [42, 41], [27, 50], [37, 50], [32, 57]];
  return `<ellipse cx="32" cy="60" rx="12" ry="2.5" fill="#000000" fill-opacity="0.12"/>
<path d="M32 22c0-5 1-9 4-12" stroke="${STEM}" stroke-width="3" stroke-linecap="round" fill="none"/>
<path d="M35 13c5-5 12-4 14-1-4 5-10 5-14 1Z" fill="${LEAF}"/>
${balls.map(([x, y]) => `<circle cx="${x}" cy="${y - 4}" r="6" fill="${c}" stroke="${o}" stroke-width="2"/><circle cx="${x - 2}" cy="${y - 6}" r="1.6" ${SHINE}/>`).join('')}`;
}

function fortune(c: string) {
  const o = shade(c, -0.35);
  return `${SHADOW}<circle cx="32" cy="35" r="19" fill="${c}" stroke="${o}" stroke-width="2.5"/>
<path d="M32 16c0-3 1-6 3-8" stroke="${STEM}" stroke-width="3" stroke-linecap="round" fill="none"/>
<path d="M23 17l-4 9 6-2 2 6 3-11Z" fill="#E2483D"/>
<path d="M32 26l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6-4.5-4.1 6-.7Z" fill="#FFFFFF" fill-opacity="0.85"/>
<path d="M50 14l1.4 3 3 1.4-3 1.4-1.4 3-1.4-3-3-1.4 3-1.4Z" fill="${c}"/>
<path d="M12 44l1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" fill="${c}"/>`;
}

const FRUIT_DRAW: Record<string, (c: string) => string> = { apple, peach, persimmon, pear, grape, fortune };

export function fruitIcons(): { id: string; svg: string }[] {
  return [...Object.values(FRUITS), FORTUNE_FRUIT].map((f) => ({ id: f.id, svg: wrap(FRUIT_DRAW[f.id](f.color)) }));
}

// ───────────────────────── 물고기 ─────────────────────────

interface Look {
  /** 몸 길이·높이 (가로 반지름, 세로 반지름) */
  rx: number;
  ry: number;
  tail?: 'fan' | 'fork' | 'round';
  stripes?: string;
  spots?: string;
  whiskers?: boolean;
  sparkle?: boolean;
  crest?: string;
  /** 세로 띠 무늬 색 */
  bands?: string;
  /** 비단잉어 같은 얼룩 색 */
  patches?: string;
  /** 배 색 (없으면 몸 색을 밝게) */
  belly?: string;
  /** 뾰족한 이빨 */
  teeth?: boolean;
}

const LOOKS: Record<string, Look> = {
  crucian: { rx: 19, ry: 12 },
  minnow: { rx: 21, ry: 8, stripes: '#7FA6B8' },
  killifish: { rx: 13, ry: 7 },
  carp: { rx: 21, ry: 12, whiskers: true },
  catfish: { rx: 22, ry: 10, whiskers: true, tail: 'round' },
  sweetfish: { rx: 21, ry: 8, tail: 'fork' },
  mandarinfish: { rx: 19, ry: 11, spots: '#6B4E2A' },
  trout: { rx: 21, ry: 10, stripes: '#E86A8A', spots: '#6D6A5E' },
  goldfish: { rx: 15, ry: 12, tail: 'fan' },
  golden_carp: { rx: 21, ry: 12, whiskers: true, sparkle: true },
  dragon_fish: { rx: 21, ry: 11, tail: 'fan', sparkle: true, crest: '#F2C14E' },
  smelt: { rx: 20, ry: 7, tail: 'fork' },
  bitterling: { rx: 15, ry: 10, stripes: '#7E6FA0' },
  gudgeon: { rx: 20, ry: 8, spots: '#8A7350' },
  dark_chub: { rx: 20, ry: 9, stripes: '#3F4F47' },
  chinese_minnow: { rx: 17, ry: 8 },
  aucha_perch: { rx: 18, ry: 11, bands: '#4A5540' },
  bluegill: { rx: 16, ry: 14, bands: '#4D6680' },
  bass: { rx: 21, ry: 11, stripes: '#3F5230' },
  bagrid: { rx: 20, ry: 9, whiskers: true, bands: '#7A5E2A' },
  snakehead: { rx: 22, ry: 8, spots: '#2E2D24', tail: 'round' },
  guppy: { rx: 11, ry: 7, tail: 'fan' },
  splendid_dace: { rx: 18, ry: 8, stripes: '#5B7FC4' },
  redfin_culter: { rx: 23, ry: 8, tail: 'fork' },
  lenok: { rx: 21, ry: 10, spots: '#5A3A2A' },
  masu: { rx: 20, ry: 10, spots: '#5E6F75' },
  salmon: { rx: 22, ry: 11, tail: 'fork', belly: '#F6C4B0' },
  golden_mandarin: { rx: 19, ry: 11, spots: '#B9862A' },
  paradise_fish: { rx: 14, ry: 10, tail: 'fan', bands: '#4D7FB0' },
  rose_bitterling: { rx: 14, ry: 10 },
  koi: { rx: 21, ry: 12, whiskers: true, patches: '#E2483D' },
  betta: { rx: 13, ry: 9, tail: 'fan', crest: '#6F86F0' },
  piranha: { rx: 17, ry: 14, belly: '#E2483D', teeth: true },
  arowana: { rx: 22, ry: 8, whiskers: true, tail: 'round' },
  sturgeon: { rx: 24, ry: 8, crest: '#5E6A72', tail: 'fork' },
  moon_killifish: { rx: 13, ry: 7, sparkle: true },
  sakura_trout: { rx: 21, ry: 10, spots: '#FFFFFF', sparkle: true },
  rainbow_goldfish: { rx: 15, ry: 12, tail: 'fan', stripes: '#7C6BC4', sparkle: true },
  crystal_catfish: { rx: 22, ry: 10, whiskers: true, tail: 'round', sparkle: true },
  fire_carp: { rx: 21, ry: 12, whiskers: true, crest: '#F2C14E', sparkle: true },
};

function fish(f: FishDef): string {
  const L = LOOKS[f.id] ?? { rx: 19, ry: 11 };
  const c = f.color;
  const o = shade(c, -0.4);
  const belly = L.belly ?? shade(c, 0.45);
  // 펼친 꼬리는 넓어서 몸을 왼쪽으로 조금 옮긴다. 긴 몸도 꼬리가 64칸 밖으로 나가지 않게 옮긴다
  const tailReach = L.tail === 'fan' ? 14 : L.tail === 'round' ? 12 : L.tail === 'fork' ? 11 : 9;
  const cx = Math.min(L.tail === 'fan' ? 26 : 30, 62 - L.rx - tailReach);
  const cy = 34;
  const tx = cx + L.rx - 3;
  let tail: string;
  if (L.tail === 'fan') tail = `<path d="M${tx} ${cy}c5-10 13-12 17-8-3 4-3 12 0 16-4 4-12 2-17-8Z" fill="${shade(c, 0.15)}" stroke="${o}" stroke-width="2.2" stroke-linejoin="round"/>`;
  else if (L.tail === 'fork') tail = `<path d="M${tx} ${cy}l14-11-3 11 3 11Z" fill="${c}" stroke="${o}" stroke-width="2.2" stroke-linejoin="round"/>`;
  else if (L.tail === 'round') tail = `<ellipse cx="${tx + 7}" cy="${cy}" rx="8" ry="7" fill="${c}" stroke="${o}" stroke-width="2.2"/>`;
  else tail = `<path d="M${tx} ${cy}l12-9c1 6 1 12 0 18Z" fill="${c}" stroke="${o}" stroke-width="2.2" stroke-linejoin="round"/>`;
  const fin = `<path d="M${cx - 4} ${cy - L.ry + 1}c3-6 9-7 12-5l-2 6Z" fill="${shade(c, -0.1)}" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>`;
  const body = `<ellipse cx="${cx}" cy="${cy}" rx="${L.rx}" ry="${L.ry}" fill="${c}" stroke="${o}" stroke-width="2.5"/>
<path d="M${cx - L.rx + 4} ${cy + 2}q${L.rx} ${L.ry * 0.9} ${L.rx * 1.7} 0" fill="${belly}" fill-opacity="0.75"/>`;
  const stripes = L.stripes ? `<path d="M${cx - L.rx + 6} ${cy}h${L.rx * 1.6}" stroke="${L.stripes}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>` : '';
  const spots = L.spots
    ? [[-4, -4], [4, -5], [10, -1], [-1, 3], [7, 4]].map(([dx, dy]) => `<circle cx="${cx + dx}" cy="${cy + dy}" r="1.8" fill="${L.spots}"/>`).join('')
    : '';
  // 세로 띠: 몸 테두리 안에서만 (타원 높이에 맞춘다)
  const bands = L.bands
    ? [-0.35, 0.05, 0.45]
        .map((k) => {
          const dx = k * L.rx;
          const half = L.ry * Math.sqrt(1 - (dx / L.rx) ** 2) - 2.5;
          return `<path d="M${cx + dx} ${cy - half}v${half * 2}" stroke="${L.bands}" stroke-width="3" stroke-linecap="round" opacity="0.6"/>`;
        })
        .join('')
    : '';
  const patches = L.patches
    ? `<ellipse cx="${cx - 2}" cy="${cy - L.ry * 0.45}" rx="${L.rx * 0.32}" ry="${L.ry * 0.38}" fill="${L.patches}"/><ellipse cx="${cx + L.rx * 0.48}" cy="${cy - L.ry * 0.2}" rx="${L.rx * 0.2}" ry="${L.ry * 0.32}" fill="${L.patches}"/><ellipse cx="${cx - L.rx * 0.55}" cy="${cy - L.ry * 0.5}" rx="${L.rx * 0.16}" ry="${L.ry * 0.25}" fill="${L.patches}"/>`
    : '';
  const ex = cx - L.rx + 7;
  const eye = `<circle cx="${ex}" cy="${cy - 2}" r="3.4" fill="#FFFFFF"/><circle cx="${ex - 0.6}" cy="${cy - 2}" r="2" fill="#2A2130"/><circle cx="${ex - 1.2}" cy="${cy - 2.8}" r="0.7" fill="#FFFFFF"/>`;
  const gill = `<path d="M${ex + 6} ${cy - 5}q3 5 0 10" stroke="${o}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  const whiskers = L.whiskers ? `<path d="M${cx - L.rx + 2} ${cy + 3}q-6 2-8 7M${cx - L.rx + 3} ${cy + 4}q-3 4-3 9" stroke="${o}" stroke-width="1.6" fill="none" stroke-linecap="round"/>` : '';
  const crest = L.crest
    ? `<path d="M${cx - 10} ${cy - L.ry + 2}l3-8 3 6 3-8 3 6 3-7 2 9Z" fill="${L.crest}" stroke="${shade(L.crest, -0.35)}" stroke-width="1.6" stroke-linejoin="round"/>`
    : '';
  const sparkle = L.sparkle
    ? `<path d="M50 12l1.6 3.4 3.4 1.6-3.4 1.6L50 22l-1.6-3.4-3.4-1.6 3.4-1.6Z" fill="#FFE27A"/><path d="M10 50l1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" fill="#FFE27A"/>`
    : '';
  const teeth = L.teeth
    ? `<path d="M${cx - L.rx + 1.5} ${cy + 1.5}l2 3 2-3 2 3 2-3" fill="#FFFFFF" stroke="${o}" stroke-width="1" stroke-linejoin="round"/>`
    : '';
  return `${SHADOW}${tail}${crest}${fin}${body}${patches}${bands}${stripes}${spots}${gill}${eye}${whiskers}${teeth}${sparkle}`;
}

/** 황금 고래: 통통한 몸, 꼬리지느러미, 물 뿜기, 반짝이 */
function whale(f: FishDef) {
  const c = f.color;
  const o = shade(c, -0.4);
  const belly = shade(c, 0.5);
  return `${SHADOW}<path d="M46 34c4-3 7-9 12-10 1 4-1 8-4 10 3 2 5 6 4 10-5-1-8-6-12-8Z" fill="${shade(c, 0.1)}" stroke="${o}" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M8 38c0-12 10-19 22-19 11 0 18 6 18 15 0 10-9 17-21 17C15 51 8 46 8 38Z" fill="${c}" stroke="${o}" stroke-width="2.5"/>
<path d="M11 41c6 7 23 8 33 0-3 6-10 10-20 10-6 0-11-4-13-10Z" fill="${belly}" fill-opacity="0.8"/>
<path d="M20 44l14 1M19 47l13 1" stroke="${o}" stroke-width="1.2" opacity="0.5"/>
<path d="M26 40c3 3 7 4 11 2" stroke="${o}" stroke-width="2" fill="none" stroke-linecap="round" transform="rotate(-8 31 41)"/>
<circle cx="17" cy="34" r="3" fill="#FFFFFF"/><circle cx="16.4" cy="34" r="1.8" fill="#2A2130"/><circle cx="15.8" cy="33.2" r="0.7" fill="#FFFFFF"/>
<path d="M28 19c-1-4-4-7-7-8M28 19c0-4 1-8 4-10M28 19c1-3 4-6 7-6" stroke="#8FD3F5" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<circle cx="20" cy="10" r="2" fill="#8FD3F5"/><circle cx="33" cy="8" r="2" fill="#8FD3F5"/><circle cx="36" cy="13" r="1.6" fill="#8FD3F5"/>
<path d="M52 12l1.6 3.4 3.4 1.6-3.4 1.6L52 22l-1.6-3.4-3.4-1.6 3.4-1.6Z" fill="#FFE27A"/>
<path d="M8 18l1.2 2.6 2.6 1.2-2.6 1.2L8 26l-1.2-2.6-2.6-1.2 2.6-1.2Z" fill="#FFE27A"/>
<path d="M56 46l1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" fill="#FFE27A"/>
<ellipse cx="23" cy="27" rx="5" ry="2.4" transform="rotate(-20 23 27)" ${SHINE}/>`;
}

function eel(f: FishDef) {
  const c = f.color;
  const o = shade(c, -0.4);
  return `${SHADOW}<path d="M10 30c8-10 16 6 24-2s14-8 20 2" stroke="${o}" stroke-width="13" fill="none" stroke-linecap="round"/>
<path d="M10 30c8-10 16 6 24-2s14-8 20 2" stroke="${c}" stroke-width="9" fill="none" stroke-linecap="round"/>
<path d="M14 31c6-6 12 4 20-2" stroke="${shade(c, 0.45)}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.7"/>
<circle cx="11" cy="28" r="2.6" fill="#FFFFFF"/><circle cx="10.6" cy="28" r="1.5" fill="#2A2130"/>`;
}

function boot(f: FishDef) {
  const c = f.color;
  const o = shade(c, -0.4);
  return `${SHADOW}<path d="M22 8h16v30c0 3 2 5 6 6l7 2c3 1 4 4 4 7v2H14V12c0-2 2-4 4-4Z" fill="${c}" stroke="${o}" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M14 49h41" stroke="${o}" stroke-width="3"/><rect x="18" y="8" width="20" height="5" rx="2" fill="${shade(c, -0.2)}"/>
<path d="M27 20c3 1 3 4 0 5" stroke="${shade(c, 0.4)}" stroke-width="2" fill="none" stroke-linecap="round"/>
<circle cx="47" cy="22" r="3" fill="#8FD3F5" opacity="0.8"/><circle cx="52" cy="15" r="2" fill="#8FD3F5" opacity="0.8"/>`;
}

function bottle(f: FishDef) {
  const c = f.color;
  const o = shade(c, -0.4);
  return `${SHADOW}<g transform="rotate(-25 32 34)"><path d="M27 10h10v8c6 3 9 8 9 14v18c0 3-2 5-5 5H23c-3 0-5-2-5-5V32c0-6 3-11 9-14Z" fill="${c}" fill-opacity="0.75" stroke="${o}" stroke-width="2.5" stroke-linejoin="round"/>
<rect x="26" y="6" width="12" height="6" rx="2" fill="#B98556"/>
<rect x="23" y="30" width="18" height="16" rx="2" fill="#FFF7E3" stroke="#D9C8B0" stroke-width="1.5"/>
<path d="M26 35h12M26 39h12M26 43h8" stroke="#C9A36A" stroke-width="1.5"/>
<path d="M22 24c1-3 3-5 5-6" stroke="#FFFFFF" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/></g>`;
}

export function fishIcons(): { id: string; svg: string }[] {
  const DRAW: Record<string, (f: FishDef) => string> = { eel, loach: eel, boot, bottle, golden_whale: whale };
  return FISH.map((f) => ({ id: f.id, svg: wrap((DRAW[f.id] ?? fish)(f)) }));
}
