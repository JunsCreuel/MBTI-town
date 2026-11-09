// 그래픽 품질 (가벼운 모드). 휴대폰·느린 기기에서 버벅이지 않게 그림자·해상도·안티에일리어싱·보이는 사람 수를 줄인다.
// MY → 그래픽에서 자동 / 가볍게 / 선명하게를 고른다 (이 기기에만 저장, 바꾸면 다시 불러온다).

export type GraphicsPref = 'auto' | 'low' | 'high';
export const GRAPHICS_PREFS: readonly GraphicsPref[] = ['auto', 'low', 'high'];

const KEY = 'mt_graphics';

export function graphicsPref(): GraphicsPref {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'low' || v === 'high' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function setGraphicsPref(p: GraphicsPref): void {
  try {
    if (p === 'auto') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, p);
  } catch {}
}

export interface DeviceHints {
  /** 손가락으로 쓰는 화면 (pointer: coarse) */
  touch: boolean;
  /** 화면 짧은 변 (CSS px) */
  shortSide: number;
  /** 기기 메모리 (GB, 모르면 undefined) */
  memory?: number;
  /** CPU 코어 수 (모르면 undefined) */
  cores?: number;
}

/** 자동일 때 가벼운 모드를 쓸지: 휴대폰·태블릿, 메모리 4GB 이하, 코어 4개 이하 */
export function autoLow(h: DeviceHints): boolean {
  if (h.touch && h.shortSide < 900) return true;
  if (h.memory !== undefined && h.memory <= 4) return true;
  if (h.cores !== undefined && h.cores <= 4) return true;
  return false;
}

export function resolveLow(pref: GraphicsPref, h: DeviceHints): boolean {
  return pref === 'low' ? true : pref === 'high' ? false : autoLow(h);
}

let cached: boolean | null = null;

/** 이 기기에서 가벼운 모드를 쓰는지 (한 번 정하면 다시 불러올 때까지 그대로) */
export function lowQuality(): boolean {
  if (cached !== null) return cached;
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  cached = resolveLow(graphicsPref(), {
    touch: !!window.matchMedia?.('(pointer: coarse)').matches,
    shortSide: Math.min(window.innerWidth, window.innerHeight),
    memory: nav.deviceMemory,
    cores: navigator.hardwareConcurrency || undefined,
  });
  return cached;
}

export interface QualitySettings {
  /** 해상도 배율 [최소, 최대] */
  dpr: [number, number];
  antialias: boolean;
  shadowMapSize: number;
  /** 그림자 지도를 몇 장면마다 다시 그릴지 (1 = 매 장면) */
  shadowEvery: number;
  /** 풀·꽃 같은 작은 장식도 그림자를 드리울지 */
  decorShadows: boolean;
  /** 마을에서 한 번에 그리는 다른 사람 수 */
  maxPlayers: number;
  /** 이 거리(칸)보다 먼 캐릭터는 동작을 가끔만 계산하고 그림자를 끈다 */
  farDistance: number;
}

export const QUALITY: Record<'low' | 'high', QualitySettings> = {
  low: { dpr: [1, 1], antialias: false, shadowMapSize: 1024, shadowEvery: 3, decorShadows: false, maxPlayers: 15, farDistance: 14 },
  high: { dpr: [1, 1.5], antialias: true, shadowMapSize: 2048, shadowEvery: 1, decorShadows: true, maxPlayers: 40, farDistance: 30 },
};

export function quality(): QualitySettings {
  return lowQuality() ? QUALITY.low : QUALITY.high;
}
