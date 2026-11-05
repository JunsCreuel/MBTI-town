// 프로젝트 소유자가 준 캐릭터 모델(Tripo 제작, Mixamo 뼈대)을 게임 규격으로 바꿔 public/assets/characters/ 에 넣는다.
// 원본: assets-src/characters/*.glb, 남자 캐릭터 표정: assets-src/characters/face_parts/<표정>_eyes.png·_mouth.png
// 쓰는 법: npm run assets:characters
//
// - 키: 모델마다 정한 키(m)에 맞춰 정점·뼈·동작 위치를 늘린다 (노드 크기로 늘리면 스키닝이 두 번 늘어난다).
// - 텍스처: 색 텍스처 한 장만 남긴다 (노멀·거칠기 맵은 뺀다). 1024px WebP.
// - 모양: 삼각형을 줄이고(meshopt simplify) meshopt로 압축한다. 화면은 MeshoptDecoder로 푼다.
// - 동작: 손가락·끝 뼈 채널, 엉덩이 말고 다른 뼈의 위치·크기 채널을 뺀다.
//   원본에 없는 몸짓(응원·박수·안녕…)은 화면이 뼈를 돌려 만든다 (src/lib/characterRig.ts).
// - 붙는 자리: socket_head (머리 가운데, 머리 소품), socket_hand_r (오른손 가운데, 낚싯대). 선 자세에서 축이 모델 축과 같다.
// - 베이스 캐릭터: 티셔츠·머리카락·살 자리를 따로 자리 텍스처(발광 텍스처 칸, 세기 0)에 담는다 (R 머리, G 살, B 티셔츠).
//   화면이 그 자리에만 사용자가 고른 티셔츠 색·머리 색·피부색을 입힌다 (regions). 표정 아틀라스를 얼굴에 붙인다(face).
//   색 텍스처에는 알파를 두지 않는다 (아이폰 브라우저가 알파 0인 칸의 색을 버려 검게 그린다).
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type Accessor, type Document, NodeIO, type Node, type Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, getBounds, meshopt, prune, resample, simplify, transformMesh, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { CHARACTER_HEIGHT, EYES_SOCKET, FACE_ATLAS, FACE_MATERIAL, FACES, HAND_SOCKET, HEAD_SOCKET, TINT_MATERIAL, type FaceName } from '../src/shared/character';

const SRC = join(import.meta.dirname, '..', 'assets-src', 'characters');
const ROOT = join(import.meta.dirname, '..', 'public', 'assets');
const TODAY = new Date().toISOString().slice(0, 10);

/** 표정: 그림 폴더, 표정마다 [눈, 입] 그림 이름, 얼굴에 붙이는 자리와 크기 */
interface FaceSpec {
  dir: string;
  parts: Record<FaceName, [string, string]>;
  /** 표정 그림 범위 가운데의 높이 (모델 키 대비) */
  y: number;
  /** 그림 1px이 얼굴에서 차지하는 길이 (모델 키 대비) */
  px: number;
  /** 두 눈 사이를 넓히는 정도: 왼눈·오른눈을 각각 바깥으로 옮기는 px (512px 그림 기준) */
  spread: number;
  /** 스티커 흰 테두리가 있는 그림 (밖에서 이어진 흰색도 지운다). 흰자위가 있는 그림은 false */
  sticker: boolean;
}

/**
 * 머리카락·살 자리 (사용자가 머리 색·피부색을 바꾼다): 색 텍스처의 대표 색들 (16진수 RGB).
 * 칸마다 가장 가까운 대표 색으로 머리·살·나머지를 가른다 (경계는 부드럽게). 대표 색은 모델 텍스처의 색 묶음에서 골랐다
 */
interface RegionSpec {
  hair: string[];
  skin: string[];
  other: string[];
}

interface ModelSpec {
  src: string;
  key: string;
  file: string;
  /** 키 (월드 단위 = 타일 1칸) */
  height: number;
  /** 베이스 캐릭터: 티셔츠 색 입히기 + 표정 */
  face?: FaceSpec;
  /** 베이스 캐릭터: 머리 색·피부색 바꾸기 */
  regions?: RegionSpec;
  /** 펫 (뼈 없는 모델) */
  pet?: boolean;
  /**
   * 원본 서 있기·걷기 동작에서 윗팔을 옆으로 더 벌리는 각도(도). 원본 동작은 팔을 몸에 붙여
   * 옷이 넓은 캐릭터는 팔이 몸속으로 들어가 잘려 보인다. 화면이 동작에 더한다 (scene extras armSpread)
   */
  armSpread?: number;
  /** 남길 삼각형 비율, 허용 오차 (털처럼 잔 모양이 많으면 오차를 키워야 줄어든다) */
  simplify?: number;
  simplifyError?: number;
  /** 색 텍스처 크기 (px) */
  texture?: number;
  /** 밝은 털을 새하얗게 (원본이 베이지·회색빛인 흰 동물). 눈·코처럼 어두운 곳은 그대로 */
  whiten?: boolean;
  /** 네 발 동물 뼈대를 만들어 넣는다 (뼈 없는 펫 모델에 걷기·서 있기 동작) */
  quadruped?: boolean;
  /** 예전 임시 에셋 (지운다) */
  old?: string;
}

const same = (name: string): [string, string] => [`${name}_eyes`, `${name}_mouth`];

const MALE_FACE: FaceSpec = {
  dir: 'face_parts',
  parts: {
    neutral: ['surprised_eyes', 'love_mouth'],
    happy: same('happy'),
    excited: same('excited'),
    sad: same('sad'),
    angry: same('angry'),
    surprised: same('surprised'),
    shy: same('shy'),
    sleepy: same('sleepy'),
    wink: same('wink'),
    love: same('love'),
  },
  y: 0.6,
  px: 0.27 / 279,
  spread: 20,
  sticker: true,
};

const FEMALE_FACE: FaceSpec = {
  dir: 'face_parts_female',
  parts: {
    neutral: same('smile'),
    happy: same('happy'),
    excited: same('excited'),
    sad: same('sad'),
    angry: same('angry'),
    surprised: same('surprised'),
    shy: same('shy'),
    sleepy: same('sleepy'),
    wink: same('wink'),
    love: same('love'),
  },
  y: 0.637,
  px: 0.0016,
  spread: 6,
  sticker: false,
};

