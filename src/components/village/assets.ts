// 마을에서 쓰는 3D 모델과 머리 위 표시를 manifest 키로 불러온다.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { assetUrl } from '@/assets/manifest';
import { tokens } from '@/design/tokens';
import { ACCESSORIES } from '@/shared/avatar';
import { allFloraKeys } from '@/shared/flora';
import type { TownMap } from '@/shared/townMap';
import { EMOTES, type EmoteKind } from '@/shared/protocol';
import { EMOTE_INFO } from '../app/gestures';
import { hasClubNpcs, hasGuideNpc } from './npc';

/** 집터에 세우는 모델 */
export const HOUSE_KEY = 'prop.town.house';
export const LOT_KEY = 'prop.town.lot';
/** 동네 길 아치 (본섬 ↔ 2동·3동…) */
export const GATE_KEY = 'prop.hood.gate';

export interface TownAssets {
  character: GLTF;
  /** 머리 소품 id → 모델 */
  accessories: Record<string, THREE.Object3D>;
  /** manifest 키 → 마을 소품 모델 (집·빈 집터 포함) */
  props: Record<string, THREE.Object3D>;
  emotes: Record<EmoteKind, THREE.Texture>;
  /** 낚싯대 (낚시할 때 오른손에 든다) */
  rod: THREE.Object3D;
  /** NPC: 광장 안내 몬냥이(광장 맵), 클럽 DJ·바텐더(클럽 맵). 그 맵에서만 받는다 */
  npcs: Partial<Record<NpcKind, GLTF>>;
}

export type NpcKind = 'guide' | 'dj' | 'bartender';
const NPC_KEYS: Record<NpcKind, string> = { guide: 'char.npc.monnyang', dj: 'char.npc.dj', bartender: 'char.npc.bartender' };

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

function emoteTexture(kind: EmoteKind): Promise<THREE.Texture> {
  const { icon, color } = EMOTE_INFO[kind];
  return bubbleTexture(icon, color);
}

const bubbleCache = new Map<string, Promise<THREE.Texture>>();

/** 말풍선 그림: 아이콘(manifest 키)을 색으로 칠해 말풍선 안에 넣는다. 같은 것은 한 번만 만든다 */
export function bubbleTexture(key: string, color: string): Promise<THREE.Texture> {
  const id = `${key}|${color}`;
  let p = bubbleCache.get(id);
  if (!p) {
    p = drawBubble(key, color);
    bubbleCache.set(id, p);
    p.catch(() => bubbleCache.delete(id));
  }
  return p;
}

async function drawBubble(key: string, color: string): Promise<THREE.Texture> {
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

let emoteCache: Promise<Record<EmoteKind, THREE.Texture>> | null = null;

/** 머리 위 이모티콘 말풍선 그림 (마을과 방이 같이 쓴다, 한 번만 만든다) */
export function loadEmoteTextures(): Promise<Record<EmoteKind, THREE.Texture>> {
  emoteCache ??= Promise.all(EMOTES.map(async (e) => [e, await emoteTexture(e)] as const)).then(
    (list) => Object.fromEntries(list) as Record<EmoteKind, THREE.Texture>,
  );
  emoteCache.catch(() => {
    emoteCache = null;
  });
  return emoteCache;
}

const ROD_KEY = 'prop.tool.rod';

export async function loadTownAssets(map: TownMap, onProgress: (ratio: number) => void): Promise<TownAssets> {
  const loader = new GLTFLoader();
  const accessoryKeys = ACCESSORIES.filter((a) => a.key).map((a) => [a.id, a.key!] as const);
  // 맵 소품 + 집 + 화면이 흩뿌리는 풀·꽃 (지역 식물 전부)
  const propKeys = [...new Set([...map.props.map((p) => p.key), HOUSE_KEY, LOT_KEY, ...allFloraKeys()])];
  // 같은 파일을 여러 키가 쓰면 한 번만 받는다
  const npcKinds: NpcKind[] = [...(hasGuideNpc(map) ? (['guide'] as const) : []), ...(hasClubNpcs(map) ? (['dj', 'bartender'] as const) : [])];
  const urls = [...new Set(['char.base', ROD_KEY, ...npcKinds.map((k) => NPC_KEYS[k]), ...accessoryKeys.map(([, k]) => k), ...propKeys].map(assetUrl))];
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
  const emotes = await loadEmoteTextures();
  onProgress(1);
  return {
    character: models.get(assetUrl('char.base'))!,
    accessories: Object.fromEntries(accessoryKeys.map(([id, key]) => [id, models.get(assetUrl(key))!.scene])),
    props: Object.fromEntries(propKeys.map((k) => [k, models.get(assetUrl(k))!.scene])),
    emotes,
    rod: models.get(assetUrl(ROD_KEY))!.scene,
    npcs: Object.fromEntries(npcKinds.map((k) => [k, models.get(assetUrl(NPC_KEYS[k]))!])),
  };
}

const tagCache = new Map<string, { texture: THREE.Texture; aspect: number; rel: number }>();

/**
 * 이름표: 색 점 + 이름, 둘째 줄에 작게 MBTI·일주(sub). 내 캐릭터는 강조색 바탕에 "나"를 붙인다.
 * rel = 한 줄짜리 이름표 대비 높이 (두 줄이면 더 높다). 같은 이름표는 한 번만 만든다.
 */
export function tagTexture(label: string, dotColor: string | null, self = false, sub = '') {
  const key = `${label}|${dotColor}|${self}|${sub}`;
  const cached = tagCache.get(key);
  if (cached) return cached;
  const scale = 4;
  const font = `700 ${15 * scale}px ${tokens.font.base}`;
  const subFont = `600 ${11 * scale}px ${tokens.font.base}`;
  const probe = canvas(1, 1).ctx;
  probe.font = font;
  const textW = probe.measureText(label).width;
  probe.font = subFont;
  const subW = sub ? probe.measureText(sub).width : 0;
  const dot = dotColor ? 8 * scale : 0;
  const gap = dotColor ? 5 * scale : 0;
  const padX = 11 * scale;
  const W = Math.ceil(Math.max(textW + dot + gap, subW) + padX * 2);
  const H = (sub ? 44 : 30) * scale;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = self ? tokens.color.accent : tokens.scene.tagBg;
  ctx.beginPath();
  ctx.roundRect(2 * scale, 2 * scale, W - 4 * scale, H - 4 * scale, Math.min(H / 2, 15 * scale));
  ctx.fill();
  ctx.textBaseline = 'middle';
  // 첫 줄 가운데 높이 (한 줄이면 가운데, 두 줄이면 위쪽)
  const line1 = sub ? 16 * scale : H / 2;
  const startX = (W - (textW + dot + gap)) / 2;
  if (dotColor) {
    ctx.fillStyle = dotColor;
    ctx.beginPath();
    ctx.arc(startX + dot / 2, line1, dot / 2, 0, Math.PI * 2);
    ctx.fill();
    if (self) {
      ctx.strokeStyle = tokens.color.accentText;
      ctx.lineWidth = 1.5 * scale;
      ctx.stroke();
    }
  }
  ctx.font = font;
  ctx.fillStyle = self ? tokens.color.accentText : tokens.scene.tagText;
  ctx.fillText(label, startX + dot + gap, line1 + scale);
  if (sub) {
    ctx.font = subFont;
    ctx.globalAlpha = 0.78;
    ctx.textAlign = 'center';
    ctx.fillText(sub, W / 2, 31 * scale);
    ctx.globalAlpha = 1;
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const out = { texture, aspect: W / H, rel: H / (30 * scale) };
  tagCache.set(key, out);
  return out;
}
