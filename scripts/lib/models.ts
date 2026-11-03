// 임시 3D 에셋(GLB)을 코드로 만든다. three.js 도형을 합쳐 glTF로 저장한다.
// 정점 색(COLOR_0)으로 색을 칠하고, 재질은 이름별로 하나씩만 만들어 그리기 호출을 줄인다.
import { Document, NodeIO, type Node as GNode } from '@gltf-transform/core';
import * as THREE from 'three';
import { CHARACTER_CLIPS, HEAD_SOCKET, TINT_MATERIAL, type ClipName } from '../../src/shared/character';

type Vec3 = [number, number, number];

export interface Part {
  geo: THREE.BufferGeometry;
  color: string;
  mat: string;
  joint?: string;
}

export interface MaterialSpec {
  roughness?: number;
  metallic?: number;
  emissive?: Vec3;
  doubleSided?: boolean;
  baseColor?: [number, number, number, number];
}

/** 도형 하나를 위치·회전(도)·크기와 함께 부품으로 만든다 */
export function part(
  geo: THREE.BufferGeometry,
  color: string,
  o: { pos?: Vec3; rot?: Vec3; scale?: Vec3; mat?: string; joint?: string } = {},
): Part {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...(o.pos ?? [0, 0, 0])),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...((o.rot ?? [0, 0, 0]).map(THREE.MathUtils.degToRad) as Vec3))),
    new THREE.Vector3(...(o.scale ?? [1, 1, 1])),
  );
  const g = geo.clone().applyMatrix4(m);
  return { geo: g, color, mat: o.mat ?? 'base', joint: o.joint };
}

function merged(parts: Part[], jointIndex?: Map<string, number>) {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const jnt: number[] = [];
  const wgt: number[] = [];
  const idx: number[] = [];
  for (const p of parts) {
    const g = p.geo;
    const P = g.attributes.position;
    const N = g.attributes.normal;
    const base = pos.length / 3;
    const c = new THREE.Color(p.color); // 선형 색 공간 값 (glTF 정점 색 규칙)
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i));
      const n = new THREE.Vector3(N.getX(i), N.getY(i), N.getZ(i)).normalize();
      nor.push(n.x, n.y, n.z);
      col.push(c.r, c.g, c.b);
      if (jointIndex) {
        jnt.push(jointIndex.get(p.joint ?? 'root')!, 0, 0, 0);
        wgt.push(1, 0, 0, 0);
      }
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(base + g.index.getX(i));
    else for (let i = 0; i < P.count; i++) idx.push(base + i);
  }
  return { pos, nor, col, jnt, wgt, idx };
}

class GlbBuilder {
  readonly doc = new Document();
  readonly buffer = this.doc.createBuffer();
  readonly scene = this.doc.createScene();
  private readonly materials = new Map<string, ReturnType<Document['createMaterial']>>();

  constructor(private readonly specs: Record<string, MaterialSpec>) {}

  acc(type: 'SCALAR' | 'VEC3' | 'VEC4' | 'MAT4', array: Float32Array | Uint16Array | Uint32Array | Uint8Array) {
    return this.doc.createAccessor().setType(type).setArray(array).setBuffer(this.buffer);
  }

  material(name: string) {
    let m = this.materials.get(name);
    if (!m) {
      const s = this.specs[name] ?? {};
      m = this.doc
        .createMaterial(name)
        .setBaseColorFactor(s.baseColor ?? [1, 1, 1, 1])
        .setRoughnessFactor(s.roughness ?? 0.8)
        .setMetallicFactor(s.metallic ?? 0)
        .setDoubleSided(s.doubleSided ?? false);
      if (s.emissive) m.setEmissiveFactor(s.emissive);
      this.materials.set(name, m);
    }
    return m;
  }

