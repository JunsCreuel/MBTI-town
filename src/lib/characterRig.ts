// 캐릭터 모델(Tripo 제작, Mixamo 뼈대)을 화면에 쓰기 좋게 준비한다. 마을·방·미리보기·NPC가 같이 쓴다.
// - 동작: 원본에는 서 있기(idle)·걷기(walk)만 있다. 나머지 몸짓은 서 있기 첫 자세에서 뼈를 돌려 만든다.
//   (원본에 같은 이름의 동작이 있으면 그것을 쓴다. Tripo·Mixamo에서 동작을 더 뽑아 넣으면 저절로 바뀐다.)
// - 옷 색: 티셔츠 자리(색 텍스처 알파)에만 고른 색을 입힌다 (scripts/import-characters.ts가 표시해 둔다).
// - 머리 색·피부색: 머리카락·살 자리 텍스처(발광 텍스처 칸)에 표시된 곳에만 고른 색을 입힌다.
// - 표정: 얼굴 재질 텍스처(표정 아틀라스)의 자리를 옮겨 바꾼다.
import * as THREE from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import type { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { tokens } from '@/design/tokens';
import { ACCESSORIES, isHairColor, isSkinTone } from '@/shared/avatar';
import type { PetPose } from '@/shared/pets';
import { CHARACTER_CLIPS, EYES_SOCKET, FACE_MATERIAL, HAND_SOCKET, HEAD_SOCKET, TINT_MATERIAL, faceOffset, type ClipName, type FaceName } from '@/shared/character';

/** 모든 GLTFLoader에 meshopt 압축 풀기를 붙인다 (캐릭터 모델은 meshopt로 압축했다) */
export function withMeshopt(loader: GLTFLoader): GLTFLoader {
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

/** three는 노드 이름의 ':'를 지운다 (mixamorig:Hips → mixamorigHips) */
const bone = (name: string) => `mixamorig${name}`;

/** 걷기 동작 빠르기 (원본 걷기는 느려서 마을 걸음에 맞춘다) */
export const WALK_TIME_SCALE = 1.7;

type V = THREE.Vector3;
interface Pose {
  /** 뼈가 (첫 자식 뼈 쪽으로) 가리킬 방향, 모델 공간 */
  aim?: Partial<Record<string, V>>;
  /** 뼈를 모델 공간 축으로 더 돌린다: [축, 도] */
  turn?: Partial<Record<string, [V, number]>>;
}
interface Key {
  t: number;
  pose: Pose;
}

export interface CharacterRig {
  clips: Record<ClipName, THREE.AnimationClip>;
  /** 낚싯대: 오른손 자리 기준 방향·위치 (낚시 자세에서 앞위로 뻗는다) */
  rod: { quaternion: THREE.Quaternion; position: THREE.Vector3 } | null;
}

const cache = new WeakMap<GLTF, CharacterRig>();

/** 모델 하나에 한 번: 몸짓 동작을 만들고 낚싯대 방향을 정한다 */
export function characterRig(gltf: GLTF): CharacterRig {
  let rig = cache.get(gltf);
  if (!rig) {
    rig = buildRig(gltf);
    cache.set(gltf, rig);
  }
  return rig;
}

function buildRig(gltf: GLTF): CharacterRig {
  const scene = gltf.scene;
  const have = (name: string) => gltf.animations.find((a) => a.name === name);
  const idle = have('idle');
  const hips = scene.getObjectByName(bone('Hips'));
  // 예전 임시 캐릭터처럼 동작이 다 들어 있으면 그대로 쓴다
  if (!idle || !hips) {
    const clips = Object.fromEntries(CHARACTER_CLIPS.map((n) => [n, have(n) ?? idle ?? new THREE.AnimationClip(n, 1, [])])) as Record<ClipName, THREE.AnimationClip>;
    return { clips, rod: null };
  }

  // 원본 서 있기·걷기는 팔을 몸에 붙인다: 옷이 넓은 캐릭터는 팔이 몸속으로 들어가 잘려 보이므로 윗팔을 옆으로 더 벌린다
  const spread = Number((scene.userData as { armSpread?: number }).armSpread) || 0;
  if (spread) for (const clip of [idle, have('walk')]) if (clip) spreadArms(scene, clip, spread);

  // 기준 자세: 서 있기 첫 장면 (원본 선 자세는 팔을 벌린 T자라 쓰지 않는다)
  const bones: THREE.Bone[] = [];
  scene.traverse((o) => void ((o as THREE.Bone).isBone && bones.push(o as THREE.Bone)));
  const mixer = new THREE.AnimationMixer(scene);
  mixer.clipAction(idle).play();
  mixer.setTime(0);
  scene.updateMatrixWorld(true);
  const baseQ = new Map(bones.map((b) => [b, b.quaternion.clone()]));
  const baseHips = hips.position.clone();
  mixer.stopAllAction();
  mixer.uncacheRoot(scene);

  // 모델 축: 앞 +Z, 위 +Y. 오른쪽은 뼈 자리로 알아낸다
  const restoreBase = () => {
    for (const b of bones) b.quaternion.copy(baseQ.get(b)!);
    hips.position.copy(baseHips);
    scene.updateMatrixWorld(true);
  };
  restoreBase();
  const wp = (n: string) => scene.getObjectByName(bone(n))!.getWorldPosition(new THREE.Vector3());
  const right = new THREE.Vector3(Math.sign(wp('RightArm').x - wp('LeftArm').x) || -1, 0, 0);
  const U = new THREE.Vector3(0, 1, 0);
  const F = new THREE.Vector3(0, 0, 1);
  const X = new THREE.Vector3(1, 0, 0);
  const d = (...parts: [V, number][]) => parts.reduce((s, [v, k]) => s.addScaledVector(v, k), new THREE.Vector3()).normalize();
  const side = (r: boolean) => (r ? right : right.clone().negate());

  /** 자세 하나를 기준 자세 위에 입힌다 (부모부터 차례로) */
  const apply = (pose: Pose) => {
    restoreBase();
    const tmpQ = new THREE.Quaternion();
    const parentQ = new THREE.Quaternion();
    for (const b of bones) {
      const name = b.name.replace(/^mixamorig/, '');
      const turn = pose.turn?.[name];
      const aim = pose.aim?.[name];
      if (!turn && !aim) continue;
      const worldQ = b.getWorldQuaternion(new THREE.Quaternion());
      if (turn) worldQ.premultiply(tmpQ.setFromAxisAngle(turn[0], THREE.MathUtils.degToRad(turn[1])));
      b.parent!.getWorldQuaternion(parentQ);
      b.quaternion.copy(parentQ.clone().invert().multiply(worldQ));
      b.updateMatrixWorld(true);
      if (aim) {
        const child = b.children.find((c) => (c as THREE.Bone).isBone);
        if (child) {
          const from = child.getWorldPosition(new THREE.Vector3()).sub(b.getWorldPosition(new THREE.Vector3())).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(from, aim);
          const w = b.getWorldQuaternion(new THREE.Quaternion()).premultiply(q);
          b.parent!.getWorldQuaternion(parentQ);
          b.quaternion.copy(parentQ.invert().multiply(w));
          b.updateMatrixWorld(true);
        }
      }
    }
  };

  /** 열쇠 자세들로 동작을 만든다. 모든 뼈의 회전과 엉덩이 위치를 담는다 (안 담긴 뼈는 T자로 돌아가므로) */
  const makeClip = (name: string, keys: Key[], hipsLift?: number[]): THREE.AnimationClip => {
    const times = keys.map((k) => k.t);
    const values = new Map<THREE.Bone, number[]>(bones.map((b) => [b, []]));
    for (const k of keys) {
      apply(k.pose);
      for (const b of bones) values.get(b)!.push(...b.quaternion.toArray());
    }
    restoreBase();
    const tracks: THREE.KeyframeTrack[] = bones.map((b) => new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, values.get(b)!));
    tracks.push(
      new THREE.VectorKeyframeTrack(
        `${hips.name}.position`,
        times,
        times.flatMap((_, i) => [baseHips.x, baseHips.y + (hipsLift?.[i] ?? 0), baseHips.z]),
      ),
    );
    return new THREE.AnimationClip(name, times[times.length - 1], tracks);
  };

  const R = side(true);
  const L = side(false);
  const armsDown = (): Pose['aim'] => ({});
  const made: Partial<Record<ClipName, THREE.AnimationClip>> = {};

  // 응원: 두 팔 번쩍, 들썩
  {
    // 머리가 커서 팔을 머리 위로 세우면 가려지고 어깨가 늘어난다: 팔꿈치를 옆으로, 손은 머리 옆 앞쪽으로 든다
    const up = { RightArm: d([R, 1], [U, 0.45], [F, 0.3]), RightForeArm: d([U, 1], [R, 0.2], [F, 0.35]), LeftArm: d([L, 1], [U, 0.45], [F, 0.3]), LeftForeArm: d([U, 1], [L, 0.2], [F, 0.35]) };
    const mid = { RightArm: d([R, 1], [U, 0.2], [F, 0.3]), RightForeArm: d([U, 0.9], [R, 0.35], [F, 0.35]), LeftArm: d([L, 1], [U, 0.2], [F, 0.3]), LeftForeArm: d([U, 0.9], [L, 0.35], [F, 0.35]) };
    made.cheer = makeClip('cheer', [{ t: 0, pose: { aim: up } }, { t: 0.45, pose: { aim: mid } }, { t: 0.9, pose: { aim: up } }], [0, -0.03, 0]);
  }
  // 박수: 팔을 앞으로, 손을 모았다 벌렸다
  {
    const open = { RightArm: d([F, 0.8], [U, -0.45], [R, 0.45]), RightForeArm: d([F, 0.75], [R, 0.55], [U, 0.1]), LeftArm: d([F, 0.8], [U, -0.45], [L, 0.45]), LeftForeArm: d([F, 0.75], [L, 0.55], [U, 0.1]) };
    const shut = { RightArm: d([F, 0.85], [U, -0.4], [R, 0.3]), RightForeArm: d([F, 0.6], [L, 0.75], [U, 0.1]), LeftArm: d([F, 0.85], [U, -0.4], [L, 0.3]), LeftForeArm: d([F, 0.6], [R, 0.75], [U, 0.1]) };
    made.clap = makeClip('clap', [{ t: 0, pose: { aim: open } }, { t: 0.25, pose: { aim: shut } }, { t: 0.5, pose: { aim: open } }]);
  }
  // 안녕: 오른팔을 들고 손을 흔든다
  {
    // 팔꿈치는 옆으로, 손은 얼굴 옆 앞쪽에서 좌우로 흔든다 (머리 뒤로 숨지 않게)
    const arm = d([R, 1], [U, 0.35], [F, 0.35]);
    const a = { aim: { RightArm: arm, RightForeArm: d([U, 1], [R, 0.4], [F, 0.3]) }, turn: { Head: [F, -6] as [V, number] } };
    const b = { aim: { RightArm: arm, RightForeArm: d([U, 1], [L, 0.25], [F, 0.3]) }, turn: { Head: [F, -6] as [V, number] } };
    made.wave = makeClip('wave', [{ t: 0, pose: a }, { t: 0.25, pose: b }, { t: 0.5, pose: a }, { t: 0.75, pose: b }, { t: 1, pose: a }]);
  }
  // 꾸벅: 허리를 숙였다 편다
  {
    const bow: Pose = { aim: armsDown(), turn: { Spine: [X, 12], Spine1: [X, 12], Spine2: [X, 10], Neck: [X, 6], Head: [X, 8] } };
    made.bow = makeClip('bow', [{ t: 0, pose: {} }, { t: 0.35, pose: bow }, { t: 1.0, pose: bow }, { t: 1.4, pose: {} }]);
  }
  // 춤: 몸을 좌우로 흔들며 팔을 번갈아 든다
  {
    const a: Pose = {
      turn: { Hips: [U, 12], Spine: [F, 6] },
      aim: { RightArm: d([R, 1], [U, 0.4], [F, 0.3]), RightForeArm: d([U, 1], [R, 0.2], [F, 0.3]), LeftArm: d([U, -0.5], [L, 0.7], [F, 0.3]), LeftForeArm: d([F, 0.7], [R, 0.3]) },
    };
    const b: Pose = {
      turn: { Hips: [U, -12], Spine: [F, -6] },
      aim: { LeftArm: d([L, 1], [U, 0.4], [F, 0.3]), LeftForeArm: d([U, 1], [L, 0.2], [F, 0.3]), RightArm: d([U, -0.5], [R, 0.7], [F, 0.3]), RightForeArm: d([F, 0.7], [L, 0.3]) },
    };
    made.dance = makeClip('dance', [{ t: 0, pose: a }, { t: 0.5, pose: b }, { t: 1, pose: a }], [0, -0.04, 0]);
  }
  // 폴짝: 팔을 벌려 올렸다 내린다 (몸이 솟는 것은 화면이 한다)
  {
    const lift: Pose = { aim: { RightArm: d([R, 1], [U, 0.35], [F, 0.2]), RightForeArm: d([R, 0.8], [U, 0.6], [F, 0.2]), LeftArm: d([L, 1], [U, 0.35], [F, 0.2]), LeftForeArm: d([L, 0.8], [U, 0.6], [F, 0.2]) } };
    const low: Pose = { aim: { RightArm: d([U, -0.7], [R, 0.5], [F, 0.2]), LeftArm: d([U, -0.7], [L, 0.5], [F, 0.2]) } };
    made.jump = makeClip('jump', [{ t: 0, pose: low }, { t: 0.25, pose: lift }, { t: 0.55, pose: low }, { t: 0.7, pose: low }]);
  }
  // 갸웃: 고개를 기울이고 손을 턱에
  {
    const think = (deg: number): Pose => ({
      turn: { Head: [F, deg] },
      aim: { RightArm: d([F, 0.6], [U, -0.6], [R, 0.35]), RightForeArm: d([U, 0.8], [F, 0.55], [L, 0.2]) },
    });
    made.think = makeClip('think', [{ t: 0, pose: think(12) }, { t: 0.8, pose: think(18) }, { t: 1.6, pose: think(12) }]);
  }
  // 낚시: 두 손으로 낚싯대를 앞으로 든다
  const fishPose = (bob: number): Pose => ({
    aim: {
      RightArm: d([F, 0.85], [U, -0.25], [R, 0.2]),
      RightForeArm: d([F, 0.9], [U, 0.35 + bob], [L, 0.15]),
      LeftArm: d([F, 0.8], [U, -0.4], [L, 0.1]),
      LeftForeArm: d([F, 0.7], [U, 0.2 + bob], [R, 0.6]),
    },
  });
  made.fish = makeClip('fish', [{ t: 0, pose: fishPose(0) }, { t: 0.6, pose: fishPose(0.06) }, { t: 1.2, pose: fishPose(0) }]);

  // 낚싯대: 낚시 자세에서 오른손 자리가 앞위(몸 앞 20°쯤 위)를 향하게 돌려 단다
  let rod: CharacterRig['rod'] = null;
  const hand = scene.getObjectByName(HAND_SOCKET);
  if (hand) {
    apply(fishPose(0));
    const handQ = hand.getWorldQuaternion(new THREE.Quaternion());
    const dir = d([F, 0.94], [U, 0.34]);
    const worldRod = new THREE.Quaternion().setFromUnitVectors(U, dir);
    const quaternion = handQ.invert().multiply(worldRod);
    // 손잡이 아래쪽을 쥔다: 낚싯대 축으로 조금 뒤로
    const position = new THREE.Vector3(0, -0.1, 0).applyQuaternion(quaternion);
    rod = { quaternion, position };
    restoreBase();
  }

  // ── 다리를 굽히는 동작 (쓰다듬기·들기·내려놓기): 굽힌 만큼 엉덩이를 내려 발이 바닥에 닿게 한다 ──
  const feet = ['LeftToeBase', 'RightToeBase', 'LeftFoot', 'RightFoot'].map((n) => scene.getObjectByName(bone(n))).filter(Boolean) as THREE.Object3D[];
  const lowestFoot = () => Math.min(...feet.map((f) => f.getWorldPosition(new THREE.Vector3()).y));
  restoreBase();
  const baseFoot = feet.length ? lowestFoot() : 0;
  const hipsParentScale = hips.parent ? hips.parent.getWorldScale(new THREE.Vector3()).y || 1 : 1;
  /** 자세를 입혔을 때 발이 뜬 만큼 엉덩이를 내리는 값 (엉덩이 부모 좌표) */
  const groundLift = (pose: Pose) => {
    if (!feet.length) return 0;
    apply(pose);
    const lift = -(lowestFoot() - baseFoot) / hipsParentScale;
    restoreBase();
    return lift;
  };
  /** 쪼그려 앉기: deep 0~1 (1 = 무릎을 앞으로 깊게) */
  const squat = (deep: number): NonNullable<Pose['aim']> => {
    const thigh = (r: boolean) => d([F, 0.25 + 0.6 * deep], [U, -1 + 0.35 * deep], [side(r), 0.12]);
    const shin = (r: boolean) => d([U, -1], [F, -0.4 * deep], [side(r), 0.04]);
    return {
      RightUpLeg: thigh(true), RightLeg: shin(true), RightFoot: d([F, 1], [U, -0.25]),
      LeftUpLeg: thigh(false), LeftLeg: shin(false), LeftFoot: d([F, 1], [U, -0.25]),
    };
  };
  const lean = (k: number): NonNullable<Pose['turn']> => ({ Spine: [X, 14 * k], Spine1: [X, 10 * k], Spine2: [X, 6 * k], Head: [X, 10 * k] });
  const withLift = (name: ClipName, keys: Key[]) => makeClip(name, keys, keys.map((k) => groundLift(k.pose)));

  // 쓰다듬기: 쪼그려 앉아 오른손으로 강아지 등을 쓰다듬는다 (왼손은 무릎에)
  {
    const stroke = (fwd: number): Pose => ({
      turn: lean(1.1),
      aim: {
        ...squat(1),
        RightArm: d([F, 0.75], [U, -0.6], [R, 0.12]),
        RightForeArm: d([F, 0.45 + 0.4 * fwd], [U, -0.85 + 0.3 * fwd], [L, 0.08]),
        LeftArm: d([F, 0.45], [U, -0.8], [L, 0.3]),
        LeftForeArm: d([F, 0.95], [U, -0.2], [R, 0.15]),
      },
    });
    made.pet = withLift('pet', [{ t: 0, pose: stroke(0) }, { t: 0.45, pose: stroke(1) }, { t: 0.9, pose: stroke(0) }]);
  }
  // 나르기: 두 팔을 앞으로 들어 물건을 받쳐 든다 (가구가 몸 앞에 떠 있다)
  const holdArms: NonNullable<Pose['aim']> = {
    RightArm: d([F, 0.8], [U, 0.05], [R, 0.35]),
    RightForeArm: d([F, 0.75], [U, 0.35], [L, 0.3]),
    LeftArm: d([F, 0.8], [U, 0.05], [L, 0.35]),
    LeftForeArm: d([F, 0.75], [U, 0.35], [R, 0.3]),
  };
  const carryPose: Pose = { aim: holdArms, turn: { Spine: [X, -4] } };
  made.carry = makeClip('carry', [{ t: 0, pose: carryPose }, { t: 0.6, pose: { aim: holdArms, turn: { Spine: [X, -6] } } }, { t: 1.2, pose: carryPose }]);
  // 들기: 몸을 굽혀 두 손을 아래로 뻗었다가 들어 올린다 (한 번, 0.7초)
  const reachDown: Pose = {
    turn: lean(1.6),
    aim: {
      ...squat(0.7),
      RightArm: d([F, 0.6], [U, -0.8], [R, 0.25]),
      RightForeArm: d([F, 0.7], [U, -0.7], [L, 0.1]),
      LeftArm: d([F, 0.6], [U, -0.8], [L, 0.25]),
      LeftForeArm: d([F, 0.7], [U, -0.7], [R, 0.1]),
    },
  };
  made.lift = withLift('lift', [{ t: 0, pose: {} }, { t: 0.3, pose: reachDown }, { t: 0.7, pose: carryPose }]);
  // 내려놓기: 든 채로 몸을 굽혀 내려놓고 일어선다 (한 번, 0.8초)
  made.place = withLift('place', [{ t: 0, pose: carryPose }, { t: 0.4, pose: reachDown }, { t: 0.8, pose: {} }]);
  // 들고 걷기: 걷기 동작에서 팔만 나르기 자세로 (어깨 아래 뼈를 바꾼다)
  const walkSrc = have('walk');
  if (walkSrc) {
    apply(carryPose);
    const armBones = new Set<string>();
    for (const lr of ['Left', 'Right']) scene.getObjectByName(bone(`${lr}Shoulder`))?.traverse((o) => void ((o as THREE.Bone).isBone && armBones.add(o.name)));
    const held = new Map([...armBones].map((n) => [n, scene.getObjectByName(n)!.quaternion.toArray()]));
    restoreBase();
    const dur = walkSrc.duration;
    const tracks = walkSrc.tracks.filter((tr) => !armBones.has(tr.name.split('.')[0]));
    for (const [n, q] of held) tracks.push(new THREE.QuaternionKeyframeTrack(`${n}.quaternion`, [0, dur], [...q, ...q]));
    made.carryWalk = new THREE.AnimationClip('carryWalk', dur, tracks);
  }

  const clips = Object.fromEntries(CHARACTER_CLIPS.map((n) => [n, have(n) ?? made[n] ?? idle])) as Record<ClipName, THREE.AnimationClip>;
  return { clips, rod };
}

/**
 * 캐릭터 하나를 복제한다. 먼저 동작을 만들어(characterRig) 원본 뼈를 서 있기 자세로 둔 뒤에 복제한다.
 * (먼저 복제하면 복제본이 팔 벌린 T자를 '원래 자세'로 기억해, 동작을 멈출 때 T자로 돌아간다)
 */
export function cloneCharacter(gltf: GLTF): THREE.Object3D {
  characterRig(gltf);
  return SkeletonUtils.clone(gltf.scene);
}

/** 모델을 키(height, 칸)에 맞춰 키운다 (펫처럼 뼈 없는 모델. 발바닥이 원점에 있다고 본다) */
export function fitHeight(model: THREE.Object3D, height: number) {
  model.scale.setScalar(1);
  model.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  if (size.y > 0) model.scale.setScalar(height / size.y);
}

/** 펫 걷기 동작을 빠르게 돌리는 상한 (배) */
const PET_WALK_MAX_RATE = 1.6;

/**
 * 펫 하나: 모델을 복제해 키(height, 칸)에 맞추고, 걷기·서 있기 동작을 건다 (뼈대 없는 모델이면 동작 없이 그대로).
 * update(dt, speed): 움직이는 빠르기(칸/초)에 맞춰 걷기·서 있기를 고르고, 걸음 빠르기를 맞춘다.
 */
export function petInstance(gltf: GLTF, height: number) {
  const model = SkeletonUtils.clone(gltf.scene);
  fitHeight(model, height);
  model.traverse((o) => void ((o as THREE.Mesh).isMesh && ((o as THREE.Mesh).castShadow = true)));
  const mixer = new THREE.AnimationMixer(model);
  const action = (name: string) => {
    const clip = gltf.animations.find((a) => a.name === name);
    return clip ? mixer.clipAction(clip) : null;
  };
  const idle = action('idle');
  const walk = action('walk');
  const poses: Record<PetPose, THREE.AnimationAction | null> = { sit: action('sit'), lie: action('lie'), happy: action('happy'), paw: action('paw') };
  let playing: THREE.AnimationAction | null = idle;
  let posing: PetPose | null = null;
  /** 지금 동작에서 next로 부드럽게 넘어간다 */
  const fadeTo = (next: THREE.AnimationAction | null, sec: number) => {
    if (!next || next === playing) return;
    next.reset().play();
    if (playing) playing.crossFadeTo(next, sec, false);
    playing = next;
  };
  return {
    model,
    /** 다리로 걷는 동작이 있다 (없으면 화면이 통통 튀게 움직인다) */
    animated: !!(idle && walk),
    /** 쓰다듬으면 하는 동작(앉기·눕기·좋아하기)이 있다 */
    canPose: !!(poses.sit && poses.lie && poses.happy),
    /** 자세를 잡는다 (null = 다시 서 있기·걷기). 자세를 잡는 동안에는 update의 빠르기를 보지 않는다 */
    pose(name: PetPose | null) {
      if (name === posing) return;
      posing = name;
      fadeTo(name ? poses[name] : idle, name === 'happy' ? 0.25 : 0.4);
    },
    update(dt: number, speed: number) {
      if (idle && walk && !posing) {
        fadeTo(speed > 0.15 ? walk : idle, 0.2);
        // 빠를수록 다리를 조금 더 빨리 놀린다. 너무 빨리 놀리면 다다닥거려 보여서 1.6배까지만
        walk.timeScale = Math.min(PET_WALK_MAX_RATE, Math.max(0.6, speed / (height * 1.4)));
      }
      mixer.update(dt);
    },
    /** 붙을 때마다 서 있기부터 (개발 모드의 붙였다 뗐다에도 멈추지 않게) */
    restart() {
      mixer.stopAllAction();
      idle?.reset().play();
      playing = idle;
      posing = null;
    },
    stop() {
      mixer.stopAllAction();
    },
    /** 목걸이 (친밀도 마지막 단계): 머리 뼈에 고리를 단다 */
    setCollar(on: boolean, color: string) {
      const head = model.getObjectByName('dog_head');
      if (!head) return;
      let ring = head.getObjectByName('pet_collar');
      if (!on) {
        if (ring) head.remove(ring);
        return;
      }
      if (!ring) {
        ring = new THREE.Group();
        ring.name = 'pet_collar';
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
        const band = new THREE.Mesh(new THREE.TorusGeometry(PET_COLLAR.radius, PET_COLLAR.tube, 8, 24), mat);
        const tag = new THREE.Mesh(new THREE.SphereGeometry(PET_COLLAR.tube * 1.8, 10, 8), new THREE.MeshStandardMaterial({ color: '#F2C14E', metalness: 0.4, roughness: 0.3 }));
        tag.position.set(0, -PET_COLLAR.radius, PET_COLLAR.tube);
        ring.add(band, tag);
        ring.position.set(0, PET_COLLAR.y, PET_COLLAR.z);
        ring.rotation.x = PET_COLLAR.tilt;
        head.add(ring);
      }
      ((ring.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.set(color);
    },
  };
}

/** 목걸이 자리 (강아지 모델 단위, 머리 뼈 기준): 고리 반지름·굵기, 높이·앞뒤, 기울기 */
const PET_COLLAR = { radius: 0.075, tube: 0.012, y: -0.02, z: -0.02, tilt: -Math.PI / 4 };

export type PetInstance = ReturnType<typeof petInstance>;

/**
 * 펫 털을 그늘에서도 밝게: 색 텍스처를 빛나는 텍스처로도 써서 밝은 털만 조금 스스로 빛나게 한다
 * (눈·코처럼 어두운 곳은 그대로 어둡다). 받은 원본에 한 번만 (복제본은 재질을 같이 쓴다)
 */
export function brightenFur(model: THREE.Object3D, amount = 0.28) {
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of [mesh.material].flat() as THREE.MeshStandardMaterial[]) {
      if (!m.map || !('emissive' in m)) continue;
      m.emissiveMap = m.map;
      m.emissive.setScalar(amount);
      m.needsUpdate = true;
    }
  });
}

