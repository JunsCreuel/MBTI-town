// 나의 방에서 쓰는 3D 모델과 창밖 풍경을 manifest 키로 불러온다. 한 번 받은 것은 다시 쓴다.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { assetUrl } from '@/assets/manifest';
import { ACCESSORIES } from '@/shared/avatar';
import { DISTRICTS, type District } from '@/shared/districts';
import { FURNITURE } from '@/shared/room';

export interface RoomAssets {
  avatar: GLTF;
  /** 소품 id → 머리 소품 모델 */
  accessories: Record<string, THREE.Object3D>;
  /** 소품 키 → 방 소품 모델 */
  furniture: Record<string, THREE.Object3D>;
  views: Record<District, THREE.Texture>;
}

let cache: Promise<RoomAssets> | null = null;

export function loadRoomAssets(onProgress?: (ratio: number) => void): Promise<RoomAssets> {
  cache ??= (async () => {
    const gltf = new GLTFLoader();
    const tex = new THREE.TextureLoader();
    const accessoryKeys = ACCESSORIES.filter((a) => a.key).map((a) => [a.id, a.key!] as const);
    const jobs = 1 + accessoryKeys.length + FURNITURE.length + DISTRICTS.length;
    let done = 0;
    const tick = <T,>(p: Promise<T>) => p.then((v) => (onProgress?.(++done / jobs), v));
    const [avatar, accessories, furniture, views] = await Promise.all([
      tick(gltf.loadAsync(assetUrl('char.base'))),
      Promise.all(accessoryKeys.map(([id, key]) => tick(gltf.loadAsync(assetUrl(key))).then((g) => [id, g.scene] as const))),
      Promise.all(FURNITURE.map((f) => tick(gltf.loadAsync(assetUrl(f.key))).then((g) => [f.key, g.scene] as const))),
      Promise.all(
        DISTRICTS.map((d) =>
          tick(tex.loadAsync(assetUrl(`room.view.${d}`))).then((t) => {
            t.colorSpace = THREE.SRGBColorSpace;
            return [d, t] as const;
          }),
        ),
      ),
    ]);
    return {
      avatar,
      accessories: Object.fromEntries(accessories),
      furniture: Object.fromEntries(furniture),
      views: Object.fromEntries(views) as Record<District, THREE.Texture>,
    };
  })();
  cache.catch(() => {
    cache = null;
  });
  return cache;
}
