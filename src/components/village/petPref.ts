// 데리고 다니던 펫을 이 기기에 기억한다 (다음에 마을에 들어와도 같이 산책한다).
import { isPetId } from '@/shared/pets';

const KEY = 'scene:pet';

export function savedPet(): string {
  try {
    const v = localStorage.getItem(KEY);
    return isPetId(v) ? v : '';
  } catch {
    return '';
  }
}

export function savePet(pet: string) {
  try {
    if (pet) localStorage.setItem(KEY, pet);
    else localStorage.removeItem(KEY);
  } catch {
    // 저장하지 못해도 이번 산책에는 지장이 없다
  }
}
