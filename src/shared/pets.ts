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

/** 쓰다듬으면 하는 펫 자세 (펫 모델의 동작 이름, scripts/import-characters.ts) */
export const PET_POSES = ['sit', 'lie', 'happy'] as const;
export type PetPose = (typeof PET_POSES)[number];
export const isPetPose = (v: unknown): v is PetPose => (PET_POSES as readonly unknown[]).includes(v);

/** 쓰다듬으면: 앉고 → 옆으로 벌러덩 눕고 → 일어나 깡총거리며 꼬리를 흔든다 (초) */
export const PET_REACTION: readonly { pose: PetPose; sec: number }[] = [
  { pose: 'sit', sec: 1.6 },
  { pose: 'lie', sec: 2.6 },
  { pose: 'happy', sec: 1.8 },
];
export const PET_REACTION_SEC = PET_REACTION.reduce((s, p) => s + p.sec, 0);

/** 쓰다듬은 지 elapsed초 뒤의 자세 (아직 안 했거나 끝났으면 null) */
export function petReactionPose(elapsed: number): PetPose | null {
  if (!(elapsed >= 0)) return null;
  let t = elapsed;
  for (const step of PET_REACTION) {
    if (t < step.sec) return step.pose;
    t -= step.sec;
  }
  return null;
}
