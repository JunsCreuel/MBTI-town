// 마을 화면을 누른 것이 "탭(걷기·고르기)"인지 "끌기·꾹 누르기(카메라 돌리기)"인지 가른다.
// 카메라(CameraRig)가 누르고 떼는 것을 기록하고, 바닥·집·소품의 클릭은 tapped()로 확인한다.
// 클릭 이벤트는 손을 뗀(pointerup) 뒤에 오므로, 그때는 이번 누르기의 기록이 끝나 있다.
import { now } from './session';

/** 이보다 오래 누르고 있으면 카메라를 돌리려던 것으로 본다 (초) */
const HOLD_SEC = 0.3;
/** 이보다 많이 움직이면 끌기로 본다 (px) */
const MOVE_PX = 10;

export const pointerState = {
  /** 두 손가락 확대 중 */
  pinching: false,
  pinchEndedAt: 0,
  /** 지금(또는 마지막) 누르기 */
  downAt: 0,
  upAt: 0,
  x0: 0,
  y0: 0,
  /** 이번 누르기에서 가장 멀리 움직인 거리 (px) */
  travel: 0,
  /** 이번 누르기로 카메라를 돌렸는지 */
  rotated: false,

  down(x: number, y: number) {
    this.downAt = now();
    this.upAt = 0;
    this.x0 = x;
    this.y0 = y;
    this.travel = 0;
    this.rotated = false;
  },
  move(x: number, y: number) {
    this.travel = Math.max(this.travel, Math.hypot(x - this.x0, y - this.y0));
  },
  up() {
    this.upAt = now();
  },

  /** 방금 손을 뗀 것이 짧게 누른 탭인지 (꾹 누르기·끌기·두 손가락 확대 직후면 false) */
  tapped(): boolean {
    if (this.pinching || now() - this.pinchEndedAt < 0.3) return false;
    if (this.rotated || this.travel > MOVE_PX) return false;
    const end = this.upAt || now();
    return end - this.downAt < HOLD_SEC;
  },
};