  mesh(name: string, parts: Part[], jointIndex?: Map<string, number>) {
    const mesh = this.doc.createMesh(name);
    const byMat = new Map<string, Part[]>();
    for (const p of parts) byMat.set(p.mat, [...(byMat.get(p.mat) ?? []), p]);
    for (const [mat, ps] of byMat) {
      const m = merged(ps, jointIndex);
      const prim = this.doc
        .createPrimitive()
        .setAttribute('POSITION', this.acc('VEC3', new Float32Array(m.pos)))
        .setAttribute('NORMAL', this.acc('VEC3', new Float32Array(m.nor)))
        .setAttribute('COLOR_0', this.acc('VEC3', new Float32Array(m.col)))
        .setIndices(this.acc('SCALAR', m.pos.length / 3 > 65535 ? new Uint32Array(m.idx) : new Uint16Array(m.idx)))
        .setMaterial(this.material(mat));
      if (jointIndex) {
        prim.setAttribute('JOINTS_0', this.acc('VEC4', new Uint8Array(m.jnt)));
        prim.setAttribute('WEIGHTS_0', this.acc('VEC4', new Float32Array(m.wgt)));
      }
      mesh.addPrimitive(prim);
    }
    return mesh;
  }

  async write(): Promise<Uint8Array> {
    return new NodeIO().writeBinary(this.doc);
  }
}

/** 움직이지 않는 소품. 원점 = 바닥 가운데, 정면 = +Z */
export async function buildStatic(name: string, parts: Part[], specs: Record<string, MaterialSpec> = {}) {
  const b = new GlbBuilder(specs);
  b.scene.addChild(b.doc.createNode(name).setMesh(b.mesh(name, parts)));
  return b.write();
}

// ───────────────────────── 캐릭터 ─────────────────────────

interface JointDef {
  name: string;
  parent: string | null;
  /** 부모 기준 위치 */
  t: Vec3;
}

type Key = { rot?: Vec3; move?: Vec3 };
/** 클립: 관절 → 시각별 자세. 회전은 도, 이동은 기본 자세에서 더하는 값 */
type ClipDef = { duration: number; times: number[]; tracks: Record<string, Key[]> };

export interface SkinnedSpec {
  joints: JointDef[];
  /** 소켓 노드 (관절 아님): 이름 → 부모 관절과 위치 */
  sockets: Record<string, { parent: string; t: Vec3 }>;
  parts: Part[];
  clips: Record<ClipName, ClipDef>;
  materials: Record<string, MaterialSpec>;
}

export async function buildSkinned(name: string, spec: SkinnedSpec) {
  const b = new GlbBuilder(spec.materials);
  const nodes = new Map<string, GNode>();
  const world = new Map<string, THREE.Vector3>();
  for (const j of spec.joints) {
    const n = b.doc.createNode(j.name).setTranslation(j.t);
    nodes.set(j.name, n);
    const w = new THREE.Vector3(...j.t);
    if (j.parent) {
      nodes.get(j.parent)!.addChild(n);
      w.add(world.get(j.parent)!);
    } else {
      b.scene.addChild(n);
    }
    world.set(j.name, w);
  }
  for (const [sname, s] of Object.entries(spec.sockets)) {
    nodes.get(s.parent)!.addChild(b.doc.createNode(sname).setTranslation(s.t));
  }

  const jointIndex = new Map(spec.joints.map((j, i) => [j.name, i]));
  const ibm = new Float32Array(spec.joints.length * 16);
  spec.joints.forEach((j, i) => {
    const w = world.get(j.name)!;
    ibm.set(new THREE.Matrix4().makeTranslation(-w.x, -w.y, -w.z).toArray(), i * 16);
  });
  const skin = b.doc.createSkin(`${name}_skin`).setSkeleton(nodes.get(spec.joints[0].name)!).setInverseBindMatrices(b.acc('MAT4', ibm));
  for (const j of spec.joints) skin.addJoint(nodes.get(j.name)!);
  b.scene.addChild(b.doc.createNode(name).setMesh(b.mesh(name, spec.parts, jointIndex)).setSkin(skin));

  for (const clip of CHARACTER_CLIPS) {
    const def = spec.clips[clip];
    const anim = b.doc.createAnimation(clip);
    const input = b.acc('SCALAR', new Float32Array(def.times));
    for (const [jname, keys] of Object.entries(def.tracks)) {
      const node = nodes.get(jname)!;
      const bind = spec.joints.find((j) => j.name === jname)!.t;
      if (keys.some((k) => k.rot)) {
        const q: number[] = [];
        for (const k of keys) {
          const r = (k.rot ?? [0, 0, 0]).map(THREE.MathUtils.degToRad) as Vec3;
          q.push(...new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)).toArray());
        }
        const sampler = b.doc.createAnimationSampler().setInput(input).setOutput(b.acc('VEC4', new Float32Array(q))).setInterpolation('LINEAR');
        anim.addSampler(sampler).addChannel(b.doc.createAnimationChannel().setTargetNode(node).setTargetPath('rotation').setSampler(sampler));
      }
      if (keys.some((k) => k.move)) {
        const v: number[] = [];
        for (const k of keys) {
          const m = k.move ?? [0, 0, 0];
          v.push(bind[0] + m[0], bind[1] + m[1], bind[2] + m[2]);
        }
        const sampler = b.doc.createAnimationSampler().setInput(input).setOutput(b.acc('VEC3', new Float32Array(v))).setInterpolation('LINEAR');
        anim.addSampler(sampler).addChannel(b.doc.createAnimationChannel().setTargetNode(node).setTargetPath('translation').setSampler(sampler));
      }
    }
  }
  return b.write();
}