/** 머리 소품을 단다: 안경은 눈 높이 자리, 나머지는 머리 가운데 자리 */
export function attachAccessory(model: THREE.Object3D, accessoryId: string, prop: THREE.Object3D) {
  const def = ACCESSORIES.find((a) => a.id === accessoryId);
  const eyes = def && 'socket' in def && def.socket === 'eyes' ? model.getObjectByName(EYES_SOCKET) : null;
  (eyes ?? model.getObjectByName(HEAD_SOCKET))?.add(prop);
}

/**
 * 동작의 윗팔 회전에 '몸 앞쪽 축으로 바깥쪽 deg도'를 더한다 (원본 동작을 그 자리에서 고친다, 모델마다 한 번).
 * 어깨 뼈의 방향은 선 자세 기준으로 본다 (서 있기·걷기에서 어깨는 거의 움직이지 않는다).
 */
function spreadArms(scene: THREE.Object3D, clip: THREE.AnimationClip, deg: number) {
  scene.updateMatrixWorld(true);
  const forward = new THREE.Vector3(0, 0, 1);
  for (const side of ['Left', 'Right']) {
    const arm = scene.getObjectByName(bone(`${side}Arm`));
    const track = clip.tracks.find((t) => t.name === `${arm?.name}.quaternion`);
    if (!arm?.parent || !track) continue;
    // 팔이 +X 쪽이면 +각도로 돌려야 아래로 늘어진 팔이 바깥(+X)으로 간다
    const sign = Math.sign(arm.getWorldPosition(new THREE.Vector3()).x) || 1;
    const p = arm.parent.getWorldQuaternion(new THREE.Quaternion());
    const r = new THREE.Quaternion().setFromAxisAngle(forward, THREE.MathUtils.degToRad(deg * sign));
    const c = p.clone().invert().multiply(r).multiply(p);
    const q = new THREE.Quaternion();
    for (let i = 0; i < track.values.length; i += 4) {
      q.fromArray(track.values, i).premultiply(c).normalize();
      q.toArray(track.values, i);
    }
  }
}

