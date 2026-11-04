// 오행 채우기: 내 사주에 모자란 오행을 그 오행의 놀이로 하루에 채운다 (목 = 열매, 화 = 클럽, 토 = 상가·방 꾸미기, 금 = 토론, 수 = 낚시).
// 서버(기록)와 화면(게이지)이 같은 계산을 쓴다. 규칙 값은 src/config/game.ts의 elementConfig.
import { elementConfig } from '../config/game';
import { DISTRICTS, type District } from './districts';

export type Element = District;
export const ELEMENTS: readonly Element[] = DISTRICTS;

/** 오행을 채우는 놀이 (source). 화면이 알려 주는 것(클럽·상가 들르기)은 하루에 한 번씩만 센다 */
export const ELEMENT_SOURCES = {
  wood: ['fruit'],
  fire: ['dance', 'request', 'drink'],
  earth: ['shop', 'room', 'market'],
  metal: ['debate'],
  water: ['fish'],
} as const satisfies Record<Element, readonly string[]>;

export type ElementSource = (typeof ELEMENT_SOURCES)[Element][number];

/** 화면이 알려 오는 놀이 (서버가 직접 볼 수 없는 것): 하루 한 번씩 */
export const CLIENT_SOURCES: Partial<Record<Element, readonly ElementSource[]>> = { fire: ['dance', 'request', 'drink'], earth: ['market'] };

export const ELEMENT_ACTIVITY: Record<Element, { title: string; how: string }> = {
  wood: { title: '열매 따기', how: '지역마다 있는 열매 나무나 광장의 운세 나무에서 열매를 따요' },
  fire: { title: '클럽', how: '클럽 무대에서 춤추기, DJ에게 신청곡, 바텐더에게 한 잔 (하루에 하나씩 한 칸)' },
  earth: { title: '상가·방 꾸미기', how: '상가 들르기, 내 점포 사기·꾸미기, 내 방 꾸며서 저장하기 (하루에 하나씩 한 칸)' },
  metal: { title: '오늘의 토론', how: '광장 게시판의 오늘의 토론에서 논거 쓰기·추천·관전 판정' },
  water: { title: '낚시', how: '낚시터에서 낚싯대를 던져요' },
};

/** 오늘 채울 칸 수: 기준보다 모자란 만큼 */
export function elementNeeds(counts: Partial<Record<Element, number>>): Record<Element, number> {
  return Object.fromEntries(ELEMENTS.map((e) => [e, Math.max(0, elementConfig.target - (counts[e] ?? 0))])) as Record<Element, number>;
}

/** 가장 모자란 오행 (같으면 오행 순서대로 앞). 모두 기준을 넘으면 null */
export function weakestElement(counts: Partial<Record<Element, number>>): Element | null {
  const needs = elementNeeds(counts);
  let best: Element | null = null;
  for (const e of ELEMENTS) if (needs[e] > 0 && (best === null || needs[e] > needs[best])) best = e;
  return best;
}

export interface ElementsView {
  /** 타고난 오행 개수 (여덟 글자, 시간을 모르면 여섯 글자) */
  counts: Record<Element, number>;
  timeKnown: boolean;
  /** 오늘 채울 칸과 채운 칸 */
  need: Record<Element, number>;
  filled: Record<Element, number>;
  /** 오늘 다 채웠는지, 받은 보상 */
  balanced: boolean;
  reward: number;
  /** 지금까지 다 채운 날 수 */
  balanceDays: number;
}

/** 한 번 채운 결과 (놀이 결과 화면에 "○ 기운 +1"로 보인다) */
export interface ElementFill {
  element: Element;
  /** 이번에 한 칸 채웠는지 (이미 다 찼거나 오늘 한 번 센 놀이면 false) */
  added: boolean;
  filled: number;
  need: number;
  /** 이번에 다섯 오행을 모두 채워 보상을 받았으면 그 코인 */
  reward: number;
}