// ───────────────────────── 임시 캐릭터 디자인 ─────────────────────────

const C = {
  skin: '#FFE1C8',
  hair: '#6E4126',
  eye: '#2A2130',
  eyeLight: '#FFFFFF',
  blush: '#FF9DA6',
  nose: '#FFB89A',
  mouth: '#7A3338',
  pants: '#3F4664',
  shoe: '#7A5642',
  white: '#FFFFFF',
};

const sphere = (r: number, w = 18, h = 12) => new THREE.SphereGeometry(r, w, h);
const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 4, 12);

/** 큰 머리 장난감 같은 베이스 캐릭터. 키 약 1.32, 원점 = 발 가운데, 정면 = +Z */
export function chibiCharacterSpec(): SkinnedSpec {
  const HEAD_C: Vec3 = [0, 0.98, 0];
  const HEAD_S: Vec3 = [1, 0.93, 0.95];
  const parts: Part[] = [];
  for (const s of [1, -1]) {
    const leg = s > 0 ? 'legL' : 'legR';
    const arm = s > 0 ? 'armL' : 'armR';
    parts.push(
      part(capsule(0.072, 0.13), C.pants, { pos: [0.095 * s, 0.18, 0], joint: leg }),
      part(sphere(0.085), C.shoe, { pos: [0.095 * s, 0.055, 0.025], scale: [1, 0.7, 1.3], joint: leg }),
      part(capsule(0.056, 0.1), C.white, { pos: [0.215 * s, 0.52, 0], rot: [0, 0, 14 * s], mat: TINT_MATERIAL, joint: arm }),
      part(sphere(0.06), C.skin, { pos: [0.235 * s, 0.41, 0.005], joint: arm }),
      // 얼굴
      part(sphere(1, 14, 10), C.eye, { pos: [0.115 * s, 0.985, 0.282], scale: [0.042, 0.062, 0.03], joint: 'head' }),
      part(sphere(0.016, 10, 8), C.eyeLight, { pos: [0.103 * s, 1.008, 0.309], joint: 'head' }),
      part(sphere(1, 12, 8), C.blush, { pos: [0.19 * s, 0.9, 0.236], rot: [0, 38 * s, 0], scale: [0.056, 0.03, 0.014], joint: 'head' }),
    );
  }
  parts.push(
    // 몸 (유형 색 옷)
    part(sphere(1, 22, 14), C.white, { pos: [0, 0.47, 0], scale: [0.21, 0.2, 0.17], mat: TINT_MATERIAL, joint: 'body' }),
    part(new THREE.CylinderGeometry(0.2, 0.17, 0.06, 24), C.white, { pos: [0, 0.32, 0], scale: [1, 1, 0.82], mat: TINT_MATERIAL, joint: 'body' }),
    // 머리
    part(sphere(0.33, 28, 20), C.skin, { pos: HEAD_C, scale: HEAD_S, joint: 'head' }),
    part(sphere(0.026, 12, 10), C.nose, { pos: [0, 0.925, 0.308], scale: [1.1, 0.85, 0.8], joint: 'head' }),
    part(new THREE.TorusGeometry(0.034, 0.0085, 6, 16, Math.PI), C.mouth, { pos: [0, 0.878, 0.292], rot: [-8, 0, 180], joint: 'head' }),
    // 단발머리: 정수리 덮개 + 앞을 비운 옆·뒷머리
    part(new THREE.SphereGeometry(0.348, 28, 10, 0, Math.PI * 2, 0, 1.12), C.hair, { pos: [0, 0.995, -0.004], scale: HEAD_S, joint: 'head' }),
    part(new THREE.SphereGeometry(0.348, 24, 8, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 1.12, 1.0), C.hair, {
      pos: [0, 0.995, -0.004], scale: HEAD_S, joint: 'head',
    }),
  );

  const z: Vec3 = [0, 0, 0];
  const r = (x: number, y: number, zz: number): Key => ({ rot: [x, y, zz] });
  const m = (y: number): Key => ({ move: [0, y, 0] });
  return {
    joints: [
      { name: 'root', parent: null, t: [0, 0, 0] },
      { name: 'hips', parent: 'root', t: [0, 0.3, 0] },
      { name: 'legL', parent: 'hips', t: [0.095, 0, 0] },
      { name: 'legR', parent: 'hips', t: [-0.095, 0, 0] },
      { name: 'body', parent: 'hips', t: [0, 0.02, 0] },
      { name: 'armL', parent: 'body', t: [0.19, 0.28, 0] },
      { name: 'armR', parent: 'body', t: [-0.19, 0.28, 0] },
      { name: 'head', parent: 'body', t: [0, 0.36, 0] },
    ],
    sockets: { [HEAD_SOCKET]: { parent: 'head', t: [0, 0.3, 0] } },
    parts,
    materials: {
      base: { roughness: 0.62, doubleSided: true },
      [TINT_MATERIAL]: { roughness: 0.72 },
    },
    clips: {
      idle: {
        duration: 2,
        times: [0, 1, 2],
        tracks: {
          hips: [m(0), m(-0.012), m(0)],
          body: [r(0, 0, 0), r(2, 0, 0), r(0, 0, 0)],
          head: [r(0, 0, -3), r(-2, 0, 3), r(0, 0, -3)],
          armL: [r(0, 0, 6), r(0, 0, 10), r(0, 0, 6)],
          armR: [r(0, 0, -6), r(0, 0, -10), r(0, 0, -6)],
          legL: [{ rot: z }, { rot: z }, { rot: z }],
          legR: [{ rot: z }, { rot: z }, { rot: z }],
        },
      },
      walk: {
        duration: 0.64,
        times: [0, 0.16, 0.32, 0.48, 0.64],
        tracks: {
          hips: [m(0), m(0.035), m(0), m(0.035), m(0)],
          body: [r(5, 0, 3), r(5, 0, 0), r(5, 0, -3), r(5, 0, 0), r(5, 0, 3)],
          head: [r(-3, 0, -2), r(-3, 0, 0), r(-3, 0, 2), r(-3, 0, 0), r(-3, 0, -2)],
          legL: [r(32, 0, 0), r(0, 0, 0), r(-32, 0, 0), r(0, 0, 0), r(32, 0, 0)],
          legR: [r(-32, 0, 0), r(0, 0, 0), r(32, 0, 0), r(0, 0, 0), r(-32, 0, 0)],
          armL: [r(-28, 0, 6), r(0, 0, 6), r(28, 0, 6), r(0, 0, 6), r(-28, 0, 6)],
          armR: [r(28, 0, -6), r(0, 0, -6), r(-28, 0, -6), r(0, 0, -6), r(28, 0, -6)],
        },
      },
      cheer: {
        duration: 0.9,
        times: [0, 0.225, 0.45, 0.675, 0.9],
        tracks: {
          hips: [m(0), m(0.1), m(0), m(0.1), m(0)],
          body: [r(0, 0, 0), r(-4, 0, 0), r(0, 0, 0), r(-4, 0, 0), r(0, 0, 0)],
          head: [r(-6, 0, 0), r(-11, 0, 0), r(-6, 0, 0), r(-11, 0, 0), r(-6, 0, 0)],
          armL: [r(0, 0, 122), r(0, 0, 148), r(0, 0, 122), r(0, 0, 148), r(0, 0, 122)],
          armR: [r(0, 0, -122), r(0, 0, -148), r(0, 0, -122), r(0, 0, -148), r(0, 0, -122)],
          legL: [r(0, 0, 0), r(-18, 0, 0), r(0, 0, 0), r(-18, 0, 0), r(0, 0, 0)],
          legR: [r(0, 0, 0), r(-18, 0, 0), r(0, 0, 0), r(-18, 0, 0), r(0, 0, 0)],
        },
      },
      clap: {
        duration: 0.6,
        times: [0, 0.15, 0.3, 0.45, 0.6],
        tracks: {
          hips: [m(0), m(0.012), m(0), m(0.012), m(0)],
          body: [r(0, 0, 0), r(2, 0, 0), r(0, 0, 0), r(2, 0, 0), r(0, 0, 0)],
          head: [r(0, 0, 0), r(4, 0, 0), r(0, 0, 0), r(4, 0, 0), r(0, 0, 0)],
          armL: [r(-80, 0, -28), r(-80, 0, -52), r(-80, 0, -28), r(-80, 0, -52), r(-80, 0, -28)],
          armR: [r(-80, 0, 28), r(-80, 0, 52), r(-80, 0, 28), r(-80, 0, 52), r(-80, 0, 28)],
          legL: [{ rot: z }, { rot: z }, { rot: z }, { rot: z }, { rot: z }],
          legR: [{ rot: z }, { rot: z }, { rot: z }, { rot: z }, { rot: z }],
        },
      },
      // 안녕: 오른팔을 들고 좌우로 흔든다
      wave: {
        duration: 0.8,
        times: [0, 0.2, 0.4, 0.6, 0.8],
        tracks: {
          hips: [m(0), m(0.01), m(0), m(0.01), m(0)],
          body: [r(0, 0, -3), r(0, 0, -5), r(0, 0, -3), r(0, 0, -5), r(0, 0, -3)],
          head: [r(-4, 0, 6), r(-4, 0, 9), r(-4, 0, 6), r(-4, 0, 9), r(-4, 0, 6)],
          armL: [r(0, 0, 8), r(0, 0, 8), r(0, 0, 8), r(0, 0, 8), r(0, 0, 8)],
          armR: [r(0, 0, -150), r(0, 0, -122), r(0, 0, -150), r(0, 0, -122), r(0, 0, -150)],
          legL: [{ rot: z }, { rot: z }, { rot: z }, { rot: z }, { rot: z }],
          legR: [{ rot: z }, { rot: z }, { rot: z }, { rot: z }, { rot: z }],
        },
      },
      // 꾸벅: 허리를 숙여 인사한다
      bow: {
        duration: 1.6,
        times: [0, 0.35, 0.85, 1.2, 1.6],
        tracks: {
          hips: [m(0), m(-0.02), m(-0.02), m(0), m(0)],
          body: [r(0, 0, 0), r(38, 0, 0), r(38, 0, 0), r(0, 0, 0), r(0, 0, 0)],
          head: [r(0, 0, 0), r(16, 0, 0), r(16, 0, 0), r(0, 0, 0), r(0, 0, 0)],
          armL: [r(0, 0, 6), r(-12, 0, 4), r(-12, 0, 4), r(0, 0, 6), r(0, 0, 6)],
          armR: [r(0, 0, -6), r(-12, 0, -4), r(-12, 0, -4), r(0, 0, -6), r(0, 0, -6)],
          legL: [{ rot: z }, { rot: z }, { rot: z }, { rot: z }, { rot: z }],
          legR: [{ rot: z }, { rot: z }, { rot: z }, { rot: z }, { rot: z }],
        },
      },
      // 춤: 몸을 흔들며 두 팔을 번갈아 든다
      dance: {
        duration: 0.8,
        times: [0, 0.2, 0.4, 0.6, 0.8],
        tracks: {
          hips: [m(0), m(0.05), m(0), m(0.05), m(0)],
          body: [r(0, 12, 9), r(0, 0, 0), r(0, -12, -9), r(0, 0, 0), r(0, 12, 9)],
          head: [r(0, 0, -9), r(-4, 0, 0), r(0, 0, 9), r(-4, 0, 0), r(0, 0, -9)],
          armL: [r(0, 0, 135), r(0, 0, 70), r(0, 0, 30), r(0, 0, 70), r(0, 0, 135)],
          armR: [r(0, 0, -30), r(0, 0, -70), r(0, 0, -135), r(0, 0, -70), r(0, 0, -30)],
          legL: [r(-14, 0, 0), r(0, 0, 0), r(0, 0, 0), r(0, 0, 0), r(-14, 0, 0)],
          legR: [r(0, 0, 0), r(0, 0, 0), r(-14, 0, 0), r(0, 0, 0), r(0, 0, 0)],
        },
      },
      // 폴짝: 웅크렸다가 뛰어오른다
      jump: {
        duration: 0.7,
        times: [0, 0.15, 0.35, 0.55, 0.7],
        tracks: {
          hips: [m(0), m(-0.07), m(0.3), m(0.02), m(0)],
          body: [r(0, 0, 0), r(10, 0, 0), r(-6, 0, 0), r(4, 0, 0), r(0, 0, 0)],
          head: [r(0, 0, 0), r(6, 0, 0), r(-10, 0, 0), r(0, 0, 0), r(0, 0, 0)],
          armL: [r(0, 0, 8), r(20, 0, 20), r(0, 0, 110), r(0, 0, 40), r(0, 0, 8)],
          armR: [r(0, 0, -8), r(20, 0, -20), r(0, 0, -110), r(0, 0, -40), r(0, 0, -8)],
          legL: [r(0, 0, 0), r(-30, 0, 0), r(12, 0, 0), r(-10, 0, 0), r(0, 0, 0)],
          legR: [r(0, 0, 0), r(-30, 0, 0), r(12, 0, 0), r(-10, 0, 0), r(0, 0, 0)],
        },
      },
      // 낚시: 낚싯대를 머리 위로 들었다가 앞으로 휙 던지고(0.62초), 그대로 들고 기다린다 (살짝 까딱인다)
      fish: {
        duration: 9,
        times: [0, 0.3, 0.5, 0.62, 0.8, 2.2, 3.6, 5, 6.4, 9],
        tracks: {
          hips: [m(0), m(-0.01), m(-0.01), m(0), m(0), m(-0.006), m(0), m(-0.006), m(0), m(0)],
          body: [r(0, 0, 0), r(-10, 0, 0), r(-11, 0, 0), r(12, 0, 0), r(5, 0, 0), r(6, 0, 0), r(5, 0, 0), r(6, 0, 0), r(5, 0, 0), r(5, 0, 0)],
          head: [r(0, 0, 0), r(-8, 0, 0), r(-9, 0, 0), r(6, 0, 0), r(5, 0, 0), r(6, 0, 2), r(5, 0, 0), r(6, 0, -2), r(5, 0, 0), r(5, 0, 0)],
          armR: [r(0, 0, -6), r(-160, 0, -8), r(-166, 0, -8), r(-72, 0, -6), r(-58, 0, -6), r(-62, 0, -6), r(-56, 0, -6), r(-62, 0, -6), r(-57, 0, -6), r(-58, 0, -6)],
          armL: [r(0, 0, 6), r(-118, 0, -16), r(-124, 0, -16), r(-62, 0, -20), r(-50, 0, -22), r(-53, 0, -22), r(-49, 0, -22), r(-53, 0, -22), r(-50, 0, -22), r(-50, 0, -22)],
          legL: [r(0, 0, 0), r(0, 0, 0), r(0, 0, 0), r(-14, 0, 0), r(-10, 0, 0), r(-10, 0, 0), r(-10, 0, 0), r(-10, 0, 0), r(-10, 0, 0), r(-10, 0, 0)],
          legR: [r(0, 0, 0), r(0, 0, 0), r(0, 0, 0), r(8, 0, 0), r(6, 0, 0), r(6, 0, 0), r(6, 0, 0), r(6, 0, 0), r(6, 0, 0), r(6, 0, 0)],
        },
      },
      // 갸웃: 한 손을 턱에 대고 고개를 갸웃한다
      think: {
        duration: 1.6,
        times: [0, 0.4, 0.8, 1.2, 1.6],
        tracks: {
          hips: [m(0), m(-0.005), m(0), m(-0.005), m(0)],
          body: [r(0, 0, 3), r(0, 0, 5), r(0, 0, 3), r(0, 0, 5), r(0, 0, 3)],
          head: [r(-4, 0, 12), r(-4, 0, 18), r(-4, 0, 12), r(-4, 0, 18), r(-4, 0, 12)],
          armL: [r(0, 0, 8), r(0, 0, 10), r(0, 0, 8), r(0, 0, 10), r(0, 0, 8)],
          armR: [r(-118, 0, 34), r(-122, 0, 38), r(-118, 0, 34), r(-122, 0, 38), r(-118, 0, 34)],
          legL: [{ rot: z }, { rot: z }, { rot: z }, { rot: z }, { rot: z }],
          legR: [{ rot: z }, { rot: z }, { rot: z }, { rot: z }, { rot: z }],
        },
      },
    },
  };
}

