// 나의 캐릭터: 남자·여자 캐릭터를 고르고, 티셔츠 색·피부색·머리 색과 소품을 바꾼다 (PROJECT_GUIDE.md 5장 4단계, 16장 아바타 규약).
// 성별(남자·여자)은 가입자의 성별대로 가입할 때 한 번 고르고 바꿀 수 없다 (bodyFixed). 나머지는 내 캐릭터 화면에서 언제든 바꾼다.
// 여자 캐릭터가 생기기 전에 가입해 성별이 정해지지 않은 계정(bodyFixed 없음)은 내 캐릭터 화면에서 한 번만 정한다.
// 마을에서 데리고 다니는 펫도 여기에 둔다 (profiles.avatar jsonb, DB를 바꾸지 않는다).
import { PETS, isPetId, petDef, type PetId } from './pets';

/** 펫 이름 글자 수 상한 */
export const PET_NAME_MAX = 10;

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

/** 피부색 (natural = 모델 원래 색). 색은 tokens.avatarSkin */
export const SKIN_TONES = [
  { id: 'natural', label: '기본' },
  { id: 'fair', label: '뽀얀' },
  { id: 'honey', label: '꿀빛' },
  { id: 'tan', label: '구릿빛' },
  { id: 'brown', label: '갈색' },
  { id: 'deep', label: '짙은' },
] as const;
export type SkinTone = (typeof SKIN_TONES)[number]['id'];
export const isSkinTone = (v: unknown): v is SkinTone => SKIN_TONES.some((x) => x.id === v);

/** 머리 색 (natural = 모델 원래 색). 색은 tokens.avatarHair */
export const HAIR_COLORS = [
  { id: 'natural', label: '기본' },
  { id: 'black', label: '검정' },
  { id: 'brown', label: '갈색' },
  { id: 'blonde', label: '금발' },
  { id: 'red', label: '빨강' },
  { id: 'pink', label: '분홍' },
  { id: 'lavender', label: '보라' },
  { id: 'mint', label: '민트' },
  { id: 'silver', label: '은발' },
] as const;
export type HairColor = (typeof HAIR_COLORS)[number]['id'];
export const isHairColor = (v: unknown): v is HairColor => HAIR_COLORS.some((x) => x.id === v);

export const ACCESSORIES = [
  { id: 'none', label: '없음', key: null },
  { id: 'flower', label: '꽃 핀', key: 'char.acc.flower' },
  { id: 'glasses', label: '동그란 안경', key: 'char.acc.glasses', socket: 'eyes' },
  { id: 'cap', label: '모자', key: 'char.acc.cap' },
  { id: 'headphones', label: '헤드폰', key: 'char.acc.headphones' },
] as const;
export type AccessoryId = (typeof ACCESSORIES)[number]['id'];

export interface Avatar {
  /** 남자·여자 = 가입자의 성별 (가입할 때만 고른다) */
  body: AvatarBody;
  /** 성별을 정했다 (그 뒤로는 바꿀 수 없다). 예전 계정은 없다 → 한 번 정할 수 있다 */
  bodyFixed?: true;
  /** 티셔츠 색 */
  color: AvatarColor;
  skin: SkinTone;
  hair: HairColor;
  accessory: AccessoryId;
  /** 마을에서 데리고 다니는 펫 (pets.ts의 id, 없으면 '') */
  pet: PetId | '';
  /** 펫마다 지어 준 이름 (없으면 펫 종류 이름. 방 강아지와 마을 펫이 같이 쓴다) */
  petNames: Partial<Record<PetId, string>>;
}

export const DEFAULT_AVATAR: Avatar = { body: 'male', color: 'mint', skin: 'natural', hair: 'natural', accessory: 'none', pet: '', petNames: {} };

/** 펫 이름: 지어 준 이름, 없으면 종류 이름 (강아지) */
export function petNameOf(avatar: Pick<Avatar, 'petNames'> | null | undefined, pet: PetId): string {
  return avatar?.petNames?.[pet] || petDef(pet)?.name || pet;
}

/** 저장된 펫 이름 정리: 아는 펫만, 앞뒤 공백을 빼고 PET_NAME_MAX자까지 (금지어 검사는 서버가 바꿀 때 한다) */
export function cleanPetNames(v: unknown): Partial<Record<PetId, string>> {
  const raw = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const out: Partial<Record<PetId, string>> = {};
  for (const p of PETS) {
    const name = raw[p.id];
    if (typeof name === 'string' && name.trim()) out[p.id] = name.trim().replace(/\s+/g, ' ').slice(0, PET_NAME_MAX);
  }
  return out;
}

/** 이름표 둘째 줄: MBTI (= 사는 마을). 없으면 '' */
export function profileTag(mbti?: string | null): string {
  return mbti || '';
}

export function cleanAvatar(v: unknown): Avatar {
  const a = (v ?? {}) as Partial<Record<keyof Avatar, unknown>>;
  return {
    body: isAvatarBody(a.body) ? a.body : DEFAULT_AVATAR.body,
    color: (AVATAR_COLORS as readonly unknown[]).includes(a.color) ? (a.color as AvatarColor) : DEFAULT_AVATAR.color,
    skin: isSkinTone(a.skin) ? a.skin : DEFAULT_AVATAR.skin,
    hair: isHairColor(a.hair) ? a.hair : DEFAULT_AVATAR.hair,
    accessory: ACCESSORIES.some((x) => x.id === a.accessory) ? (a.accessory as AccessoryId) : DEFAULT_AVATAR.accessory,
    pet: isPetId(a.pet) ? a.pet : '',
    petNames: cleanPetNames(a.petNames),
    ...(a.bodyFixed === true ? { bodyFixed: true as const } : {}),
  };
}
