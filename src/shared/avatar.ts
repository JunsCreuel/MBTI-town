// 나의 캐릭터: 남자·여자 캐릭터를 고르고, 티셔츠 색과 소품을 바꿔 입힌다 (PROJECT_GUIDE.md 5장 4단계, 16장 아바타 규약).
// 마을에서 데리고 다니는 펫도 여기에 둔다 (profiles.avatar jsonb, DB를 바꾸지 않는다).
import { isPetId, type PetId } from './pets';

/** 캐릭터 몸 (manifest 키: 남자 char.base, 여자 char.base.female) */
export const AVATAR_BODIES = [
  { id: 'male', label: '남자', key: 'char.base' },
  { id: 'female', label: '여자', key: 'char.base.female' },
] as const;
export type AvatarBody = (typeof AVATAR_BODIES)[number]['id'];
export const bodyKey = (body: AvatarBody) => AVATAR_BODIES.find((b) => b.id === body)!.key;
export const isAvatarBody = (v: unknown): v is AvatarBody => AVATAR_BODIES.some((b) => b.id === v);

export const AVATAR_COLORS = ['mint', 'sky', 'peach', 'butter', 'lilac', 'coral', 'sage', 'navy'] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export const ACCESSORIES = [
  { id: 'none', label: '없음', key: null },
  { id: 'flower', label: '꽃 핀', key: 'char.acc.flower' },
  { id: 'glasses', label: '동그란 안경', key: 'char.acc.glasses', socket: 'eyes' },
  { id: 'cap', label: '모자', key: 'char.acc.cap' },
  { id: 'headphones', label: '헤드폰', key: 'char.acc.headphones' },
] as const;
export type AccessoryId = (typeof ACCESSORIES)[number]['id'];

export interface Avatar {
  body: AvatarBody;
  color: AvatarColor;
  accessory: AccessoryId;
  /** 마을에서 데리고 다니는 펫 (pets.ts의 id, 없으면 '') */
  pet: PetId | '';
}

export const DEFAULT_AVATAR: Avatar = { body: 'male', color: 'mint', accessory: 'none', pet: '' };

/** 이름표 둘째 줄: MBTI (= 사는 마을). 없으면 '' */
export function profileTag(mbti?: string | null): string {
  return mbti || '';
}

export function cleanAvatar(v: unknown): Avatar {
  const a = (v ?? {}) as Partial<Record<keyof Avatar, unknown>>;
  return {
    body: isAvatarBody(a.body) ? a.body : DEFAULT_AVATAR.body,
    color: (AVATAR_COLORS as readonly unknown[]).includes(a.color) ? (a.color as AvatarColor) : DEFAULT_AVATAR.color,
    accessory: ACCESSORIES.some((x) => x.id === a.accessory) ? (a.accessory as AccessoryId) : DEFAULT_AVATAR.accessory,
    pet: isPetId(a.pet) ? a.pet : '',
  };
}