/** 동작 클립들을 믹서에 건다. 걷기는 빠르기를 맞춘다 */
export function characterActions(gltf: GLTF, mixer: THREE.AnimationMixer, names: readonly ClipName[] = CHARACTER_CLIPS) {
  const { clips } = characterRig(gltf);
  const actions = Object.fromEntries(names.map((n) => [n, mixer.clipAction(clips[n])])) as Record<ClipName, THREE.AnimationAction>;
  if (actions.walk) actions.walk.timeScale = WALK_TIME_SCALE;
  return actions;
}

// ───────────────────────── 옷 색·머리 색·피부색 ─────────────────────────

const TINT_KEY = 'outfit-tint';

/** 머리 색·피부색 (없거나 null이면 모델 원래 색) */
export interface BodyTint {
  hair?: string | null;
  skin?: string | null;
}

/** 저장된 피부색·머리 색 id (avatar.ts) → 입힐 색. natural·모르는 값은 null (원래 색) */
export function bodyTintOf(look: { skin?: string | null; hair?: string | null }): BodyTint {
  const skin = isSkinTone(look.skin) && look.skin !== 'natural' ? tokens.avatarSkin[look.skin] : null;
  const hair = isHairColor(look.hair) && look.hair !== 'natural' ? tokens.avatarHair[look.hair] : null;
  return { skin, hair };
}

