// 하루의 빛: 한국 시각에 맞춰 하늘·안개·해·주변광 색과 세기를 바꾼다 (새벽 → 낮 → 노을 → 밤).
// 밤에는 창문과 가로등(재질 'glass', 'glow')이 따뜻하게 켜진다.
import * as THREE from 'three';
import { tokens } from '@/design/tokens';

const S = tokens.scene;

export interface DayLook {
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  fog: THREE.Color;
  sun: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  /** 0 = 낮, 1 = 한밤 (창문·가로등 켜짐 정도, 반딧불이) */
  night: number;
  /** 0~1 낮 정도 (나비) */
  day: number;
}

interface Key {
  /** 시각 (0~24) */
  h: number;
  skyTop: string;
  skyHorizon: string;
  fog: string;
  sun: string;
  sunI: number;
  hemiSky: string;
  hemiGround: string;
  hemiI: number;
  night: number;
}

const KEYS: Key[] = [
  { h: 0, skyTop: S.nightTop, skyHorizon: S.nightHorizon, fog: S.nightFog, sun: S.moon, sunI: 0.9, hemiSky: S.nightHemi, hemiGround: S.nightGround, hemiI: 1.3, night: 1 },
  { h: 5, skyTop: S.nightTop, skyHorizon: S.nightHorizon, fog: S.nightFog, sun: S.moon, sunI: 0.9, hemiSky: S.nightHemi, hemiGround: S.nightGround, hemiI: 1.3, night: 1 },
  { h: 6.5, skyTop: S.dawnTop, skyHorizon: S.dawnHorizon, fog: S.dawnHorizon, sun: S.dawnSun, sunI: 1.6, hemiSky: S.hemiSky, hemiGround: S.hemiGround, hemiI: 1.3, night: 0.35 },
  { h: 8, skyTop: S.skyTop, skyHorizon: S.skyHorizon, fog: S.fog, sun: S.sun, sunI: 2.3, hemiSky: S.hemiSky, hemiGround: S.hemiGround, hemiI: 1.55, night: 0 },
  { h: 16.5, skyTop: S.skyTop, skyHorizon: S.skyHorizon, fog: S.fog, sun: S.sun, sunI: 2.3, hemiSky: S.hemiSky, hemiGround: S.hemiGround, hemiI: 1.55, night: 0 },
  { h: 18.2, skyTop: S.duskTop, skyHorizon: S.duskHorizon, fog: S.duskHorizon, sun: S.duskSun, sunI: 1.9, hemiSky: S.duskHemi, hemiGround: S.hemiGround, hemiI: 1.35, night: 0.25 },
  { h: 19.6, skyTop: S.nightTop, skyHorizon: S.duskHorizon, fog: S.nightFog, sun: S.moon, sunI: 0.9, hemiSky: S.nightHemi, hemiGround: S.nightGround, hemiI: 1.1, night: 0.85 },
  { h: 24, skyTop: S.nightTop, skyHorizon: S.nightHorizon, fog: S.nightFog, sun: S.moon, sunI: 0.9, hemiSky: S.nightHemi, hemiGround: S.nightGround, hemiI: 1.3, night: 1 },
];

const hourFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });

/** 지금 한국 시각 (0~24, 소수) */
export function seoulHour(date = new Date()): number {
  const p = Object.fromEntries(hourFormatter.formatToParts(date).map((x) => [x.type, x.value]));
  return Number(p.hour) + Number(p.minute) / 60;
}

const c = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t);

/** 그 시각의 하늘·빛 */
export function dayLookAt(hour: number): DayLook {
  let i = KEYS.findIndex((k) => k.h > hour);
  if (i <= 0) i = KEYS.length - 1;
  const a = KEYS[i - 1];
  const b = KEYS[i];
  const t = THREE.MathUtils.smoothstep((hour - a.h) / (b.h - a.h), 0, 1);
  const night = THREE.MathUtils.lerp(a.night, b.night, t);
  return {
    skyTop: c(a.skyTop, b.skyTop, t),
    skyHorizon: c(a.skyHorizon, b.skyHorizon, t),
    fog: c(a.fog, b.fog, t),
    sun: c(a.sun, b.sun, t),
    sunIntensity: THREE.MathUtils.lerp(a.sunI, b.sunI, t),
    hemiSky: c(a.hemiSky, b.hemiSky, t),
    hemiGround: c(a.hemiGround, b.hemiGround, t),
    hemiIntensity: THREE.MathUtils.lerp(a.hemiI, b.hemiI, t),
    night,
    day: 1 - night,
  };
}

/** 장면이 함께 읽는 지금의 빛 (DayCycle이 몇 초마다 바꾼다) */
export const day = { look: dayLookAt(12), hour: 12 };

/** 주소에 ?hour=21 처럼 시각을 주면 그 시각으로 본다 (확인용) */
export function currentHour(): number {
  if (typeof window !== 'undefined') {
    const h = Number(new URLSearchParams(window.location.search).get('hour'));
    if (window.location.search.includes('hour=') && Number.isFinite(h)) return ((h % 24) + 24) % 24;
  }
  return seoulHour();
}
