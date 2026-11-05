// 나의 캐릭터: 색과 소품만 바꿔 입힌다 (PROJECT_GUIDE.md 5장 4단계, 16장 아바타 규약).

export const AVATAR_COLORS = ['mint', 'sky', 'peach', 'butter', 'lilac', 'coral', 'sage', 'navy'] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export const ACCESSORIES = [
  { id: 'none', label: '없음', key: null },
  { id: 'flower', label: '꽃 핀', key: 'char.acc.flower' },
  { id: 'glasses', label: '동그란 안경', key: 'char.acc.glasses' },
  { id: 'cap', label: '모자', key: 'char.acc.cap' },
  { id: 'headphones', label: '헤드폰', key: 'char.acc.headphones' },
] as const;
export type AccessoryId = (typeof ACCESSORIES)[number]['id'];

export interface Avatar {
  color: AvatarColor;
  accessory: AccessoryId;
}

export const DEFAULT_AVATAR: Avatar = { color: 'mint', accessory: 'none' };

/** 이름표 둘째 줄: MBTI (= 사는 마을). 없으면 '' */
export function profileTag(mbti?: string | null): string {
  return mbti || '';
}

export function cleanAvatar(v: unknown): Avatar {
  const a = (v ?? {}) as Partial<Record<keyof Avatar, unknown>>;
  return {
    color: (AVATAR_COLORS as readonly unknown[]).includes(a.color) ? (a.color as AvatarColor) : DEFAULT_AVATAR.color,
    accessory: ACCESSORIES.some((x) => x.id === a.accessory) ? (a.accessory as AccessoryId) : DEFAULT_AVATAR.accessory,
  };
}
