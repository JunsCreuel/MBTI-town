// 펫: 마을에서 불러서 같이 산책한다 (방에서는 방마다 강아지가 따로 산다). 지금은 강아지 하나, 하나씩 늘려 간다.
// 새 펫을 더할 때: 모델을 scripts/import-characters.ts로 넣고 (pet.* 키), 여기에 한 줄 더한 뒤 npm run assets:pet-thumbs로 사진을 만든다.

/**
 * height = 화면에서의 키 (칸, 사람 캐릭터는 1.32). 모델 키와 상관없이 이 키로 맞춰 그린다 (마을·방 같이).
 * thumb = 펫 고르기 창의 사진 (npm run assets:pet-thumbs가 모델을 그려 만든다)
 */
export const PETS = [{ id: 'dog', name: '강아지', key: 'pet.dog', thumb: 'pet.dog.thumb', height: 0.82 }] as const;
export type PetId = (typeof PETS)[number]['id'];
export const isPetId = (v: unknown): v is PetId => PETS.some((p) => p.id === v);
export const petDef = (id: string) => PETS.find((p) => p.id === id);