const MODELS: ModelSpec[] = [
  {
    src: 'base_blank_face.glb', key: 'char.base', file: 'characters/char_base.glb', height: CHARACTER_HEIGHT, face: MALE_FACE, armSpread: 15, old: 'characters/char_base_ph.glb',
    // 갈색 머리, 살구색 살, 반바지(살색과 비슷한 황토색)·신발·티셔츠
    regions: { hair: ['754134', '8e5b4d'], skin: ['fdcbac', 'f5c2a3'], other: ['dadaeb', 'e9ba99', 'f2e0f4', 'bcc8df', 'efd0d7'] },
  },
  {
    src: 'base_blank_face_female.glb', key: 'char.base.female', file: 'characters/char_base_female.glb', height: CHARACTER_HEIGHT, face: FEMALE_FACE, armSpread: 30,
    // 짙은 갈색 긴 머리, 살구색 살, 흰 티셔츠·황토색 반바지·신발
    regions: { hair: ['31160c', '3d2217'], skin: ['fcb993', 'f7b38c', 'f8c5a3'], other: ['fefcf9', 'daad88', 'ecdcc0', '836555'] },
  },
  // 동물 주민 (MBTI 마을에 집이 있다). 광장 몬냥이·클럽 DJ 너굴·바텐더 곰돌은 예전 임시 모델 그대로 (scripts/gen-placeholders.ts)
  { src: 'animal_cat.glb', key: 'char.resident.cat', file: 'characters/char_resident_cat.glb', height: 1.3 },
  { src: 'animal_fox.glb', key: 'char.resident.fox', file: 'characters/char_resident_fox.glb', height: 1.32 },
  { src: 'animal_bear.glb', key: 'char.resident.bear', file: 'characters/char_resident_bear.glb', height: 1.38 },
  { src: 'animal_rabbit.glb', key: 'char.resident.rabbit', file: 'characters/char_resident_rabbit.glb', height: 1.3 },
  { src: 'animal_dog_lowpoly.glb', key: 'pet.dog', file: 'pets/pet_dog.glb', height: 0.5, pet: true, simplify: 0.6, simplifyError: 0.01, texture: 1024, whiten: true, quadruped: true },
];

/** 표정 그림 한 칸 (px) */
const FACE_CELL = 256;
/** 머리·살 자리 텍스처 크기 (px). 색 텍스처보다 작아도 경계가 부드러워 티가 안 난다 */
const REGION_TEXTURE = 512;
/** 예전 임시 캐릭터의 머리 반지름. 머리 소품은 이 머리에 맞춰 만들었다 */
const OLD_HEAD_RADIUS = 0.34;

const SOURCE_NOTE = '프로젝트 소유자 제공 (Tripo로 제작한 모델, 표정 그림 포함), 용량·뼈대 정리 (scripts/import-characters.ts)';
const LICENSE_NOTE = '프로젝트 소유 [결정 필요: Tripo 요금제의 상업적 이용 권한 확인]';

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

// ───────────────────────── 도우미 ─────────────────────────

function scaleAccessor(a: Accessor | null, s: number) {
  if (!a) return;
  const arr = a.getArray()!;
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = arr[i] * s;
  a.setArray(out);
}

/** 키에 맞춰 정점·뼈·역바인드 행렬·엉덩이 위치 동작을 늘린다 */
function bakeScale(doc: Document, s: number) {
  const root = doc.getRoot();
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) scaleAccessor(p.getAttribute('POSITION'), s);
  for (const node of root.listNodes()) node.setTranslation(node.getTranslation().map((v) => v * s) as [number, number, number]);
  for (const skin of root.listSkins()) {
    const ibm = skin.getInverseBindMatrices()!;
    const arr = Float32Array.from(ibm.getArray()!);
    for (let j = 0; j < ibm.getCount(); j++) for (const k of [12, 13, 14]) arr[j * 16 + k] *= s;
    ibm.setArray(arr);
  }
  for (const anim of root.listAnimations()) {
    for (const ch of anim.listChannels()) if (ch.getTargetPath() === 'translation') scaleAccessor(ch.getSampler()!.getOutput(), s);
  }
}

/** 손가락·끝 뼈 채널과, 엉덩이 말고 다른 뼈의 위치 채널, 크기 채널을 뺀다 */
function trimAnimations(doc: Document) {
  for (const anim of doc.getRoot().listAnimations()) {
    for (const ch of anim.listChannels()) {
      const name = ch.getTargetNode()?.getName() ?? '';
      const path = ch.getTargetPath();
      const drop = !ch.getTargetNode() || /Hand(Index|Middle|Pinky|Ring|Thumb)\d|_End$|neutral_bone/.test(name) || path === 'scale' || (path === 'translation' && !/Hips$/.test(name));
      if (drop) ch.dispose();
    }
  }
}

const hsl = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  if (d > 1e-4) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const sat = d < 1e-4 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, l, s: sat };
};

/** 윗몸(척추·어깨·윗팔) 뼈에 주로 붙은 삼각형이 덮는 텍스처 자리 (size×size, 1 = 윗몸) */
function upperBodyUvMask(doc: Document, size: number): Uint8Array {
  const { prim } = skinnedPrimitive(doc);
  const skin = doc.getRoot().listSkins()[0];
  const upper = new Set(skin.listJoints().map((j, k) => (/:(Spine\d?|LeftShoulder|RightShoulder|LeftArm|RightArm)$/.test(j.getName()) ? k : -1)).filter((k) => k >= 0));
  const uv = prim.getAttribute('TEXCOORD_0')!;
  const joints = prim.getAttribute('JOINTS_0')!;
  const weights = prim.getAttribute('WEIGHTS_0')!;
  const idx = prim.getIndices();
  const count = idx ? idx.getCount() : uv.getCount();
  const vert = (k: number) => (idx ? idx.getScalar(k) : k);
  const jj: number[] = [];
  const ww: number[] = [];
  const share = (v: number) => {
    joints.getElement(v, jj);
    weights.getElement(v, ww);
    const total = ww.reduce((a, b) => a + b, 0) || 1;
    let mine = 0;
    for (let k = 0; k < 4; k++) if (upper.has(jj[k])) mine += ww[k];
    return mine / total;
  };
  const mask = new Uint8Array(size * size);
  const t: number[] = [];
  for (let f = 0; f < count; f += 3) {
    const vs = [vert(f), vert(f + 1), vert(f + 2)];
    // 티셔츠 밑단은 엉덩이 뼈에도 걸려 있어 기준을 낮춘다 (바지는 척추 뼈 몫이 거의 없어 빠진다)
    if (vs.reduce((a, v) => a + share(v), 0) / 3 < 0.2) continue;
    const p = vs.map((v) => uv.getElement(v, t).slice() as [number, number]).map(([u, w]) => [u * size, w * size]);
    // 삼각형을 칸에 칠한다
    const x0 = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0])));
    const x1 = Math.min(size - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
    const y0 = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1])));
    const y1 = Math.min(size - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
    const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
    if (Math.abs(area) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const a = ((p[1][0] - px) * (p[2][1] - py) - (p[2][0] - px) * (p[1][1] - py)) / area;
        const b = ((p[2][0] - px) * (p[0][1] - py) - (p[0][0] - px) * (p[2][1] - py)) / area;
        const c = 1 - a - b;
        if (a >= 0 && b >= 0 && c >= 0) mask[y * size + x] = 1;
      }
    }
  }
  // 조각 가장자리(텍스처 거르기로 섞이는 곳)까지 2칸 넓힌다
  for (let pass = 0; pass < 2; pass++) {
    const prev = mask.slice();
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const i = y * size + x;
        if (!prev[i] && (prev[i - 1] || prev[i + 1] || prev[i - size] || prev[i + size])) mask[i] = 1;
      }
    }
  }
  return mask;
}

