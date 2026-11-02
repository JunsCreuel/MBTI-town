// 광장에서 쓰는 3D 모델과 머리 위 표시를 manifest 키로 불러온다.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { assetUrl } from '@/assets/manifest';
import { MBTI_TYPES, mbtiColor, type MbtiType } from '@/design/mbti';
import { tokens } from '@/design/tokens';
import type { PlazaMap } from '@/shared/plazaMap';
import { EMOTES, type EmoteKind } from '@/shared/protocol';

export interface PlazaAssets {
  character: GLTF;
  /** 유형별 소품 모델 (같은 파일을 쓰는 유형은 같은 객체) */
  typeProps: Record<MbtiType, THREE.Object3D>;
  /** manifest 키 → 광장 소품 모델 */
  props: Record<string, THREE.Object3D>;
  emotes: Record<EmoteKind, THREE.Texture>;
}

// 이모티콘 말풍선 안에 그릴 UI 아이콘
const EMOTE_ICON: Record<EmoteKind, { key: string; color: string }> = {
  clap: { key: 'ui.icon.clap', color: tokens.color.accent },
  heart: { key: 'ui.icon.heart', color: tokens.scene.heart },
  question: { key: 'ui.icon.question', color: tokens.color.accent },
  wow: { key: 'ui.icon.wow', color: tokens.color.accent },
};

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

/** SVG 아이콘의 currentColor를 색으로 바꿔 그림으로 만든다 */
async function iconImage(key: string, color: string): Promise<HTMLImageElement> {
  const svg = (await (await fetch(assetUrl(key))).text()).replaceAll('currentColor', color);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  return img;
}

async function emoteTexture(kind: EmoteKind): Promise<THREE.Texture> {
  const { key, color } = EMOTE_ICON[kind];
  const icon = await iconImage(key, color);
  const S = 128;
  const { c, ctx } = canvas(S, S);
  ctx.fillStyle = tokens.scene.tagBg;
  ctx.shadowColor = tokens.color.shadow;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.roundRect(8, 6, S - 16, S - 34, 30);
  ctx.moveTo(S / 2 - 12, S - 29);
  ctx.lineTo(S / 2, S - 12);
  ctx.lineTo(S / 2 + 12, S - 29);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.drawImage(icon, S / 2 - 30, 18, 60, 60);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function loadPlazaAssets(map: PlazaMap, onProgress: (ratio: number) => void): Promise<PlazaAssets> {
  const loader = new GLTFLoader();
  const typePropKeys = MBTI_TYPES.map((t) => `char.${t.toLowerCase()}.prop`);
  const propKeys = [...new Set(map.props.map((p) => p.key))];
  // 같은 파일을 여러 키가 쓰면 한 번만 받는다
  const urls = [...new Set(['char.base', ...typePropKeys, ...propKeys].map(assetUrl))];
  let done = 0;
  const models = new Map(
    await Promise.all(
      urls.map(async (url) => {
        const gltf = await loader.loadAsync(url);
        onProgress(++done / (urls.length + EMOTES.length));
        return [url, gltf] as const;
      }),
    ),
  );
  const emotes = await Promise.all(
    EMOTES.map(async (e) => {
      const t = await emoteTexture(e);
      onProgress(++done / (urls.length + EMOTES.length));
      return [e, t] as const;
    }),
  );
  return {
    character: models.get(assetUrl('char.base'))!,
    typeProps: Object.fromEntries(
      MBTI_TYPES.map((t, i) => [t, models.get(assetUrl(typePropKeys[i]))!.scene as THREE.Object3D]),
    ) as Record<MbtiType, THREE.Object3D>,
    props: Object.fromEntries(propKeys.map((k) => [k, models.get(assetUrl(k))!.scene])),
    emotes: Object.fromEntries(emotes) as Record<EmoteKind, THREE.Texture>,
  };
}

const tagCache = new Map<string, { texture: THREE.Texture; aspect: number }>();

/** 머리 위 이름표: 유형 색 점 + 유형 코드. 내 캐릭터는 "나"를 붙인다. */
export function tagTexture(mbti: MbtiType, self: boolean) {
  const key = `${mbti}:${self}`;
  const cached = tagCache.get(key);
  if (cached) return cached;
  const scale = 4;
  const W = (self ? 104 : 80) * scale;
  const H = 30 * scale;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = self ? tokens.color.accent : tokens.scene.tagBg;
  ctx.beginPath();
  ctx.roundRect(2 * scale, 2 * scale, W - 4 * scale, H - 4 * scale, H / 2);
  ctx.fill();
  ctx.font = `700 ${15 * scale}px ${tokens.font.base}`;
  ctx.textBaseline = 'middle';
  const label = self ? `나 · ${mbti}` : mbti;
  const textW = ctx.measureText(label).width;
  const dot = 8 * scale;
  const gap = 5 * scale;
  const startX = (W - (dot + gap + textW)) / 2;
  ctx.fillStyle = mbtiColor(mbti);
  ctx.beginPath();
  ctx.arc(startX + dot / 2, H / 2, dot / 2, 0, Math.PI * 2);
  ctx.fill();
  if (self) {
    ctx.strokeStyle = tokens.color.accentText;
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();
  }
  ctx.fillStyle = self ? tokens.color.accentText : tokens.scene.tagText;
  ctx.fillText(label, startX + dot + gap, H / 2 + scale);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const out = { texture, aspect: W / H };
  tagCache.set(key, out);
  return out;
}
