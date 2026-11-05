// 펫 고르기 창의 펫 사진을 만든다: 펫 모델(pets.ts의 PETS)을 게임과 같은 조명으로 그려 배경이 투명한 그림으로 저장한다.
// npm run assets:pet-thumbs  (Playwright Chromium이 필요하다. 그림은 public/assets/pets/pet_<id>_thumb.webp, manifest 키 pet.<id>.thumb)
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';
import sharp from 'sharp';
import { PETS } from '../src/shared/pets';

const ROOT = join(import.meta.dirname, '..');
const ASSETS = join(ROOT, 'public', 'assets');
const THREE_DIR = join(ROOT, 'node_modules', 'three');
/** 그리는 크기 (px). 창에서는 80px 안팎으로 보인다 (화면 배율 3까지 또렷하게) */
const SIZE = 320;
const TODAY = new Date().toISOString().slice(0, 10);
const SOURCE_NOTE = (glb: string) => `${glb} 모델을 그려 만든 펫 사진 (scripts/render-pet-thumbs.ts)`;
const LICENSE_NOTE = '프로젝트 소유 [결정 필요: Tripo 요금제의 상업적 이용 권한 확인]';

const PAGE = `<!doctype html><html><body style="margin:0">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(${SIZE}, ${SIZE});
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
document.body.appendChild(renderer.domElement);
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
window.renderPet = async (url) => {
  const g = await loader.loadAsync(url);
  const root = g.scene;
  // 마을·방처럼 털을 조금 밝게 (characterRig.ts brightenFur). 사진은 밝은 칸 위에 놓이므로 털 결이 보이게 덜 밝힌다
  root.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    if (m.map && 'emissive' in m) { m.emissiveMap = m.map; m.emissive.setScalar(0.1); m.needsUpdate = true; }
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c8c0, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(2.5, 3, 3);
  scene.add(sun);
  scene.add(root);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  // 살짝 옆에서, 조금 위에서 본 모습. 모델 전체가 칸을 채우게 거리를 맞춘다
  const cam = new THREE.PerspectiveCamera(26, 1, 0.01, 100);
  const yaw = 0.55;
  const radius = Math.max(size.x, size.y, size.z) * 0.68;
  const dist = radius / Math.tan(THREE.MathUtils.degToRad(13));
  cam.position.set(center.x + Math.sin(yaw) * dist, center.y + dist * 0.22, center.z + Math.cos(yaw) * dist);
  cam.lookAt(center);
  renderer.render(scene, cam);
  return renderer.domElement.toDataURL('image/png');
};
window.ready = true;
</script></body></html>`;

const TYPES: Record<string, string> = { '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.html': 'text/html' };
const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  try {
    let body: Buffer | string;
    if (url === '/') body = PAGE;
    else if (url.startsWith('/three/')) body = readFileSync(join(THREE_DIR, url.slice('/three/'.length)));
    else if (url.startsWith('/assets/')) body = readFileSync(join(ASSETS, url.slice('/assets/'.length)));
    else throw new Error('없는 주소');
    res.writeHead(200, { 'content-type': TYPES[extname(url)] ?? (url === '/' ? 'text/html' : 'application/octet-stream') });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = (server.address() as { port: number }).port;

// Playwright는 프로젝트 의존성이 아니다 (개발 도구로 따로 깔린 것을 쓴다). 쓰는 것만 타입을 적는다
interface Page {
  goto(url: string): Promise<unknown>;
  waitForFunction(fn: () => unknown): Promise<unknown>;
  evaluate<R, A>(fn: (arg: A) => R | Promise<R>, arg: A): Promise<R>;
}
interface Browser {
  newPage(options: { viewport: { width: number; height: number } }): Promise<Page>;
  close(): Promise<void>;
}
const { chromium } = createRequire(import.meta.url)('playwright') as { chromium: { launch(): Promise<Browser> } };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => (window as unknown as { ready?: boolean }).ready);

const manifestPath = join(ASSETS, 'manifest.json');
const licensesPath = join(ASSETS, 'LICENSES.md');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, { file: string }>;
let licenses = readFileSync(licensesPath, 'utf8').trimEnd().split('\n');
for (const pet of PETS) {
  const glb = manifest[pet.key].file;
  const png = await page.evaluate((u: string) => (window as unknown as { renderPet: (u: string) => Promise<string> }).renderPet(u), `/assets/${glb}`);
  const file = `pets/pet_${pet.id}_thumb.webp`;
  const out = await sharp(Buffer.from(png.split(',')[1], 'base64')).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
  writeFileSync(join(ASSETS, file), out);
  manifest[`pet.${pet.id}.thumb`] = { file };
  licenses = licenses.filter((l) => !l.startsWith(`| ${file} |`));
  licenses.push(`| ${file} | ${SOURCE_NOTE(glb)} | ${LICENSE_NOTE} | ${TODAY} |`);
  console.log(`${pet.name}: ${file} (${(out.byteLength / 1024).toFixed(0)}KB)`);
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(licensesPath, `${licenses.join('\n')}\n`);
await browser.close();
server.close();