/** 텍스처에서 삼각형이 쓰는 칸 (모든 메시의 TEXCOORD_0 삼각형을 칠한다) */
function uvCoverage(doc: Document, w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  const t: number[] = [];
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const uv = prim.getAttribute('TEXCOORD_0');
      if (!uv) continue;
      const idx = prim.getIndices();
      const count = idx ? idx.getCount() : uv.getCount();
      for (let f = 0; f + 2 < count; f += 3) {
        const p = [f, f + 1, f + 2].map((k) => uv.getElement(idx ? idx.getScalar(k) : k, t).slice() as [number, number]).map(([u, v]) => [u * w, v * h]);
        const x0 = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0])));
        const x1 = Math.min(w - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
        const y0 = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1])));
        const y1 = Math.min(h - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
        const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
        if (Math.abs(area) < 1e-9) continue;
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const a = ((p[1][0] - x - 0.5) * (p[2][1] - y - 0.5) - (p[2][0] - x - 0.5) * (p[1][1] - y - 0.5)) / area;
            const b = ((p[2][0] - x - 0.5) * (p[0][1] - y - 0.5) - (p[0][0] - x - 0.5) * (p[2][1] - y - 0.5)) / area;
            // 가장자리 칸도 넣는다 (조금 넉넉히)
            if (a >= -0.02 && b >= -0.02 && 1 - a - b >= -0.02) mask[y * w + x] = 1;
          }
        }
      }
    }
  }
  return mask;
}

/**
 * 조각 사이 빈 곳을 가까운 조각 색으로 채운다 (가장자리에서 바깥으로 한 칸씩, passes칸까지. 그 너머는 쓰는 칸 평균색).
 * 잘게 쪼개진 텍스처를 줄이거나 멀리서 볼 때 빈 곳(검은색)이 조각 가장자리에 번져 검은 선·점이 생기는 것을 막는다
 */
function bleedEdges(rgb: Buffer, w: number, h: number, used: Uint8Array, passes: number) {
  const filled = used.slice();
  let frontier: number[] = [];
  const near = (i: number) => {
    const x = i % w;
    return [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w].filter((j) => j >= 0 && j < w * h);
  };
  for (let i = 0; i < w * h; i++) if (!filled[i] && near(i).some((j) => filled[j])) frontier.push(i);
  for (let pass = 0; pass < passes && frontier.length; pass++) {
    const colors = frontier.map((i) => {
      const src = near(i).filter((j) => filled[j]);
      return [0, 1, 2].map((c) => src.reduce((s, j) => s + rgb[j * 3 + c], 0) / src.length);
    });
    frontier.forEach((i, k) => {
      for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.round(colors[k][c]);
      filled[i] = 1;
    });
    const next = new Set<number>();
    for (const i of frontier) for (const j of near(i)) if (!filled[j]) next.add(j);
    frontier = [...next];
  }
  const avg = [0, 1, 2].map((c) => {
    let s = 0;
    let n = 0;
    for (let i = 0; i < w * h; i++) if (used[i]) (s += rgb[i * 3 + c]), n++;
    return n ? Math.round(s / n) : 0;
  });
  for (let i = 0; i < w * h; i++) if (!filled[i]) for (let c = 0; c < 3; c++) rgb[i * 3 + c] = avg[c];
}

/**
 * 흰 동물의 털을 새하얗게: 밝은 곳(밝기 0.35~0.55부터 서서히)은 색을 빼고 흰색 쪽으로 당긴다 (명암은 조금 남긴다).
 * 눈·코·입처럼 어두운 곳은 그대로 둔다. RGB 바이트 배열을 그 자리에서 고친다
 */
function whitenFur(rgb: Buffer) {
  const smooth = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let i = 0; i < rgb.length; i += 3) {
    const r = rgb[i] / 255;
    const g = rgb[i + 1] / 255;
    const b = rgb[i + 2] / 255;
    const l = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
    const w = smooth(0.35, 0.55, l);
    if (!w) continue;
    const target = 1 - (1 - l) * 0.22;
    for (let c = 0; c < 3; c++) rgb[i + c] = Math.round((rgb[i + c] / 255 + (target - rgb[i + c] / 255) * w) * 255);
  }
}

/**
 * 자리 텍스처: R = 머리카락, G = 살, B = 티셔츠 (0~255, 경계는 부드럽게). 티셔츠 자리는 머리·살이 0.
 * 조각 밖 빈 칸은 가까운 조각 값으로 채운다 (텍스처 거르기로 조각 가장자리에 원래 색이 비치지 않게).
 * 화면은 이 자리에만 고른 머리 색·피부색을 입힌다 (밝기 무늬는 살린다). 자리마다 평균 밝기(선형)를 같이 돌려준다
 */
