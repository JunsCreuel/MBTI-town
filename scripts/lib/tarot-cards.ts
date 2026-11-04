// 타로 카드 그림 (자체 제작): 메이저 아르카나 22장 앞면과 뒷면 하나. 글자는 넣지 않는다 (이름·번호는 화면이 쓴다).
// 120×180 SVG. 크림색 테두리 안에 낮(따뜻한 색)·밤(남색) 배경과 카드를 상징하는 단순한 그림.
import { TAROT_DECK } from '../../src/shared/tarot';

const W = 120;
const H = 180;
const C = {
  cream: '#FFF6E3',
  navy: '#2E2A5A',
  navyDeep: '#1B1D3A',
  gold: '#E8B84A',
  goldDark: '#B9822E',
  white: '#FFFFFF',
  red: '#D9534F',
  green: '#5BA86B',
  greenDark: '#3F7D4E',
  sky: '#9ED3F0',
  skyDeep: '#5FA8D8',
  purple: '#7C6BC4',
  pink: '#F2A0B5',
  brown: '#8A5A3B',
  grey: '#A7A6B8',
  orange: '#E89A3C',
  skin: '#F6D7B8',
};

const n = (v: number) => Math.round(v * 10) / 10;

/** 꼭짓점 k개짜리 별 */
function star(cx: number, cy: number, r: number, fill: string, k = 5, inner = 0.45): string {
  const pts: string[] = [];
  for (let i = 0; i < k * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / k;
    const rr = i % 2 ? r * inner : r;
    pts.push(`${n(cx + Math.cos(a) * rr)},${n(cy + Math.sin(a) * rr)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
}

/** 해: 원과 빛살 */
function sun(cx: number, cy: number, r: number, rays = 12): string {
  let s = '';
  for (let i = 0; i < rays; i++) {
    const a = (i * 2 * Math.PI) / rays;
    s += `<line x1="${n(cx + Math.cos(a) * (r + 3))}" y1="${n(cy + Math.sin(a) * (r + 3))}" x2="${n(cx + Math.cos(a) * (r + 9))}" y2="${n(cy + Math.sin(a) * (r + 9))}" stroke="${C.gold}" stroke-width="3" stroke-linecap="round"/>`;
  }
  return `${s}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.gold}" stroke="${C.goldDark}" stroke-width="1.5"/>`;
}

/** 초승달 (오른쪽이 밝다) */
const crescent = (cx: number, cy: number, r: number, fill: string, bg: string) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/><circle cx="${n(cx - r * 0.45)}" cy="${n(cy - r * 0.15)}" r="${n(r * 0.85)}" fill="${bg}"/>`;

/** 무한대 기호 */
const lemniscate = (cx: number, cy: number, w: number, color: string) => {
  const h = w * 0.28;
  return `<path d="M${cx} ${cy} C${n(cx - w * 0.15)} ${n(cy - h)}, ${n(cx - w / 2)} ${n(cy - h)}, ${n(cx - w / 2)} ${cy} C${n(cx - w / 2)} ${n(cy + h)}, ${n(cx - w * 0.15)} ${n(cy + h)}, ${cx} ${cy} C${n(cx + w * 0.15)} ${n(cy - h)}, ${n(cx + w / 2)} ${n(cy - h)}, ${n(cx + w / 2)} ${cy} C${n(cx + w / 2)} ${n(cy + h)}, ${n(cx + w * 0.15)} ${n(cy + h)}, ${cx} ${cy} Z" fill="none" stroke="${color}" stroke-width="3"/>`;
};

/** 꽃 한 송이 (꽃잎 다섯) */
function flower(cx: number, cy: number, r: number, petal: string, middle: string): string {
  let s = '';
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    s += `<circle cx="${n(cx + Math.cos(a) * r)}" cy="${n(cy + Math.sin(a) * r)}" r="${n(r * 0.75)}" fill="${petal}"/>`;
  }
  return `${s}<circle cx="${cx}" cy="${cy}" r="${n(r * 0.6)}" fill="${middle}"/>`;
}

/** 사람 (머리와 몸) */
const person = (cx: number, top: number, body: string) =>
  `<circle cx="${cx}" cy="${top + 8}" r="8" fill="${C.skin}"/><rect x="${cx - 9}" y="${top + 17}" width="18" height="26" rx="8" fill="${body}"/>`;

/** 물결 */
const waves = (y: number, color: string) =>
  `<path d="M10 ${y} q10 -6 20 0 t20 0 t20 0 t20 0 t20 0 V170 H10 Z" fill="${color}"/>`;

/** 탑 (창문 둘) */
const tower = (x: number, y: number, w: number, h: number, body: string, win: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${body}"/><rect x="${x + w / 2 - 3}" y="${y + 12}" width="6" height="9" rx="3" fill="${win}"/><rect x="${x + w / 2 - 3}" y="${y + 30}" width="6" height="9" rx="3" fill="${win}"/>`;

type Art = { bg: string; draw: (bg: string) => string };

const DAY = '#FCEBCB';
const SKY = '#DDEFF9';
const NIGHT = '#2E3366';

const ART: Record<string, Art> = {
  fool: {
    bg: SKY,
    draw: () =>
      `${sun(86, 40, 11, 10)}<path d="M10 128 L70 128 L84 170 L10 170 Z" fill="${C.green}"/><path d="M10 128 L70 128 L72 134 L10 134 Z" fill="${C.greenDark}"/>` +
      `<line x1="44" y1="124" x2="72" y2="86" stroke="${C.brown}" stroke-width="3" stroke-linecap="round"/><circle cx="75" cy="83" r="9" fill="${C.red}"/>` +
      `${flower(34, 104, 5, C.white, C.gold)}${person(48, 82, C.purple)}`,
  },
  magician: {
    bg: DAY,
    draw: () =>
      `${lemniscate(60, 38, 34, C.goldDark)}<rect x="56" y="52" width="8" height="66" rx="3" fill="${C.white}" stroke="${C.goldDark}" stroke-width="1.5"/><circle cx="60" cy="52" r="5" fill="${C.gold}"/>` +
      `<rect x="20" y="126" width="80" height="10" rx="2" fill="${C.brown}"/><path d="M26 112 h16 l-3 14 h-10 Z" fill="${C.gold}"/><circle cx="88" cy="118" r="8" fill="${C.gold}" stroke="${C.goldDark}" stroke-width="1.5"/>` +
      `<path d="M30 150 l6 -6 l6 6 l-6 6 Z" fill="${C.red}"/><path d="M78 150 l6 -6 l6 6 l-6 6 Z" fill="${C.green}"/>`,
  },
  high_priestess: {
    bg: NIGHT,
    draw: (bg) =>
      `<rect x="18" y="34" width="16" height="114" fill="${C.navyDeep}"/><rect x="16" y="30" width="20" height="6" fill="${C.grey}"/>` +
      `<rect x="86" y="34" width="16" height="114" fill="${C.cream}"/><rect x="84" y="30" width="20" height="6" fill="${C.grey}"/>` +
      `${crescent(60, 66, 18, C.gold, bg)}${star(60, 108, 7, C.white)}${waves(148, C.skyDeep)}`,
  },
  empress: {
    bg: '#F7E3D6',
    draw: () => {
      let s = '';
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i * Math.PI) / 8;
        s += star(n(60 + Math.cos(a) * 26), n(52 + Math.sin(a) * 18), 4, C.gold);
      }
      s += `<circle cx="60" cy="80" r="16" fill="none" stroke="${C.pink}" stroke-width="6"/><line x1="60" y1="96" x2="60" y2="124" stroke="${C.pink}" stroke-width="6"/><line x1="48" y1="112" x2="72" y2="112" stroke="${C.pink}" stroke-width="6"/>`;
      for (const x of [24, 96]) {
        s += `<line x1="${x}" y1="160" x2="${x}" y2="100" stroke="${C.goldDark}" stroke-width="2"/>`;
        for (let k = 0; k < 4; k++) s += `<ellipse cx="${x}" cy="${104 + k * 10}" rx="4" ry="6" fill="${C.gold}"/>`;
      }
      return s;
    },
  },
  emperor: {
    bg: '#F6DCC6',
    draw: () =>
      `<rect x="30" y="66" width="60" height="80" rx="4" fill="${C.red}"/><rect x="38" y="78" width="44" height="60" rx="3" fill="${C.brown}"/>` +
      `<circle cx="32" cy="64" r="9" fill="none" stroke="${C.grey}" stroke-width="4"/><circle cx="88" cy="64" r="9" fill="none" stroke="${C.grey}" stroke-width="4"/>` +
      `<circle cx="60" cy="46" r="11" fill="${C.gold}" stroke="${C.goldDark}" stroke-width="1.5"/><line x1="60" y1="28" x2="60" y2="38" stroke="${C.goldDark}" stroke-width="3"/><line x1="55" y1="32" x2="65" y2="32" stroke="${C.goldDark}" stroke-width="3"/>` +
      `<rect x="22" y="150" width="76" height="8" fill="${C.grey}"/>`,
  },
  hierophant: {
    bg: '#F3E6D3',
    draw: () => {
      const key = (rot: number, color: string) =>
        `<g transform="rotate(${rot} 60 96)"><circle cx="60" cy="58" r="10" fill="none" stroke="${color}" stroke-width="5"/><rect x="57" y="66" width="6" height="66" fill="${color}"/><rect x="63" y="116" width="10" height="5" fill="${color}"/><rect x="63" y="125" width="8" height="5" fill="${color}"/></g>`;
      return `${key(-28, C.gold)}${key(28, C.grey)}<path d="M44 40 Q60 18 76 40 Z" fill="${C.red}"/><rect x="44" y="40" width="32" height="5" fill="${C.gold}"/>`;
    },
  },
  lovers: {
    bg: '#FCE3EA',
    draw: () =>
      `${sun(60, 38, 10, 12)}<path d="M60 96 C40 80 44 62 56 66 C59 67 60 70 60 72 C60 70 61 67 64 66 C76 62 80 80 60 96 Z" fill="${C.red}"/>` +
      `${person(34, 104, C.sky)}${person(86, 104, C.pink)}<rect x="10" y="152" width="100" height="18" fill="${C.green}"/>`,
  },
  chariot: {
    bg: SKY,
    draw: () =>
      `<rect x="30" y="44" width="60" height="10" rx="2" fill="${C.navy}"/>${star(44, 49, 3, C.gold)}${star(60, 49, 3, C.gold)}${star(76, 49, 3, C.gold)}` +
      `<line x1="34" y1="54" x2="34" y2="74" stroke="${C.navy}" stroke-width="3"/><line x1="86" y1="54" x2="86" y2="74" stroke="${C.navy}" stroke-width="3"/>` +
      `<rect x="30" y="74" width="60" height="40" rx="4" fill="${C.skyDeep}"/>${star(60, 94, 11, C.gold)}` +
      `<circle cx="38" cy="122" r="12" fill="${C.cream}" stroke="${C.brown}" stroke-width="4"/><circle cx="82" cy="122" r="12" fill="${C.cream}" stroke="${C.brown}" stroke-width="4"/>` +
      `<circle cx="28" cy="152" r="9" fill="${C.navyDeep}"/><circle cx="92" cy="152" r="9" fill="${C.white}" stroke="${C.grey}" stroke-width="1.5"/>`,
  },
  strength: {
    bg: DAY,
    draw: () => {
      let mane = '';
      for (let i = 0; i < 14; i++) {
        const a = (i * 2 * Math.PI) / 14;
        mane += `<circle cx="${n(60 + Math.cos(a) * 26)}" cy="${n(100 + Math.sin(a) * 26)}" r="9" fill="${C.orange}"/>`;
      }
      return (
        `${lemniscate(60, 40, 30, C.goldDark)}${mane}<circle cx="60" cy="100" r="24" fill="${C.orange}"/><circle cx="60" cy="102" r="18" fill="${C.gold}"/>` +
        `<circle cx="53" cy="98" r="2.5" fill="${C.navy}"/><circle cx="67" cy="98" r="2.5" fill="${C.navy}"/><path d="M56 106 h8 l-4 5 Z" fill="${C.brown}"/>` +
        `${flower(40, 144, 4, C.pink, C.gold)}${flower(80, 146, 4, C.white, C.gold)}`
      );
    },
  },
  hermit: {
    bg: NIGHT,
    draw: () =>
      `<path d="M10 170 L44 120 L62 140 L84 110 L110 150 L110 170 Z" fill="${C.cream}"/>` +
      `<line x1="76" y1="40" x2="76" y2="160" stroke="${C.brown}" stroke-width="4" stroke-linecap="round"/>` +
      `<line x1="48" y1="54" x2="48" y2="64" stroke="${C.gold}" stroke-width="2"/><rect x="36" y="64" width="24" height="30" rx="4" fill="${C.gold}" stroke="${C.goldDark}" stroke-width="2"/>${star(48, 79, 8, C.white, 6)}` +
      `${star(24, 30, 2.5, C.white)}${star(96, 26, 2.5, C.white)}${star(100, 70, 2, C.white)}`,
  },
  wheel: {
    bg: DAY,
    draw: () => {
      let s = `<circle cx="60" cy="90" r="36" fill="${C.cream}" stroke="${C.goldDark}" stroke-width="5"/><circle cx="60" cy="90" r="26" fill="none" stroke="${C.gold}" stroke-width="2"/>`;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        s += `<line x1="60" y1="90" x2="${n(60 + Math.cos(a) * 34)}" y2="${n(90 + Math.sin(a) * 34)}" stroke="${C.goldDark}" stroke-width="2.5"/><circle cx="${n(60 + Math.cos(a) * 36)}" cy="${n(90 + Math.sin(a) * 36)}" r="4" fill="${C.gold}"/>`;
      }
      return `${s}<circle cx="60" cy="90" r="9" fill="${C.purple}"/>${star(20, 24, 4, C.gold)}${star(100, 24, 4, C.gold)}${star(20, 156, 4, C.gold)}${star(100, 156, 4, C.gold)}`;
    },
  },
  justice: {
    bg: '#F3E0D2',
    draw: () =>
      `<line x1="60" y1="36" x2="60" y2="138" stroke="${C.goldDark}" stroke-width="4"/><path d="M44 146 h32 l-6 -10 h-20 Z" fill="${C.goldDark}"/>` +
      `<line x1="26" y1="52" x2="94" y2="52" stroke="${C.goldDark}" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="36" r="5" fill="${C.gold}"/>` +
      `<line x1="28" y1="52" x2="18" y2="90" stroke="${C.goldDark}" stroke-width="1.5"/><line x1="28" y1="52" x2="38" y2="90" stroke="${C.goldDark}" stroke-width="1.5"/>` +
      `<line x1="92" y1="52" x2="82" y2="90" stroke="${C.goldDark}" stroke-width="1.5"/><line x1="92" y1="52" x2="102" y2="90" stroke="${C.goldDark}" stroke-width="1.5"/>` +
      `<path d="M14 90 h28 a14 9 0 0 1 -28 0 Z" fill="${C.gold}"/><path d="M78 90 h28 a14 9 0 0 1 -28 0 Z" fill="${C.gold}"/>` +
      `<rect x="10" y="152" width="100" height="18" fill="${C.red}" opacity="0.5"/>`,
  },
  hanged_man: {
    bg: '#E6F1E4',
    draw: () =>
      `<rect x="22" y="28" width="76" height="9" rx="3" fill="${C.brown}"/><rect x="24" y="28" width="8" height="140" fill="${C.brown}"/><rect x="88" y="28" width="8" height="140" fill="${C.brown}"/>` +
      `<line x1="60" y1="37" x2="60" y2="54" stroke="${C.brown}" stroke-width="2"/><rect x="51" y="54" width="18" height="40" rx="8" fill="${C.skyDeep}"/>` +
      `<circle cx="60" cy="108" r="16" fill="none" stroke="${C.gold}" stroke-width="3"/><circle cx="60" cy="108" r="9" fill="${C.skin}"/>` +
      `<rect x="10" y="150" width="100" height="20" fill="${C.green}"/>`,
  },
  death: {
    bg: '#F2D4C4',
    draw: () =>
      `<path d="M10 128 h100 v42 h-100 Z" fill="${C.skyDeep}"/><path d="M38 128 a22 22 0 0 1 44 0 Z" fill="${C.gold}"/>` +
      `${tower(14, 84, 18, 44, C.grey, C.gold)}${tower(88, 84, 18, 44, C.grey, C.gold)}` +
      `<path d="M10 140 q12 -4 25 0 t25 0 t25 0 t25 0" fill="none" stroke="${C.white}" stroke-width="2" opacity="0.7"/>` +
      `${flower(60, 60, 10, C.white, C.gold)}<line x1="60" y1="74" x2="60" y2="96" stroke="${C.greenDark}" stroke-width="3"/>`,
  },
  temperance: {
    bg: SKY,
    draw: () =>
      `<path d="M28 58 h22 l-4 22 h-14 Z" fill="${C.gold}" stroke="${C.goldDark}" stroke-width="1.5"/><path d="M70 98 h22 l-4 22 h-14 Z" fill="${C.gold}" stroke="${C.goldDark}" stroke-width="1.5"/>` +
      `<path d="M46 62 C70 58 80 76 80 98" fill="none" stroke="${C.skyDeep}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M20 40 l10 -12 l10 12 Z" fill="${C.gold}"/>${sun(92, 36, 7, 8)}<ellipse cx="60" cy="152" rx="44" ry="10" fill="${C.skyDeep}"/>` +
      `${flower(28, 140, 4, C.gold, C.orange)}`,
  },
  devil: {
    bg: '#3A2238',
    draw: () =>
      `<path d="M40 60 C30 44 32 30 40 22 C42 36 48 46 54 54 Z" fill="${C.red}"/><path d="M80 60 C90 44 88 30 80 22 C78 36 72 46 66 54 Z" fill="${C.red}"/>` +
      `<circle cx="60" cy="76" r="22" fill="#5A2F4E"/><circle cx="52" cy="74" r="4" fill="${C.gold}"/><circle cx="68" cy="74" r="4" fill="${C.gold}"/>` +
      `<path d="M50 88 q10 6 20 0" fill="none" stroke="${C.gold}" stroke-width="2"/>` +
      `<ellipse cx="44" cy="124" rx="8" ry="5" fill="none" stroke="${C.grey}" stroke-width="3"/><ellipse cx="56" cy="128" rx="8" ry="5" fill="none" stroke="${C.grey}" stroke-width="3"/>` +
      `<ellipse cx="68" cy="124" rx="8" ry="5" fill="none" stroke="${C.grey}" stroke-width="3"/><ellipse cx="80" cy="128" rx="8" ry="5" fill="none" stroke="${C.grey}" stroke-width="3"/>` +
      `<rect x="10" y="146" width="100" height="24" fill="#2A1828"/>`,
  },
  tower: {
    bg: '#262A4F',
    draw: () =>
      `<path d="M10 170 L10 150 Q60 136 110 150 L110 170 Z" fill="${C.grey}" opacity="0.6"/>${tower(44, 66, 32, 84, C.grey, C.orange)}` +
      `<rect x="40" y="58" width="40" height="10" fill="${C.grey}"/><g transform="rotate(-24 60 44)"><path d="M46 50 l4 -12 l5 8 l5 -10 l5 10 l5 -8 l4 12 Z" fill="${C.gold}"/></g>` +
      `<path d="M96 14 L76 50 L86 50 L70 80 L98 40 L86 40 L102 14 Z" fill="${C.gold}"/>` +
      `<path d="M40 100 l-6 -8 l2 10 Z" fill="${C.orange}"/><path d="M82 112 l7 -8 l-2 10 Z" fill="${C.orange}"/>` +
      `<circle cx="28" cy="96" r="2" fill="${C.gold}"/><circle cx="94" cy="88" r="2" fill="${C.gold}"/><circle cx="24" cy="120" r="2" fill="${C.gold}"/>`,
  },
  star: {
    bg: '#253061',
    draw: () =>
      `${star(60, 52, 22, C.gold, 8, 0.5)}${star(26, 30, 5, C.white, 8, 0.5)}${star(94, 30, 5, C.white, 8, 0.5)}${star(20, 70, 4, C.white, 8, 0.5)}` +
      `${star(100, 70, 4, C.white, 8, 0.5)}${star(34, 96, 4, C.white, 8, 0.5)}${star(86, 96, 4, C.white, 8, 0.5)}${star(60, 92, 3.5, C.white, 8, 0.5)}` +
      `<ellipse cx="60" cy="150" rx="46" ry="14" fill="${C.skyDeep}"/><path d="M40 112 C38 126 44 136 50 146" fill="none" stroke="${C.sky}" stroke-width="3"/>` +
      `<path d="M80 112 C82 126 76 136 70 146" fill="none" stroke="${C.sky}" stroke-width="3"/><circle cx="40" cy="110" r="5" fill="${C.gold}"/><circle cx="80" cy="110" r="5" fill="${C.gold}"/>`,
  },
  moon: {
    bg: '#2A2F5E',
    draw: (bg) =>
      `<circle cx="60" cy="50" r="24" fill="${C.cream}" opacity="0.35"/>${crescent(60, 50, 20, C.gold, bg)}` +
      `<path d="M38 82 q2 -6 4 0 a2 2 0 0 1 -4 0 Z" fill="${C.gold}"/><path d="M58 86 q2 -6 4 0 a2 2 0 0 1 -4 0 Z" fill="${C.gold}"/><path d="M78 82 q2 -6 4 0 a2 2 0 0 1 -4 0 Z" fill="${C.gold}"/>` +
      `${tower(14, 96, 18, 50, C.grey, C.gold)}${tower(88, 96, 18, 50, C.grey, C.gold)}` +
      `<path d="M60 170 C40 156 76 140 58 120" fill="none" stroke="${C.cream}" stroke-width="5" opacity="0.6"/>${waves(156, C.skyDeep)}`,
  },
  sun: {
    bg: '#FFE7A8',
    draw: () =>
      `${sun(60, 64, 26, 16)}<circle cx="52" cy="60" r="3" fill="${C.goldDark}"/><circle cx="68" cy="60" r="3" fill="${C.goldDark}"/><path d="M50 72 q10 8 20 0" fill="none" stroke="${C.goldDark}" stroke-width="2.5"/>` +
      `<rect x="10" y="130" width="100" height="10" fill="${C.grey}"/>` +
      `${flower(28, 124, 6, C.gold, C.brown)}${flower(60, 122, 7, C.gold, C.brown)}${flower(92, 124, 6, C.gold, C.brown)}<rect x="10" y="140" width="100" height="30" fill="${C.green}"/>`,
  },
  judgement: {
    bg: '#E1ECF8',
    draw: () =>
      `<ellipse cx="34" cy="34" rx="22" ry="10" fill="${C.white}"/><ellipse cx="80" cy="30" rx="26" ry="11" fill="${C.white}"/>` +
      `<path d="M30 46 L78 70 L82 62 Z" fill="${C.gold}"/><path d="M78 70 L96 84 L92 54 Z" fill="${C.gold}" stroke="${C.goldDark}" stroke-width="1.5"/>` +
      `<line x1="98" y1="64" x2="106" y2="58" stroke="${C.gold}" stroke-width="2"/><line x1="99" y1="72" x2="108" y2="72" stroke="${C.gold}" stroke-width="2"/><line x1="98" y1="80" x2="106" y2="86" stroke="${C.gold}" stroke-width="2"/>` +
      `${person(32, 110, C.grey)}${person(60, 104, C.sky)}${person(88, 110, C.grey)}` +
      `<line x1="52" y1="114" x2="46" y2="102" stroke="${C.skin}" stroke-width="3" stroke-linecap="round"/><line x1="68" y1="114" x2="74" y2="102" stroke="${C.skin}" stroke-width="3" stroke-linecap="round"/>` +
      `<rect x="10" y="150" width="100" height="20" fill="${C.skyDeep}"/>`,
  },
  world: {
    bg: '#E6F3E8',
    draw: () =>
      `<ellipse cx="60" cy="90" rx="32" ry="46" fill="none" stroke="${C.green}" stroke-width="8"/><ellipse cx="60" cy="90" rx="32" ry="46" fill="none" stroke="${C.greenDark}" stroke-width="2" stroke-dasharray="4 5"/>` +
      `<path d="M52 40 l8 6 l8 -6 l-8 8 Z" fill="${C.red}"/><path d="M52 140 l8 -6 l8 6 l-8 -8 Z" fill="${C.red}"/>` +
      `${star(60, 90, 12, C.gold, 5)}<circle cx="22" cy="26" r="7" fill="${C.gold}"/><circle cx="98" cy="26" r="7" fill="${C.gold}"/><circle cx="22" cy="154" r="7" fill="${C.gold}"/><circle cx="98" cy="154" r="7" fill="${C.gold}"/>`,
  },
};

