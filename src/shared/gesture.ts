// 캐릭터가 지금 어떤 동작을 그릴지 (마을·놀이터 공통). 화면 코드와 떼어 두어 테스트한다.
// 점프는 걸으면서도 한다 (달리다 폴짝: 점프 동작을 그리며 앞으로 나아가고 몸이 솟는다). 다른 동작은 걸으면 끝난다.
import type { ClipName } from './character';
import type { ActionKind } from './protocol';

export interface GestureTiming {
  action?: ActionKind;
  actionStart?: number;
  actionUntil: number;
}

export interface GesturePose {
  clip: ClipName;
  /** 동작을 시작한 시각 (같은 동작을 다시 하면 처음부터 다시 그린다) */
  clipStart: number;
  /** 점프 중이면 0~1 */
  hop?: number;
  /** 걸어서 동작이 끝났는지 (끝났으면 동작을 지운다) */
  stop: boolean;
}

/** t = 지금(초), jumpSec = 점프 한 번 길이(초) */
export function gesturePose(g: GestureTiming | undefined, t: number, walking: boolean, jumpSec: number): GesturePose {
  const live = !!g?.action && t < g.actionUntil;
  const jumping = live && g!.action === 'jump';
  const acting = live && !walking;
  const start = g?.actionStart ?? t;
  return {
    clip: jumping ? 'jump' : walking ? 'walk' : acting ? (g!.action as ClipName) : 'idle',
    clipStart: jumping || acting ? start : 0,
    hop: jumping ? Math.min(1, Math.max(0, (t - start) / jumpSec)) : undefined,
    stop: walking && live && !jumping,
  };
}

/** 점프로 솟은 높이: 위로 던진 공처럼 올라갔다 내려온다 (hop 0~1) */
export const hopHeight = (hop: number | undefined, height: number) => (hop === undefined || hop <= 0 || hop >= 1 ? 0 : height * 4 * hop * (1 - hop));