async function regionTexture(doc: Document, rgb: Buffer, shirt: Uint8Array, w: number, h: number, spec: RegionSpec): Promise<{ image: Buffer; hairLum: number; skinLum: number }> {
  const parse = (list: string[]) => list.map((x) => [0, 2, 4].map((k) => parseInt(x.slice(k, k + 2), 16)));
  const refs = { hair: parse(spec.hair), skin: parse(spec.skin), other: parse(spec.other) };
  const used = uvCoverage(doc, w, h);
  const out = Buffer.alloc(w * h * 3);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  /** 내 대표 색까지 거리 a, 다른 대표 색까지 거리 b → 내 몫 (가운데에서 부드럽게 넘어간다) */
  const share = (a: number, b: number) => {
    const t = Math.min(1, Math.max(0, (b / (a + b + 1e-6) - 0.35) / 0.3));
    return t * t * (3 - 2 * t);
  };
  const sum = { hair: 0, hairW: 0, skin: 0, skinW: 0 };
  for (let i = 0; i < w * h; i++) {
    if (shirt[i]) {
      out[i * 3 + 2] = 255;
      continue;
    }
    const px = [rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]];
    const dist = (list: number[][]) => Math.min(...list.map((c) => Math.hypot(c[0] - px[0], c[1] - px[1], c[2] - px[2])));
    const dh = dist(refs.hair);
    const ds = dist(refs.skin);
    const dOther = dist(refs.other);
    const hair = share(dh, Math.min(ds, dOther));
    const skin = share(ds, Math.min(dh, dOther));
    out[i * 3] = Math.round(hair * 255);
    out[i * 3 + 1] = Math.round(skin * 255);
    if (used[i]) {
      const lum = 0.2126 * lin(px[0]) + 0.7152 * lin(px[1]) + 0.0722 * lin(px[2]);
      sum.hair += lum * hair;
      sum.hairW += hair;
      sum.skin += lum * skin;
      sum.skinW += skin;
    }
  }
  bleedEdges(out, w, h, used, 24);
  const image = await sharp(out, { raw: { width: w, height: h, channels: 3 } }).resize(REGION_TEXTURE, REGION_TEXTURE).webp({ lossless: true }).toBuffer();
  return { image, hairLum: sum.hairW ? sum.hair / sum.hairW : 0.05, skinLum: sum.skinW ? sum.skin / sum.skinW : 0.5 };
}

/** 베이스 캐릭터 재질에 적어 두는 색 입히기 값 (티셔츠·머리·살 평균 밝기) */
type TintExtras = { shirtLum: number; hairLum?: number; skinLum?: number };

/**
 * 색 텍스처 한 장만 남기고 1024px WebP로 (알파 없이). 베이스 캐릭터는 티셔츠·머리·살 자리를 따로 자리 텍스처에 담고,
 * 자리마다 평균 밝기를 돌려준다. 자리를 색 텍스처 알파에 담으면 안 된다: 아이폰 브라우저(WebKit)는 알파가 0인 칸의 색을
 * 버려서(검게) 살·머리가 까맣게 나온다
 */
async function slimTextures(doc: Document, spec: ModelSpec): Promise<TintExtras | null> {
  let shirtLum: number | null = null;
  let regionLums: { hairLum: number; skinLum: number } | null = null;
  for (const mat of doc.getRoot().listMaterials()) {
    mat.setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);
    mat.setMetallicFactor(0).setRoughnessFactor(0.85);
    mat.setName(spec.face ? TINT_MATERIAL : 'body');
    const tex = mat.getBaseColorTexture();
    if (!tex) continue;
    const size = spec.texture ?? 1024;
    let out: Buffer;
    if (!spec.face) {
      // 원본 크기에서 조각 사이를 채운 뒤(흰 털이면 하얗게) 줄인다
      const full = await sharp(Buffer.from(tex.getImage()!)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      bleedEdges(full.data, full.info.width, full.info.height, uvCoverage(doc, full.info.width, full.info.height), 32);
      if (spec.whiten) whitenFur(full.data);
      out = await sharp(full.data, { raw: { width: full.info.width, height: full.info.height, channels: 3 } }).resize(size, size).webp({ quality: 88 }).toBuffer();
      tex.setImage(new Uint8Array(out)).setMimeType('image/webp').setURI('');
      continue;
    }
    const { data, info } = await sharp(Buffer.from(tex.getImage()!)).resize(size, size).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    {
      // 티셔츠: 윗몸(척추·어깨·윗팔)에 붙은 자리 중 살색·어두운 색(머리카락)이 아닌 곳
      if (!spec.regions) throw new Error(`${spec.src}: 베이스 캐릭터는 머리·살 대표 색(regions)이 있어야 합니다`);
      const upper = upperBodyUvMask(doc, info.width);
      const shirtMask = new Uint8Array(info.width * info.height);
      let sum = 0;
      let n = 0;
      for (let i = 0; i < info.width * info.height; i++) {
        const r = data[i * 3] / 255;
        const g = data[i * 3 + 1] / 255;
        const b = data[i * 3 + 2] / 255;
        const { h, l, s: sat } = hsl(r, g, b);
        const skin = h > 8 && h < 48 && sat > 0.3 && l < 0.93;
        const shirt = upper[i] === 1 && l > 0.4 && !skin;
        shirtMask[i] = shirt ? 1 : 0;
        if (shirt) {
          sum += 0.299 * r + 0.587 * g + 0.114 * b;
          n++;
        }
      }
      shirtLum = n ? sum / n : 1;
      out = await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).webp({ quality: 86 }).toBuffer();
      // 자리 텍스처는 빛을 내지 않는 발광 텍스처 칸에 담는다 (발광 세기 0이라 그대로 그려도 티가 안 난다. 화면이 꺼내 쓴다)
      const r = await regionTexture(doc, data, shirtMask, info.width, info.height, spec.regions);
      const regions = doc.createTexture('regions').setImage(new Uint8Array(r.image)).setMimeType('image/webp');
      mat.setEmissiveTexture(regions).setEmissiveFactor([0, 0, 0]);
      regionLums = { hairLum: r.hairLum, skinLum: r.skinLum };
      console.log(`  자리 텍스처(머리·살·티셔츠): 머리 밝기 ${r.hairLum.toFixed(3)}, 살 밝기 ${r.skinLum.toFixed(3)}, ${(r.image.byteLength / 1024).toFixed(0)}KB`);
    }
    tex.setImage(new Uint8Array(out)).setMimeType('image/webp').setURI('');
  }
  return shirtLum === null ? null : { shirtLum, ...(regionLums ?? {}) };
}

function skinnedPrimitive(doc: Document): { node: Node; prim: Primitive } {
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (mesh && node.getSkin()) return { node, prim: mesh.listPrimitives()[0] };
  }
  throw new Error('스킨 메시가 없습니다');
}

const jointNode = (doc: Document, name: string) => {
  const n = doc.getRoot().listNodes().find((x) => x.getName() === `mixamorig:${name}`);
  if (!n) throw new Error(`뼈 ${name}이 없습니다`);
  return n;
};

/** 이 뼈의 역바인드 행렬 (모델 공간 → 뼈 공간, 선 자세 기준) */
function inverseBind(doc: Document, joint: Node): THREE.Matrix4 {
  const skin = doc.getRoot().listSkins()[0];
  const j = skin.listJoints().indexOf(joint);
  const arr = skin.getInverseBindMatrices()!.getArray()!;
  return new THREE.Matrix4().fromArray(Array.from(arr.slice(j * 16, j * 16 + 16)));
}