/** 머리·살 자리 텍스처가 없는 재질용 (모두 0 = 바꾸지 않는다) */
let noRegions: THREE.DataTexture | null = null;
function emptyRegions(): THREE.DataTexture {
  if (!noRegions) {
    noRegions = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    noRegions.needsUpdate = true;
  }
  return noRegions;
}

/**
 * 옷 재질에 색을 입힌다 (재질을 복제한다). 새 모델: 티셔츠 자리에만, 밝기 무늬는 살린다.
 * 머리 색·피부색을 주면 머리카락·살 자리에도 입힌다. 자리는 발광 텍스처 칸에 담긴 자리 텍스처(R 머리, G 살, B 티셔츠,
 * scripts/import-characters.ts)에서 읽는다. 자리 텍스처가 없는 예전 모델은 티셔츠 자리를 색 텍스처 알파에서 읽는다
 * (아이폰 브라우저는 알파 0인 칸의 색을 버려 검게 그리므로 새 모델은 알파를 쓰지 않는다).
 * 예전 임시 모델(티셔츠 표시가 없음): 재질 색을 바꾼다. 복제한 재질 목록을 돌려준다 (정리할 때 dispose).
 */
export function tintOutfit(root: THREE.Object3D, color: string, body?: BodyTint): THREE.Material[] {
  const made: THREE.Material[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (mat.name !== TINT_MATERIAL) return;
    const m = mat.clone();
    const extras = mat.userData as { shirtLum?: number; hairLum?: number; skinLum?: number };
    if (typeof extras.shirtLum === 'number' && m.map) {
      const tint = new THREE.Color(color);
      // 텍스처는 화면에서 선형 색으로 풀리므로 기준 밝기도 선형으로 바꾼다
      const base = Math.pow(extras.shirtLum, 2.2);
      // 머리·살 자리: 값 그대로 읽는다 (색 공간 변환을 하면 경계 값이 바뀐다). 그리는 데는 쓰지 않는다
      const regions = m.emissiveMap;
      if (regions && regions.colorSpace !== THREE.NoColorSpace) {
        regions.colorSpace = THREE.NoColorSpace;
        regions.needsUpdate = true;
      }
      m.emissiveMap = null;
      const hairOn = !!(body?.hair && regions && extras.hairLum);
      const skinOn = !!(body?.skin && regions && extras.skinLum);
      const uniforms = {
        uTint: { value: tint },
        uShirtLum: { value: base },
        uRegions: { value: regions ?? emptyRegions() },
        uHasRegions: { value: regions ? 1 : 0 },
        uHair: { value: new THREE.Color(hairOn ? body!.hair! : '#000000') },
        uHairLum: { value: extras.hairLum || 1 },
        uHairOn: { value: hairOn ? 1 : 0 },
        uSkin: { value: new THREE.Color(skinOn ? body!.skin! : '#000000') },
        uSkinLum: { value: extras.skinLum || 1 },
        uSkinOn: { value: skinOn ? 1 : 0 },
      };
      m.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
uniform vec3 uTint;
uniform float uShirtLum;
uniform sampler2D uRegions;
uniform float uHasRegions;
uniform vec3 uHair;
uniform float uHairLum;
uniform float uHairOn;
uniform vec3 uSkin;
uniform float uSkinLum;
uniform float uSkinOn;`,
          )
          .replace(
            '#include <map_fragment>',
            `#include <map_fragment>
#ifdef USE_MAP
  float lumNow = dot( sampledDiffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  vec3 regionTex = texture2D( uRegions, vMapUv ).rgb;
  float shirtMix = uHasRegions > 0.5 ? regionTex.b : sampledDiffuseColor.a;
  vec3 shirtTinted = uTint * clamp( lumNow / uShirtLum, 0.55, 1.2 );
  diffuseColor.rgb = mix( diffuseColor.rgb, shirtTinted, shirtMix );
  vec2 regionMix = regionTex.rg * vec2( uHairOn, uSkinOn );
  diffuseColor.rgb = mix( diffuseColor.rgb, uHair * clamp( lumNow / uHairLum, 0.5, 1.6 ), regionMix.r );
  diffuseColor.rgb = mix( diffuseColor.rgb, uSkin * clamp( lumNow / uSkinLum, 0.6, 1.25 ), regionMix.g );
  diffuseColor.a = 1.0;
#endif`,
          );
      };
      m.customProgramCacheKey = () => TINT_KEY;
    } else {
      m.color.set(color);
    }
    mesh.material = m;
    made.push(m);
  });
  return made;
}

