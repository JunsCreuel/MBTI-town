// 클럽 바에서 마신 술: 두 잔까지는 멀쩡하고, 세 잔부터 한 잔마다 조금씩 더 취한다.
// 시간이 지나면 한 잔씩 깬다 (townConfig.soberMsPerDrink). 이 기기에만 기억한다 (다른 사람에게는 보이지 않는다).
// 화면 흔들림·걸음 비틀거림·흐려짐·딸꾹질의 세기를 level(0~1)로 준다.
import { townConfig } from '@/config/game';

export interface Drink {
  id: string;
  name: string;
  /** 한 잔에 늘어나는 잔 수 (물은 -1: 조금 깬다) */
  units: number;
  line: string;
}

export const DRINKS: readonly Drink[] = [
  { id: 'beer', name: '생맥주', units: 1, line: '시원한 생맥주 나왔어요!' },
  { id: 'highball', name: '하이볼', units: 1, line: '레몬 띄운 하이볼이에요.' },
  { id: 'cocktail', name: '네온 칵테일', units: 1, line: '오늘 밤 특제, 반짝이는 칵테일!' },
  { id: 'soju', name: '소주', units: 1, line: '짠! 천천히 드세요.' },
  { id: 'water', name: '물', units: -1, line: '물 한 잔이면 조금 깰 거예요.' },
];

const KEY = 'scene:drinks';
const state = { drinks: 0, at: 0 };
let loaded = false;

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { drinks?: number; at?: number } | null;
    if (v && typeof v.drinks === 'number' && typeof v.at === 'number') Object.assign(state, v);
  } catch {
    // 기억이 안 나도 처음부터
  }
}

/** 지금 몇 잔 마신 상태인지 (시간이 지난 만큼 깬 뒤, 소수) */
export function drinksNow(now = Date.now()): number {
  load();
  return Math.max(0, state.drinks - (now - state.at) / townConfig.soberMsPerDrink);
}

/** 한 잔 마신다. 돌려주는 값 = 마신 뒤 잔 수 (반올림) */
export function drink(d: Drink, now = Date.now()): number {
  const next = Math.min(townConfig.maxDrinks, Math.max(0, drinksNow(now) + d.units));
  Object.assign(state, { drinks: next, at: now });
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 저장이 안 되면 이번에만
  }
  return Math.round(next);
}

/** 취한 정도 0~1: 두 잔까지 0, 세 잔부터 한 잔마다 커지고 여섯 잔쯤에서 가장 세다 */
export function drunkLevel(now = Date.now()): number {
  const over = drinksNow(now) - townConfig.drinksBeforeTipsy;
  return Math.max(0, Math.min(1, over / 4));
}

/** 바텐더가 하는 말 (마신 잔 수에 따라) */
export function bartenderLine(drinks: number): string {
  if (drinks <= 0) return '어서 오세요! 뭐로 드릴까요?';
  if (drinks <= 2) return '좋은 밤이에요. 한 잔 더?';
  if (drinks === 3) return '얼굴이 살짝 빨개졌어요.';
  if (drinks === 4) return '천천히 드세요~ 음악이 빙글빙글 돌죠?';
  if (drinks === 5) return '오늘은 많이 드셨네요. 물 한 잔 어때요?';
  return '오늘은 여기까지! 물 마시고 조금 쉬어요.';
}

let reduced: boolean | null = null;
/** 움직임 줄이기 설정이면 화면 흔들림은 뺀다 (걸음 비틀거림·흐려짐은 남긴다) */
export function swayAllowed(): boolean {
  if (reduced === null) reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return !reduced;
}

