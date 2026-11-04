// 상가: 점포 20칸 (PROJECT_GUIDE.md 3장 마을). 코인으로 사고, 이름·소개·차양 색을 정한다.
// 서버(src/server/scene/service.ts)가 값과 규칙을 다시 검사한다.
import { marketConfig } from '../config/game';

/** 상가 점포 소품 키 (맵에 놓인 순서가 점포 번호: 북서쪽부터 시계 방향) */
export const STALL_KEY = 'prop.market.stall';

/** 차양 색 (tokens.taste의 파스텔 색) */
export const SHOP_COLORS = ['mint', 'coral', 'butter', 'sky', 'lavender', 'green', 'peach', 'silver'] as const;
export type ShopColor = (typeof SHOP_COLORS)[number];
export const SHOP_COLOR_NAME: Record<ShopColor, string> = {
  mint: '민트',
  coral: '산호',
  butter: '버터',
  sky: '하늘',
  lavender: '라벤더',
  green: '초록',
  peach: '복숭아',
  silver: '은빛',
};

export const isShopColor = (v: unknown): v is ShopColor => typeof v === 'string' && (SHOP_COLORS as readonly string[]).includes(v);

/** 점포 번호 (0부터). 화면에는 1호부터 */
export const isShopSlot = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < marketConfig.shops;
export const shopLabel = (slot: number) => `${slot + 1}호`;

export interface MarketShop {
  slot: number;
  name: string;
  intro: string;
  color: ShopColor;
  owner: { displayName: string; handle: string | null };
  mine: boolean;
}

export interface MarketView {
  /** 주인이 있는 점포만 (번호 순) */
  shops: MarketShop[];
  price: number;
  /** 내 코인 (로그인 전이면 null) */
  coins: number | null;
  /** 내 점포 번호 */
  myShop: number | null;
  /** 운영자면 남의 점포도 비울 수 있다 */
  admin: boolean;
}

/** 내놓으면 돌려받는 코인 */
export const refundFor = () => Math.floor(marketConfig.price * marketConfig.refundRate);
