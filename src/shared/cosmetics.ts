// 캐릭터 꾸미기: 지금 무료로 고르는 색·소품은 src/shared/avatar.ts.
// 아래는 앞으로 상점에서 팔 옷·소품 목록이다 (아직 살 수 없다. 결제를 붙일 때 가격과 판매를 정한다 [결정 필요]).

export const COSMETIC_SLOTS = { outfit: '옷', head: '머리 소품', back: '등·꼬리', effect: '반짝 효과' } as const;
export type CosmeticSlot = keyof typeof COSMETIC_SLOTS;

export interface CosmeticItem {
  id: string;
  name: string;
  slot: CosmeticSlot;
}

export const UPCOMING_COSMETICS: readonly CosmeticItem[] = [
  { id: 'hanbok', name: '색동 한복', slot: 'outfit' },
  { id: 'hoodie', name: '마을 후드티', slot: 'outfit' },
  { id: 'overall', name: '멜빵바지', slot: 'outfit' },
  { id: 'raincoat', name: '노란 우비', slot: 'outfit' },
  { id: 'gat', name: '도사 갓', slot: 'head' },
  { id: 'cat_ears', name: '고양이 귀', slot: 'head' },
  { id: 'crown', name: '작은 왕관', slot: 'head' },
  { id: 'ribbon', name: '큰 리본', slot: 'head' },
  { id: 'angel_wings', name: '천사 날개', slot: 'back' },
  { id: 'fox_tail', name: '여우 꼬리', slot: 'back' },
  { id: 'stars', name: '별가루', slot: 'effect' },
  { id: 'petals', name: '벚꽃 잎', slot: 'effect' },
];