/** 이 뼈(와 그 아래 뼈들: 손가락 등)에 주로 붙은 정점들의 범위 (모델 공간, 선 자세) */
function boneVerticesBox(doc: Document, prim: Primitive, joint: Node): THREE.Box3 {
  const skin = doc.getRoot().listSkins()[0];
  const all = skin.listJoints();
  const mineSet = new Set<number>();
  const walk = (n: Node) => {
    const k = all.indexOf(n);
    if (k >= 0) mineSet.add(k);
    n.listChildren().forEach(walk);
  };
  walk(joint);
  const pos = prim.getAttribute('POSITION')!;
  const joints = prim.getAttribute('JOINTS_0')!;
  const weights = prim.getAttribute('WEIGHTS_0')!;
  const box = new THREE.Box3();
  const p: number[] = [];
  const jj: number[] = [];
  const ww: number[] = [];
  for (let i = 0; i < pos.getCount(); i++) {
    joints.getElement(i, jj);
    weights.getElement(i, ww);
    const total = ww.reduce((a, b) => a + b, 0) || 1;
    let mine = 0;
    for (let k = 0; k < 4; k++) if (mineSet.has(jj[k])) mine += ww[k];
    if (mine / total >= 0.5) box.expandByPoint(new THREE.Vector3(...(pos.getElement(i, p) as [number, number, number])));
  }
  if (box.isEmpty()) throw new Error(`${joint.getName()}에 붙은 정점이 없습니다`);
  return box;
}

/** 뼈 아래 붙는 자리 노드: 모델 공간 점 c에, 선 자세에서 모델 축과 같은 방향, 크기 s */
function addSocket(doc: Document, joint: Node, name: string, c: THREE.Vector3, s: number) {
  const m = inverseBind(doc, joint).multiply(new THREE.Matrix4().compose(c, new THREE.Quaternion(), new THREE.Vector3(s, s, s)));
  const t = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  m.decompose(t, q, sc);
  const node = doc.createNode(name).setTranslation(t.toArray() as [number, number, number]).setRotation(q.toArray() as [number, number, number, number]).setScale(sc.toArray() as [number, number, number]);
  joint.addChild(node);
  return node;
}

// ───────────────────────── 표정 ─────────────────────────

/** 스티커 테두리(흰 외곽선)와 분홍 재단선을 지운다: 그림 밖에서 이어진 흰색·흐린 분홍만 지우고, 안쪽 하이라이트는 남긴다 */
function cleanSticker(px: Buffer, w: number, h: number, sticker: boolean) {
  const removable = (i: number) => {
    const r = px[i * 4];
    const g = px[i * 4 + 1];
    const b = px[i * 4 + 2];
    const a = px[i * 4 + 3];
    if (a < 12) return true;
    if (sticker && Math.min(r, g, b) > 205) return true; // 흰 외곽선
    if (a < 235 && r > 170 && b > 110 && g < r - 25) return true; // 흐린 분홍 점선 (볼 터치는 불투명해서 남는다)
    return false;
  };
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop()!;
    if (seen[i] || !removable(i)) continue;
    seen[i] = 1;
    px[i * 4 + 3] = 0;
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
}

