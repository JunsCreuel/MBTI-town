// 16개 유형 메타데이터. 유형 색은 소속 기질 그룹 색에서 명도만 바꿔 만든다.
import { tokens, type ColorToken } from './tokens';

export const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
] as const;

export type MbtiType = (typeof MBTI_TYPES)[number];
export type MbtiGroup = 'NT' | 'NF' | 'SJ' | 'SP';

export interface MbtiGroupMeta {
  id: MbtiGroup;
  name: string;
  colorToken: ColorToken;
}

export const MBTI_GROUPS: readonly MbtiGroupMeta[] = [
  { id: 'NT', name: '분석가', colorToken: 'groupNT' },
  { id: 'NF', name: '외교관', colorToken: 'groupNF' },
  { id: 'SJ', name: '관리자', colorToken: 'groupSJ' },
  { id: 'SP', name: '탐험가', colorToken: 'groupSP' },
];

export interface MbtiMeta {
  code: MbtiType;
  name: string;
  /** 네 글자를 풀어 쓴 설명 */
  label: string;
  group: MbtiGroup;
  /** 그룹 색 토큰 키 */
  colorToken: ColorToken;
  /** 그룹 색 대비 명도 변화 (HSL L, -1~1) */
  lightness: number;
}

// 같은 그룹 안 네 유형의 명도 차이. 순서는 MBTI_TYPES 안의 그룹별 순서를 따른다.
const LIGHTNESS_STEPS = [-0.12, -0.04, 0.04, 0.11];

const AXIS_LABEL: Record<string, string> = {
  E: '외향', I: '내향', S: '감각', N: '직관', T: '사고', F: '감정', J: '판단', P: '인식',
};

export function groupOf(code: MbtiType): MbtiGroup {
  if (code[1] === 'N') return code[2] === 'T' ? 'NT' : 'NF';
  return code[3] === 'J' ? 'SJ' : 'SP';
}

export function isMbtiType(v: unknown): v is MbtiType {
  return typeof v === 'string' && (MBTI_TYPES as readonly string[]).includes(v);
}

export const MBTI: Record<MbtiType, MbtiMeta> = Object.fromEntries(
  MBTI_TYPES.map((code) => {
    const group = groupOf(code);
    const groupMeta = MBTI_GROUPS.find((g) => g.id === group)!;
    const indexInGroup = MBTI_TYPES.filter((t) => groupOf(t) === group).indexOf(code);
    const meta: MbtiMeta = {
      code,
      name: code,
      label: code.split('').map((c) => AXIS_LABEL[c]).join('·'),
      group,
      colorToken: groupMeta.colorToken,
      lightness: LIGHTNESS_STEPS[indexInGroup],
    };
    return [code, meta];
  }),
) as Record<MbtiType, MbtiMeta>;

/** 유형 색 (hex). 그룹 토큰 색의 명도만 바꾼다. */
export function mbtiColor(code: MbtiType): string {
  const meta = MBTI[code];
  return shiftLightness(tokens.color[meta.colorToken], meta.lightness);
}

export function shiftLightness(hex: string, delta: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.min(0.95, Math.max(0.05, l + delta)));
}

/** 글자로 쓰기에 너무 밝은 색은 명도를 max까지 낮춘다 (흰 바탕 대비) */
export function withMaxLightness(hex: string, max: number): string {
  const [h, sat, l] = hexToHsl(hex);
  return l > max ? hslToHex(h, sat, max) : hex.toUpperCase();
}

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r = l, g = l, b = l;
  if (s !== 0) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue(p, q, h + 1 / 3);
    g = hue(p, q, h);
    b = hue(p, q, h - 1 / 3);
  }
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}