const wrap = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>\n`;

function face(art: Art): string {
  return wrap(
    `<rect x="2" y="2" width="116" height="176" rx="10" fill="${C.cream}" stroke="${C.navy}" stroke-width="4"/>` +
      `<rect x="10" y="10" width="100" height="160" rx="6" fill="${art.bg}"/>` +
      `<svg x="10" y="10" width="100" height="160" viewBox="10 10 100 160" overflow="hidden">${art.draw(art.bg)}</svg>` +
      `<rect x="10" y="10" width="100" height="160" rx="6" fill="none" stroke="${C.gold}" stroke-width="2"/>`,
  );
}

function back(): string {
  let lattice = '';
  for (let k = -180; k <= 180; k += 16) {
    lattice += `<line x1="${10 + k}" y1="10" x2="${10 + k + 160}" y2="170" stroke="${C.gold}" stroke-width="1" opacity="0.22"/>`;
    lattice += `<line x1="${110 - k}" y1="10" x2="${110 - k - 160}" y2="170" stroke="${C.gold}" stroke-width="1" opacity="0.22"/>`;
  }
  return wrap(
    `<rect x="2" y="2" width="116" height="176" rx="10" fill="${C.navy}" stroke="${C.goldDark}" stroke-width="4"/>` +
      `<svg x="10" y="10" width="100" height="160" viewBox="10 10 100 160" overflow="hidden">${lattice}</svg>` +
      `<rect x="10" y="10" width="100" height="160" rx="6" fill="none" stroke="${C.gold}" stroke-width="2"/>` +
      `<circle cx="60" cy="90" r="30" fill="${C.navyDeep}" stroke="${C.gold}" stroke-width="2"/>${sun(60, 90, 12, 12)}${crescent(60, 90, 9, C.cream, C.gold)}` +
      `${star(60, 36, 5, C.gold)}${star(60, 144, 5, C.gold)}${star(24, 90, 4, C.gold)}${star(96, 90, 4, C.gold)}`,
  );
}

/** 카드 그림: id = 카드 키(fool…world)와 back */
export function tarotCards(): { id: string; svg: string }[] {
  const missing = TAROT_DECK.filter((c) => !ART[c.key]);
  if (missing.length) throw new Error(`타로 그림이 없는 카드: ${missing.map((c) => c.key).join(', ')}`);
  return [...TAROT_DECK.map((c) => ({ id: c.key, svg: face(ART[c.key]) })), { id: 'back', svg: back() }];
}