// ───────────────────────── 표정 ─────────────────────────

/** 얼굴 재질을 복제해 표정을 바꿀 수 있게 한다. 얼굴이 없는 모델이면 null */
export function faceControl(root: THREE.Object3D): { set: (face: FaceName) => void; dispose: () => void } | null {
  let mesh: THREE.Mesh | null = null;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && (m.material as THREE.Material).name === FACE_MATERIAL) mesh = m;
  });
  if (!mesh) return null;
  const faceMesh = mesh as THREE.Mesh;
  const mat = (faceMesh.material as THREE.MeshStandardMaterial).clone();
  const map = mat.map ? mat.map.clone() : null;
  mat.map = map;
  // 피부 위에 얹는 그림: 투명하게, 깊이는 쓰지 않고, 피부보다 앞에 그린다
  mat.transparent = true;
  mat.depthWrite = false;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -2;
  faceMesh.material = mat;
  faceMesh.castShadow = false;
  faceMesh.renderOrder = 1;
  let current: FaceName | null = null;
  const set = (face: FaceName) => {
    if (face === current || !map) return;
    current = face;
    const [u, v] = faceOffset(face);
    map.offset.set(u, v);
  };
  set('neutral');
  return {
    set,
    dispose: () => {
      map?.dispose();
      mat.dispose();
    },
  };
}
