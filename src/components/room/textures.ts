// 벽지와 바닥 무늬를 코드로 그린다 (색은 tokens.room). 한 번 만든 무늬는 다시 쓴다.
import * as THREE from 'three';
import { tokens } from '@/design/tokens';
import type { FloorId, WallpaperId } from '@/shared/room';

const R = tokens.room;
const cache = new Map<string, THREE.CanvasTexture>();

function make(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** 벽지: 한 장이 벽 한 칸(1×1)을 덮는다 */
export function wallTexture(id: WallpaperId): THREE.CanvasTexture {
  return make(`wall:${id}`, 256, (ctx, s) => {
    ctx.fillStyle = R.wall[id];
    ctx.fillRect(0, 0, s, s);
    const pattern = (R.wallPattern as Record<string, string>)[id];
    if (id === 'mint-stripe') {
      ctx.fillStyle = pattern;
      for (let x = 0; x < s; x += s / 4) ctx.fillRect(x, 0, s / 10, s);
    } else if (id === 'sky-dot' || id === 'night') {
      ctx.fillStyle = pattern;
      const step = s / 4;
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        ctx.beginPath();
        const r = id === 'night' ? (x + y) % 3 === 0 ? 5 : 2.5 : 7;
        ctx.arc(x * step + (y % 2 ? step / 2 : 0) + step / 4, y * step + step / 2, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // 민무늬는 아주 옅은 결만
      ctx.fillStyle = 'rgb(255 255 255 / 0.18)';
      for (let y = 0; y < s; y += 8) ctx.fillRect(0, y, s, 2);
    }
  });
}

/** 바닥: 한 장이 바닥 한 칸(1×1)을 덮는다 */
export function floorTexture(id: FloorId): THREE.CanvasTexture {
  return make(`floor:${id}`, 256, (ctx, s) => {
    ctx.fillStyle = R.floor[id];
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = R.floorLine;
    if (id === 'oak' || id === 'walnut') {
      // 판자 네 줄, 줄마다 이음새 위치를 다르게
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(0, (i * s) / 4, s, 3);
        ctx.fillRect(((i * 0.37 + 0.2) % 1) * s, (i * s) / 4, 3, s / 4);
        ctx.fillStyle = `rgb(255 255 255 / ${0.05 + (i % 2) * 0.04})`;
        ctx.fillRect(0, (i * s) / 4 + 3, s, s / 4 - 3);
        ctx.fillStyle = R.floorLine;
      }
    } else if (id === 'tile' || id === 'mint-tile') {
      ctx.fillRect(0, 0, s, 4);
      ctx.fillRect(0, 0, 4, s);
      ctx.fillRect(0, s / 2, s, 3);
      ctx.fillRect(s / 2, 0, 3, s);
    } else {
      // 카펫: 잔잔한 결
      for (let i = 0; i < 600; i++) {
        ctx.fillStyle = `rgb(255 255 255 / ${0.06 + ((i * 37) % 10) / 100})`;
        ctx.fillRect((i * 97) % s, (i * 61) % s, 2, 2);
      }
    }
  });
}
