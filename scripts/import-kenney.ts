// Kenney Nature Kit(CC0)에서 고른 모델을 우리 색·크기로 바꿔 public/assets/props/nature/ 에 넣는다.
// 원본 묶음은 저장소에 넣지 않는다. 받는 곳: https://opengameart.org/content/nature-kit ("Nature Kit (2.1).zip")
// 쓰는 법: npm run assets:kenney -- "<압축 푼 폴더>/Models/GLTF format"
// manifest.json에 prop.nature.* 키를 넣고, LICENSES.md에 출처를 한 줄씩 적는다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { FOLIAGE_MATERIALS, KENNEY_MODELS, KENNEY_PALETTE, fileFor, keyFor } from './lib/kenney';

const SRC = process.argv[2];
if (!SRC || !existsSync(SRC)) {
  console.error('Kenney Nature Kit의 "Models/GLTF format" 폴더 경로를 주세요.');
  process.exit(1);
}
const ROOT = join(import.meta.dirname, '..', 'public', 'assets');
const TODAY = new Date().toISOString().slice(0, 10);
const SOURCE = 'Kenney Nature Kit 2.1 (www.kenney.nl, https://opengameart.org/content/nature-kit), 색·크기 조정';

/** sRGB hex → 선형 색 */
function linear(hex: string): [number, number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255), 1];
}

const io = new NodeIO();
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')) as Record<string, Record<string, unknown>>;
const licensesPath = join(ROOT, 'LICENSES.md');
const licenses = readFileSync(licensesPath, 'utf8').trimEnd().split('\n');

for (const m of KENNEY_MODELS) {
  const doc = await io.read(join(SRC, `${m.src}.glb`));
  // 원본의 KHR_materials_unlit은 읽지 않으므로 빠지고, 빛을 받는 재질이 된다
  for (const mat of doc.getRoot().listMaterials()) {
    const name = mat.getName();
    const color = m.colors?.[name] ?? KENNEY_PALETTE[name];
    if (color) mat.setBaseColorFactor(linear(color));
    mat.setRoughnessFactor(0.9).setMetallicFactor(0);
    if (FOLIAGE_MATERIALS.has(name)) mat.setName('foliage');
  }
  // 크기: 장면의 맨 위 노드들을 한 노드로 묶어 키운다
  const scene = doc.getRoot().listScenes()[0];
  const root = doc.createNode(m.key).setScale([m.scale, m.scale, m.scale]);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    root.addChild(child);
  }
  scene.addChild(root);
  const file = fileFor(m);
  const path = join(ROOT, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, await io.writeBinary(doc));
  manifest[keyFor(m)] = { file };
  if (!licenses.some((l) => l.startsWith(`| ${file} |`))) licenses.push(`| ${file} | ${SOURCE} | CC0 1.0 | ${TODAY} |`);
}

writeFileSync(join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(licensesPath, licenses.join('\n') + '\n');
console.log(`Kenney 모델 ${KENNEY_MODELS.length}개를 넣었습니다.`);