async function cleanedPart(face: FaceSpec, name: string): Promise<{ data: Buffer; w: number; h: number }> {
  const { data, info } = await sharp(join(SRC, face.dir, `${name}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  cleanSticker(data, info.width, info.height, face.sticker);
  return { data, w: info.width, h: info.height };
}

/** 두 눈 사이를 넓힌다: 그림 왼쪽 반은 왼쪽으로, 오른쪽 반은 오른쪽으로 옮긴다 */
function spreadEyes(part: { data: Buffer; w: number; h: number }, px: number) {
  if (!px) return part;
  const { data, w, h } = part;
  const out = Buffer.alloc(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = x < w / 2 ? x - px : x + px;
      if (nx < 0 || nx >= w) continue;
      data.copy(out, (y * w + nx) * 4, (y * w + x) * 4, (y * w + x) * 4 + 4);
    }
  }
  return { data: out, w, h };
}

/** 표정마다 눈 + 입을 겹치고, 모든 표정을 다 담는 정사각형으로 잘라 아틀라스에 놓는다. 자른 한 변(px)도 돌려준다 */
async function buildFaceAtlas(face: FaceSpec): Promise<{ image: Buffer; side: number; eyeOffsetPx: number }> {
  const faces = await Promise.all(
    FACES.map(async (f) => {
      const [eyesRaw, mouth] = await Promise.all(face.parts[f].map((n) => cleanedPart(face, n)));
      const eyes = spreadEyes(eyesRaw, face.spread);
      return sharp(eyes.data, { raw: { width: eyes.w, height: eyes.h, channels: 4 } })
        .composite([{ input: await sharp(mouth.data, { raw: { width: mouth.w, height: mouth.h, channels: 4 } }).png().toBuffer() }])
        .raw()
        .toBuffer({ resolveWithObject: true });
    }),
  );
  // 모든 표정을 담는 범위
  const W = faces[0].info.width;
  const H = faces[0].info.height;
  let x0 = W;
  let y0 = H;
  let x1 = 0;
  let y1 = 0;
  for (const { data } of faces) {
    for (let i = 0; i < W * H; i++) {
      if (data[i * 4 + 3] < 24) continue;
      const x = i % W;
      const y = (i / W) | 0;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  const side = Math.min(W, Math.max(x1 - x0, y1 - y0) + 24);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const left = Math.round(Math.max(0, Math.min(W - side, cx - side / 2)));
  const top = Math.round(Math.max(0, Math.min(H - side, cy - side / 2)));
  console.log(`  표정 범위 ${x1 - x0}×${y1 - y0}px → ${side}px 정사각형으로 자름`);
  const cells = await Promise.all(
    faces.map(async ({ data, info }, i) => ({
      input: await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
        .extract({ left, top, width: side, height: side })
        .resize(FACE_CELL, FACE_CELL)
        .png()
        .toBuffer(),
      left: (i % FACE_ATLAS.cols) * FACE_CELL,
      top: Math.floor(i / FACE_ATLAS.cols) * FACE_CELL,
    })),
  );
  const image = await sharp({ create: { width: FACE_ATLAS.cols * FACE_CELL, height: FACE_ATLAS.rows * FACE_CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(cells)
    .webp({ quality: 90, alphaQuality: 100 })
    .toBuffer();
  // 평소 얼굴의 눈 가운데가 자른 범위 가운데보다 몇 px 아래인가 (안경 자리를 눈 높이에 맞춘다)
  const neutralEyes = spreadEyes(await cleanedPart(face, face.parts.neutral[0]), face.spread);
  let ey0 = H;
  let ey1 = 0;
  for (let i = 0; i < W * H; i++) {
    if (neutralEyes.data[i * 4 + 3] < 24) continue;
    const y = (i / W) | 0;
    ey0 = Math.min(ey0, y);
    ey1 = Math.max(ey1, y);
  }
  return { image, side, eyeOffsetPx: (ey0 + ey1) / 2 - (top + side / 2) };
}

/** 얼굴 앞면에 표정 그림을 투영한 메시를 만들어 머리 뼈 아래에 붙인다 */
/** 얼굴을 붙이고, 눈 가운데 높이(모델 공간)를 돌려준다 */
async function addFace(doc: Document, prim: Primitive, height: number, face: FaceSpec): Promise<number> {
  const atlasImage = await buildFaceAtlas(face);
  const pos = prim.getAttribute('POSITION')!;
  const nor = prim.getAttribute('NORMAL')!;
  const idx = prim.getIndices();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(pos.getArray()!), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from(nor.getArray()!), 3));
  if (idx) g.setIndex(new THREE.BufferAttribute(Uint32Array.from(idx.getArray()!), 1));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
  mesh.updateMatrixWorld(true);
  // 얼굴 앞면: 정면(+Z)에서 얼굴 높이로 쏜 광선이 처음 닿는 곳
  const y = face.y * height;
  const ray = new THREE.Raycaster(new THREE.Vector3(0, y, 5), new THREE.Vector3(0, 0, -1));
  const hit = ray.intersectObject(mesh)[0];
  if (!hit) throw new Error('얼굴 앞면을 찾지 못했습니다');
  // 그림 1px이 얼굴에서 같은 길이가 되게 (눈 간격을 넓혀 자른 범위가 커져도 눈 크기는 그대로)
  const size = atlasImage.side * face.px * height;
  const decal = new DecalGeometry(mesh, hit.point, new THREE.Euler(0, 0, 0), new THREE.Vector3(size, size, size * 0.9));
  const dp = decal.getAttribute('position');
  const dn = decal.getAttribute('normal');
  const du = decal.getAttribute('uv');
  const head = jointNode(doc, 'Head');
  const ibm = inverseBind(doc, head);
  const nm = new THREE.Matrix3().setFromMatrix4(ibm);
  const P = new Float32Array(dp.count * 3);
  const N = new Float32Array(dp.count * 3);
  const UV = new Float32Array(dp.count * 2);
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < dp.count; i++) {
    n.fromBufferAttribute(dn, i).normalize();
    // 피부 위로 살짝 띄운다 (겹쳐 깜빡이지 않게)
    v.fromBufferAttribute(dp, i).addScaledVector(n, 0.004 * height).applyMatrix4(ibm);
    n.applyMatrix3(nm).normalize();
    v.toArray(P, i * 3);
    n.toArray(N, i * 3);
    // 아틀라스 첫 칸 (평소 얼굴). 화면이 offset을 옮겨 표정을 바꾼다. glTF 텍스처는 위가 v=0
    UV[i * 2] = du.getX(i) / FACE_ATLAS.cols;
    UV[i * 2 + 1] = (1 - du.getY(i)) / FACE_ATLAS.rows;
  }
  const buffer = doc.getRoot().listBuffers()[0];
  const atlas = doc.createTexture('face_atlas').setImage(new Uint8Array(atlasImage.image)).setMimeType('image/webp');
  const mat = doc
    .createMaterial(FACE_MATERIAL)
    .setBaseColorTexture(atlas)
    .setAlphaMode('BLEND')
    .setMetallicFactor(0)
    .setRoughnessFactor(1);
  const facePrim = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(P).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setBuffer(buffer))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(UV).setBuffer(buffer))
    .setMaterial(mat);
  head.addChild(doc.createNode('face').setMesh(doc.createMesh('face').addPrimitive(facePrim)));
  const eyeY = y - atlasImage.eyeOffsetPx * face.px * height;
  console.log(`  얼굴: 삼각형 ${dp.count / 3}개, 앞면 z=${hit.point.z.toFixed(3)}, 눈 높이 ${(eyeY / height).toFixed(3)}`);
  return eyeY;
}

// ───────────────────────── 모델 하나 ─────────────────────────

// ───────────────────────── 네 발 동물 뼈대 (펫) ─────────────────────────

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * 뼈 없는 네 발 동물 모델(정면 = +Z)에 뼈대·가중치·동작을 만든다.
 * - 다리: 바닥 가까운 정점을 앞뒤·좌우로 나눠 발 넷의 자리를 찾고, 다리마다 윗마디(몸에 붙는 곳)·아랫마디(무릎) 뼈
 * - 몸: 엉덩이(뒤)·가슴(앞), 머리(앞 위), 꼬리(뒤 위). 가중치는 높이·앞뒤·다리 축까지 거리로 부드럽게 나눈다
 * - 동작: walk(대각선 다리끼리 같이 걷는 종종걸음, 몸 들썩, 꼬리 흔들기), idle(숨쉬기, 고개 갸웃, 꼬리 살랑)
 */
function rigQuadruped(doc: Document) {
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  const meshNode = root.listNodes().find((n) => n.getMesh())!;
  // 뼈대 있는 메시는 노드 변환을 쓰지 않으므로 정점에 굽고, 장면 바로 아래로 옮긴다
  transformMesh(meshNode.getMesh()!, meshNode.getWorldMatrix());
  meshNode.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
  for (const parent of meshNode.listParents()) if (parent !== scene && 'removeChild' in parent) (parent as Node).removeChild(meshNode);
  if (!scene.listChildren().includes(meshNode)) scene.addChild(meshNode);
  const prims = meshNode.getMesh()!.listPrimitives();

  // 모든 정점 (월드 좌표)
  const pts: number[][] = [];
  const t: number[] = [];
  for (const p of prims) {
    const pos = p.getAttribute('POSITION')!;
    for (let i = 0; i < pos.getCount(); i++) pts.push(pos.getElement(i, t).slice());
  }
  const min = [0, 1, 2].map((k) => Math.min(...pts.map((v) => v[k])));
  const max = [0, 1, 2].map((k) => Math.max(...pts.map((v) => v[k])));
  const H = max[1] - min[1];
  const L = max[2] - min[2];
  const yN = (y: number) => (y - min[1]) / H;
  const zN = (z: number) => (z - min[2]) / L;

  // 발 넷: 바닥에서 12% 안의 정점을 앞뒤(z)·좌우(x)로 나눈 무리의 가운데
  const feet = pts.filter((v) => yN(v[1]) < 0.12);
  const mid = (k: number) => feet.reduce((a, v) => a + v[k], 0) / feet.length;
  const cx = mid(0);
  const cz = mid(2);
  const legNames = ['FL', 'FR', 'BL', 'BR'] as const;
  const legAt = Object.fromEntries(
    legNames.map((name) => {
      const front = name[0] === 'F';
      const right = name[1] === 'R';
      const group = feet.filter((v) => v[2] > cz === front && v[0] > cx === right);
      return [name, { x: group.reduce((a, v) => a + v[0], 0) / group.length, z: group.reduce((a, v) => a + v[2], 0) / group.length }];
    }),
  ) as Record<(typeof legNames)[number], { x: number; z: number }>;
  const legGapX = Math.min(Math.abs(legAt.FR.x - legAt.FL.x), Math.abs(legAt.BR.x - legAt.BL.x));
  const legGapZ = Math.min(Math.abs(legAt.FL.z - legAt.BL.z), Math.abs(legAt.FR.z - legAt.BR.z));
  const legR = Math.max(0.1 * H, 0.6 * Math.min(legGapX, legGapZ));
  const legTop = min[1] + 0.34 * H;
  const knee = min[1] + 0.17 * H;
  const frontZ = (legAt.FL.z + legAt.FR.z) / 2;
  const backZ = (legAt.BL.z + legAt.BR.z) / 2;

  // 뼈 자리 (월드 좌표, 처음 자세는 회전 없음)
  const spots: { name: string; parent: string | null; at: number[] }[] = [
    { name: 'root', parent: null, at: [cx, min[1], cz] },
    { name: 'hips', parent: 'root', at: [cx, legTop + 0.06 * H, backZ] },
    { name: 'chest', parent: 'hips', at: [cx, legTop + 0.06 * H, frontZ] },
    { name: 'head', parent: 'chest', at: [cx, min[1] + 0.58 * H, frontZ + 0.04 * L] },
    { name: 'tail', parent: 'hips', at: [cx, min[1] + 0.5 * H, min[2] + 0.16 * L] },
    ...legNames.flatMap((n) => [
      { name: `leg${n}`, parent: n[0] === 'F' ? 'chest' : 'hips', at: [legAt[n].x, legTop, legAt[n].z] },
      { name: `knee${n}`, parent: `leg${n}`, at: [legAt[n].x, knee, legAt[n].z] },
    ]),
  ];
  const index = new Map(spots.map((s, i) => [s.name, i]));
  const joints = spots.map((s) => doc.createNode(`dog_${s.name}`));
  spots.forEach((s, i) => {
    const parent = s.parent ? spots[index.get(s.parent)!] : null;
    joints[i].setTranslation(parent ? (s.at.map((v, k) => v - parent.at[k]) as [number, number, number]) : (s.at as [number, number, number]));
    if (s.parent) joints[index.get(s.parent)!].addChild(joints[i]);
  });
  scene.addChild(joints[0]);
  const buffer = root.listBuffers()[0];
  const ibm = new Float32Array(spots.length * 16);
  spots.forEach((s, i) => {
    ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -s.at[0], -s.at[1], -s.at[2], 1], i * 16);
  });
  const skin = doc.createSkin('dog').setSkeleton(joints[0]).setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm).setBuffer(buffer));
  for (const j of joints) skin.addJoint(j);
  meshNode.setSkin(skin);

  // 가중치: 다리 → (남은 몫) 머리 → 꼬리 → 몸통(엉덩이·가슴을 앞뒤로 나눈다). 가장 큰 넷만 남긴다
  const weightsOf = ([x, y, z]: number[]) => {
    const w = new Map<number, number>();
    const add = (name: string, v: number) => v > 1e-4 && w.set(index.get(name)!, (w.get(index.get(name)!) ?? 0) + v);
    let best: (typeof legNames)[number] = 'FL';
    let bestD = Infinity;
    for (const n of legNames) {
      const d = Math.hypot(x - legAt[n].x, z - legAt[n].z);
      if (d < bestD) (bestD = d), (best = n);
    }
    const leg = (1 - smoothstep(legTop - 0.02 * H, legTop + 0.07 * H, y)) * (1 - smoothstep(legR * 0.85, legR * 1.25, bestD));
    const lower = 1 - smoothstep(knee - 0.03 * H, knee + 0.03 * H, y);
    add(`knee${best}`, leg * lower);
    add(`leg${best}`, leg * (1 - lower));
    const body = 1 - leg;
    const head = smoothstep(0.5, 0.62, zN(z)) * smoothstep(0.52, 0.64, yN(y));
    add('head', body * head);
    const tail = (1 - smoothstep(0.08, 0.2, zN(z))) * smoothstep(0.4, 0.5, yN(y));
    add('tail', body * (1 - head) * tail);
    const trunk = body * (1 - head) * (1 - tail);
    const chest = smoothstep(0.3, 0.7, zN(z));
    add('chest', trunk * chest);
    add('hips', trunk * (1 - chest));
    const top = [...w.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((a, [, v]) => a + v, 0) || 1;
    while (top.length < 4) top.push([0, 0]);
    return { j: top.map(([k]) => k), v: top.map(([, v]) => v / sum) };
  };
  for (const p of prims) {
    const pos = p.getAttribute('POSITION')!;
    const J = new Uint8Array(pos.getCount() * 4);
    const Wt = new Float32Array(pos.getCount() * 4);
    for (let i = 0; i < pos.getCount(); i++) {
      const { j, v } = weightsOf(pos.getElement(i, t));
      J.set(j, i * 4);
      Wt.set(v, i * 4);
    }
    p.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(J).setBuffer(buffer));
    p.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(Wt).setBuffer(buffer));
  }

  // 동작
  const deg = Math.PI / 180;
  const quat = (x: number, y: number, z: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x * deg, y * deg, z * deg)).toArray();
  const clip = (name: string, duration: number, frames: number, tracks: [string, 'rotation' | 'translation', (phase: number) => number[]][]) => {
    const anim = doc.createAnimation(name);
    const times = Float32Array.from({ length: frames + 1 }, (_, k) => (k / frames) * duration);
    const input = doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer);
    for (const [joint, path, at] of tracks) {
      const values = Float32Array.from([...times].flatMap((time) => at((time / duration) * Math.PI * 2)));
      const sampler = doc.createAnimationSampler().setInput(input).setOutput(doc.createAccessor().setType(path === 'rotation' ? 'VEC4' : 'VEC3').setArray(values).setBuffer(buffer)).setInterpolation('LINEAR');
      anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(joints[index.get(joint)!]).setTargetPath(path).setSampler(sampler));
    }
  };
  const hipsRest = joints[index.get('hips')!].getTranslation();
  const legTracks = (gait: boolean): [string, 'rotation', (ph: number) => number[]][] =>
    legNames.flatMap((n) => {
      // 대각선 다리끼리 같이 (앞왼·뒤오른 / 앞오른·뒤왼)
      const off = n === 'FL' || n === 'BR' ? 0 : Math.PI;
      return [
        [`leg${n}`, 'rotation', (ph: number) => quat(gait ? 30 * Math.sin(ph + off) : 0, 0, 0)],
        // 다리를 앞으로 내딛는 동안(각도가 줄어드는 동안) 무릎을 굽혀 발을 든다
        [`knee${n}`, 'rotation', (ph: number) => quat(gait ? 40 * Math.max(0, -Math.cos(ph + off)) : 0, 0, 0)],
      ] as [string, 'rotation', (ph: number) => number[]][];
    });
  // 느긋한 걸음 (한 바퀴 0.8초, 보폭을 넓게). 화면이 빠르기에 맞춰 조금만 빠르게 돌린다
  clip('walk', 0.8, 20, [
    ...legTracks(true),
    ['hips', 'translation', (ph) => [hipsRest[0], hipsRest[1] + 0.015 * H * Math.cos(2 * ph), hipsRest[2]]],
    ['chest', 'rotation', (ph) => quat(0, 0, 2.5 * Math.sin(ph))],
    ['head', 'rotation', (ph) => quat(3 * Math.sin(2 * ph + 0.6), 0, 0)],
    ['tail', 'rotation', (ph) => quat(-12, 24 * Math.sin(2 * ph), 0)],
  ]);
  clip('idle', 2.4, 24, [
    ...legTracks(false),
    ['hips', 'translation', (ph) => [hipsRest[0], hipsRest[1] + 0.006 * H * Math.sin(2 * ph), hipsRest[2]]],
    ['chest', 'rotation', (ph) => quat(1.2 * Math.sin(2 * ph), 0, 0)],
    ['head', 'rotation', (ph) => quat(3 * Math.sin(ph), 0, 5 * Math.sin(ph + 1))],
    ['tail', 'rotation', (ph) => quat(-12, 16 * Math.sin(3 * ph), 0)],
  ]);
  console.log(`  뼈대: 발 ${legNames.map((n) => `${n}(${legAt[n].x.toFixed(2)},${legAt[n].z.toFixed(2)})`).join(' ')}, 다리 반지름 ${legR.toFixed(3)}`);
}

async function convert(spec: ModelSpec) {
  console.log(`${spec.src} → ${spec.file}`);
  const doc = await io.read(join(SRC, spec.src));
  doc.createExtension(EXTTextureWebP).setRequired(true);
  if (!spec.pet) trimAnimations(doc);
  const tint = await slimTextures(doc, spec);
  const b = getBounds(doc.getRoot().listScenes()[0]);
  bakeScale(doc, spec.height / (b.max[1] - b.min[1]));
  await doc.transform(dedup(), prune(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: spec.simplify ?? 0.5, error: spec.simplifyError ?? 0.0008 }), resample());
  if (spec.quadruped) rigQuadruped(doc);

  let headRadius = 0;
  if (!spec.pet) headRadius = await addRigParts(doc, spec, tint);
  if (spec.armSpread) doc.getRoot().listScenes()[0].setExtras({ armSpread: spec.armSpread });

  // 붙는 자리(socket_*)는 빈 노드라 prune이 지우지 않게 한다
  await doc.transform(prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  const bin = await io.writeBinary(doc);
  mkdirSync(dirname(join(ROOT, spec.file)), { recursive: true });
  writeFileSync(join(ROOT, spec.file), bin);
  const tris = doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((t, p) => t + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')!.getCount()) / 3, 0), 0);
  console.log(`  ${(bin.byteLength / 1024).toFixed(0)}KB, 삼각형 ${tris}, 동작 ${doc.getRoot().listAnimations().map((a) => a.getName()).join('·') || '없음'}${headRadius ? `, 머리 반지름 ${headRadius.toFixed(3)}` : ''}`);
}

/** 뼈 있는 캐릭터: 티셔츠 밝기 기록, 머리·손 자리, 표정. 머리 반지름을 돌려준다 */
async function addRigParts(doc: Document, spec: ModelSpec, tint: TintExtras | null): Promise<number> {
  const { prim } = skinnedPrimitive(doc);
  if (tint) prim.getMaterial()!.setExtras(Object.fromEntries(Object.entries(tint).map(([k, v]) => [k, Number(v.toFixed(4))])));
  // 머리 소품 자리: 머리 가운데, 예전 머리 크기에 맞춘 소품이 맞게 크기를 정한다
  const headBox = boneVerticesBox(doc, prim, jointNode(doc, 'Head'));
  const headCenter = headBox.getCenter(new THREE.Vector3());
  const headRadius = (headBox.max.x - headBox.min.x) / 2;
  addSocket(doc, jointNode(doc, 'Head'), HEAD_SOCKET, headCenter, headRadius / OLD_HEAD_RADIUS);
  // 오른손 자리 (낚싯대)
  const handBox = boneVerticesBox(doc, prim, jointNode(doc, 'RightHand'));
  addSocket(doc, jointNode(doc, 'RightHand'), HAND_SOCKET, handBox.getCenter(new THREE.Vector3()), 1);
  if (spec.face) {
    const eyeY = await addFace(doc, prim, spec.height, spec.face);
    // 안경 자리: 머리 소품과 같은 크기·방향, 높이만 눈
    addSocket(doc, jointNode(doc, 'Head'), EYES_SOCKET, new THREE.Vector3(headCenter.x, eyeY, headCenter.z), headRadius / OLD_HEAD_RADIUS);
  }
  return headRadius;
}

// ───────────────────────── 실행 ─────────────────────────

const manifestPath = join(ROOT, 'manifest.json');
const licensesPath = join(ROOT, 'LICENSES.md');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, Record<string, unknown>>;
let licenses = readFileSync(licensesPath, 'utf8').trimEnd().split('\n');

// --only <manifest 키>: 그 모델만 다시 바꾼다 (예: --only pet.dog)
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
for (const spec of MODELS) {
  if (only && spec.key !== only) continue;
  await convert(spec);
  manifest[spec.key] = { file: spec.file };
  if (spec.old) {
    if (existsSync(join(ROOT, spec.old))) unlinkSync(join(ROOT, spec.old));
    licenses = licenses.filter((l) => !l.startsWith(`| ${spec.old} |`));
  }
  licenses = licenses.filter((l) => !l.startsWith(`| ${spec.file} |`));
  licenses.push(`| ${spec.file} | ${SOURCE_NOTE} | ${LICENSE_NOTE} | ${TODAY} |`);
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(licensesPath, `${licenses.join('\n')}\n`);
console.log('manifest.json·LICENSES.md를 고쳤습니다.');
