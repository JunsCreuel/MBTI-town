'use client';

// 캐릭터 몸(남자·여자) 모델: 남자 모델은 방 에셋과 함께 받아 두고, 여자 모델은 처음 쓸 때 받는다.
// 받는 동안은 남자 모델로 그린다 (마을과 같은 캐시를 쓴다).
import { useEffect, useState } from 'react';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { isAvatarBody, type AvatarBody } from '@/shared/avatar';
import { loadCharacter } from '../village/assets';
import type { RoomAssets } from './assets';

export function useBodyModel(assets: RoomAssets, body: AvatarBody | '' | undefined): GLTF {
  const want: AvatarBody = isAvatarBody(body) ? body : 'male';
  const [loaded, setLoaded] = useState<Partial<Record<AvatarBody, GLTF>>>({ male: assets.avatar });
  const gltf = loaded[want];
  useEffect(() => {
    if (gltf) return;
    let live = true;
    loadCharacter(want)
      .then((g) => live && setLoaded((m) => ({ ...m, [want]: g })))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [want, gltf]);
  return gltf ?? assets.avatar;
}
