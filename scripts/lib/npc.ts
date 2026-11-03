// 안내 NPC 몬냥이 (3D): 크림색 고양이, 뾰족 귀 안쪽은 분홍, 초록 조끼와 금색 이름 배지, 꼬리.
// 2D 안내 그림(char.guide.monnyang)과 같은 얼굴. 뼈대·동작은 베이스 캐릭터와 같다 (손 흔들기·폴짝 등을 그대로 쓴다).
import * as THREE from 'three';
import { chibiCharacterSpec, part, type Part, type SkinnedSpec } from './models';

type Vec3 = [number, number, number];

const C = {
  fur: '#FFF3E2',
  furShade: '#F3E2CB',
  earIn: '#FFC9B3',
  eye: '#3D4250',
  eyeLight: '#FFFFFF',
  blush: '#FFB3B3',
  nose: '#FF9DA6',
  mouth: '#3D4250',
  vest: '#2FA58A',
  vestDark: '#238470',
  badge: '#F2C14E',
  scarf: '#E2483D',
};

// 첫 화면 용량을 위해 면 수를 줄인다 (작은 부품은 거칠어도 티가 나지 않는다)
const sphere = (r: number, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);
const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 3, 10);

export function guideCatSpec(): SkinnedSpec {
  const base = chibiCharacterSpec();
  const HEAD_C: Vec3 = [0, 0.98, 0];
  const HEAD_S: Vec3 = [1.08, 0.9, 0.95];
  const parts: Part[] = [];
  for (const s of [1, -1]) {
    const leg = s > 0 ? 'legL' : 'legR';
    const arm = s > 0 ? 'armL' : 'armR';
    parts.push(
      // 다리와 발
      part(capsule(0.07, 0.12), C.fur, { pos: [0.095 * s, 0.18, 0], joint: leg }),
      part(sphere(0.085), C.fur, { pos: [0.095 * s, 0.055, 0.03], scale: [1, 0.68, 1.3], joint: leg }),
      // 팔(조끼 소매 없이 털)과 앞발
      part(capsule(0.054, 0.1), C.fur, { pos: [0.215 * s, 0.52, 0], rot: [0, 0, 14 * s], joint: arm }),
      part(sphere(0.062), C.fur, { pos: [0.235 * s, 0.41, 0.005], joint: arm }),
      // 귀: 바깥 크림, 안쪽 분홍
      part(new THREE.ConeGeometry(0.11, 0.2, 4), C.fur, { pos: [0.19 * s, 1.27, -0.02], rot: [0, 45, -22 * s], joint: 'head' }),
      part(new THREE.ConeGeometry(0.065, 0.13, 4), C.earIn, { pos: [0.185 * s, 1.255, 0.035], rot: [0, 45, -22 * s], joint: 'head' }),
      // 눈 (동글), 하이라이트, 볼
      part(sphere(1, 10, 8), C.eye, { pos: [0.12 * s, 0.99, 0.282], scale: [0.045, 0.052, 0.03], joint: 'head' }),
      part(sphere(0.015, 6, 4), C.eyeLight, { pos: [0.108 * s, 1.007, 0.309], joint: 'head' }),
      part(sphere(1, 8, 6), C.blush, { pos: [0.2 * s, 0.905, 0.228], rot: [0, 38 * s, 0], scale: [0.06, 0.032, 0.014], joint: 'head' }),
      // 수염 셋
      ...[-1, 0, 1].map((k) =>
        part(new THREE.BoxGeometry(0.13, 0.006, 0.006), C.eye, { pos: [0.27 * s, 0.925 + k * 0.022, 0.25], rot: [0, -20 * s, k * 10 * s], joint: 'head' }),
      ),
      // 조끼 앞 여밈
      part(new THREE.BoxGeometry(0.06, 0.2, 0.03), C.vestDark, { pos: [0.03 * s, 0.47, 0.165], rot: [0, 0, -6 * s], joint: 'body' }),
    );
  }
  parts.push(
    // 몸: 초록 조끼, 앞은 크림색 배
    part(sphere(1, 18, 12), C.vest, { pos: [0, 0.47, 0], scale: [0.21, 0.2, 0.17], joint: 'body' }),
    part(sphere(1, 12, 8), C.fur, { pos: [0, 0.45, 0.06], scale: [0.11, 0.15, 0.12], joint: 'body' }),
    part(new THREE.CylinderGeometry(0.2, 0.17, 0.06, 24), C.vest, { pos: [0, 0.32, 0], scale: [1, 1, 0.82], joint: 'body' }),
    // 금색 이름 배지와 빨간 목도리
    part(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 16), C.badge, { pos: [0.09, 0.52, 0.168], rot: [90, 0, 0], joint: 'body' }),
    part(new THREE.TorusGeometry(0.15, 0.03, 6, 18), C.scarf, { pos: [0, 0.64, 0], rot: [90, 0, 0], scale: [1, 0.85, 1], joint: 'body' }),
    // 꼬리: 엉덩이 뒤에서 위로 말린다
    ...([[0, 0.3, -0.16], [0, 0.36, -0.24], [0, 0.45, -0.29], [0, 0.55, -0.3], [0.02, 0.63, -0.27]] as Vec3[]).map((p, i) =>
      part(sphere(0.05 - i * 0.003), i === 4 ? C.furShade : C.fur, { pos: p, joint: 'hips' }),
    ),
    // 머리
    part(sphere(0.33, 22, 16), C.fur, { pos: HEAD_C, scale: HEAD_S, joint: 'head' }),
    part(sphere(1, 12, 8), C.fur, { pos: [0, 0.91, 0.24], scale: [0.13, 0.08, 0.08], joint: 'head' }),
    part(new THREE.ConeGeometry(0.022, 0.025, 3), C.nose, { pos: [0, 0.94, 0.318], rot: [-90, 0, 180], joint: 'head' }),
    // 입: ω
    ...[-1, 1].map((s) => part(new THREE.TorusGeometry(0.018, 0.005, 4, 8, Math.PI), C.mouth, { pos: [0.018 * s, 0.905, 0.315], rot: [-10, 0, 180], joint: 'head' })),
  );
  return { ...base, sockets: {}, parts };
}
