// 일주 동물 펫: 일주(예: 갑자)의 지지는 띠 동물, 천간은 오행 색 (PROJECT_GUIDE.md 6장).
// 60갑자 = 색 5가지 × 동물 12가지. 동물 모델은 12개만 두고 색을 입힌다.
import type { District } from './districts';

export const PET_ANIMALS = ['rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'sheep', 'monkey', 'rooster', 'dog', 'pig'] as const;
export type PetAnimal = (typeof PET_ANIMALS)[number];

const STEMS_KO = '갑을병정무기경신임계';
const BRANCHES_KO = '자축인묘진사오미신유술해';
const STEM_ELEMENT: District[] = ['wood', 'wood', 'fire', 'fire', 'earth', 'earth', 'metal', 'metal', 'water', 'water'];
export const ANIMAL_KO: Record<PetAnimal, string> = {
  rat: '쥐', ox: '소', tiger: '호랑이', rabbit: '토끼', dragon: '용', snake: '뱀',
  horse: '말', sheep: '양', monkey: '원숭이', rooster: '닭', dog: '개', pig: '돼지',
};
/** 천간 오행의 전통 색 이름 (청·적·황·백·흑) */
export const PET_COLOR_KO: Record<District, string> = { wood: '푸른', fire: '붉은', earth: '황금', metal: '하얀', water: '검은' };

export interface Pet {
  animal: PetAnimal;
  /** 몸 색을 정하는 천간 오행 */
  element: District;
  /** 예: 푸른 쥐 */
  name: string;
  /** 예: 갑자 */
  ilju: string;
}

/** 일주 한글 두 글자 → 펫. 일주가 아니면 null */
export function petOf(ilju: string | null | undefined): Pet | null {
  if (!ilju || ilju.length !== 2) return null;
  const s = STEMS_KO.indexOf(ilju[0]);
  const b = BRANCHES_KO.indexOf(ilju[1]);
  // 60갑자는 천간과 지지의 음양이 같은 짝만 있다
  if (s < 0 || b < 0 || s % 2 !== b % 2) return null;
  const animal = PET_ANIMALS[b];
  const element = STEM_ELEMENT[s];
  return { animal, element, name: `${PET_COLOR_KO[element]} ${ANIMAL_KO[animal]}`, ilju };
}
