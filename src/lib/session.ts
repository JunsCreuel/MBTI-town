// 고른 MBTI를 이 브라우저에만 기억한다 (로그인 전 편의 기능). 저장이 막혀 있어도 동작해야 한다.
import { isMbtiType, type MbtiType } from '@/design/mbti';

const KEY = 'mbti-town:mbti';

export function loadMbti(): MbtiType | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return isMbtiType(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveMbti(mbti: MbtiType): void {
  try {
    window.localStorage.setItem(KEY, mbti);
  } catch {
    // 저장소를 쓸 수 없으면 이번 방문에서만 쓴다
  }
}