// ───────────────────────── 아바타 소품 (머리 소켓 기준) ─────────────────────────

/** 기질 그룹별 임시 소품. 좌표는 머리 가운데(socket_head) 기준이다. */
/** 아바타 소품. NT 안경, NF 꽃 핀, SJ 모자, SP 헤드폰 (이전 유형 소품을 그대로 쓴다) */
export function groupPropParts(group: 'NT' | 'NF' | 'SJ' | 'SP'): Part[] {
  const HS: Vec3 = [1, 0.93, 0.95];
  switch (group) {
    case 'NT': // 동그란 안경
      return [
        ...[1, -1].map((s) =>
          part(new THREE.TorusGeometry(0.064, 0.011, 8, 28), '#2E3550', { pos: [0.115 * s, 0.005, 0.302] }),
        ),
        part(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 8), '#2E3550', { pos: [0, 0.018, 0.312], rot: [0, 0, 90] }),
      ];
    case 'NF': // 꽃 머리핀
      return [
        ...[0, 72, 144, 216, 288].map((a) => {
          const rad = THREE.MathUtils.degToRad(a);
          return part(sphere(0.042, 12, 10), '#FFFFFF', {
            pos: [0.225 + Math.cos(rad) * 0.045, 0.19 + Math.sin(rad) * 0.045, 0.16],
            scale: [1, 1, 0.55],
          });
        }),
        part(sphere(0.03, 12, 10), '#FFD45C', { pos: [0.225, 0.19, 0.175] }),
      ];
    case 'SJ': // 캡모자 (유형 색)
      return [
        part(new THREE.SphereGeometry(0.356, 32, 12, 0, Math.PI * 2, 0, 1.2), C.white, { pos: [0, 0.02, -0.004], scale: HS, mat: TINT_MATERIAL }),
        part(new THREE.CylinderGeometry(0.2, 0.2, 0.022, 28), C.white, { pos: [0, 0.135, 0.29], rot: [-14, 0, 0], scale: [1, 1, 0.75], mat: TINT_MATERIAL }),
        part(sphere(0.03, 10, 8), C.white, { pos: [0, 0.35, 0] }),
      ];
    case 'SP': // 헤드폰 (귀 덮개는 유형 색)
      return [
        part(new THREE.TorusGeometry(0.365, 0.022, 8, 36, Math.PI), '#34343F', { pos: [0, 0.01, -0.02], scale: [1, 0.95, 1] }),
        ...[1, -1].map((s) =>
          part(new THREE.CylinderGeometry(0.085, 0.085, 0.07, 24), C.white, { pos: [0.345 * s, 0, -0.02], rot: [0, 0, 90], mat: TINT_MATERIAL }),
        ),
      ];
  }
}
