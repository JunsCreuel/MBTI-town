'use client';

// 캐릭터 미리보기 (온보딩·옷장). 천천히 돌며 서 있다.
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { shiftLightness } from '@/design/mbti';
import { tokens } from '@/design/tokens';
import type { Avatar } from '@/shared/avatar';
import { useBodyModel } from './useBodyModel';
import { attachAccessory, characterActions, cloneCharacter, faceControl, tintOutfit } from '@/lib/characterRig';
import type { RoomAssets } from './assets';

function Model({ assets, avatar }: { assets: RoomAssets; avatar: Avatar }) {
  const color = tokens.avatar[avatar.color];
  const gltf = useBodyModel(assets, avatar.body);
  const { model, mixer, start } = useMemo(() => {
    const model = cloneCharacter(gltf);
    const tinted = tintOutfit(model, color);
    const face = faceControl(model);
    const acc = assets.accessories[avatar.accessory];
    if (acc) {
      const a = acc.clone();
      tinted.push(...tintOutfit(a, shiftLightness(color, -0.18)));
      attachAccessory(model, avatar.accessory, a);
    }
    const mixer = new THREE.AnimationMixer(model);
    const idle = characterActions(gltf, mixer, ['idle']).idle;
    const start = () => {
      idle.reset().play();
      return () => {
        mixer.stopAllAction();
        for (const m of tinted) m.dispose();
        face?.dispose();
      };
    };
    return { model, mixer, start };
  }, [assets, gltf, avatar.accessory, color]);
  useEffect(() => start(), [start]);
  useFrame(({ clock }, dt) => {
    mixer.update(Math.min(dt, 0.1));
    model.rotation.y = Math.sin(clock.elapsedTime * 0.6) * 0.5;
  });
  return <primitive object={model} />;
}

/** 캐릭터 가슴 높이를 바라본다 (Canvas가 처음 카메라 방향을 덮어쓰므로 장면 안에서 맞춘다) */
function Aim() {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.lookAt(0, 0.66, 0);
  }, [camera]);
  return null;
}

export default function AvatarPreview({ assets, avatar }: { assets: RoomAssets; avatar: Avatar }) {
  return (
    <Canvas camera={{ fov: 30, position: [0, 1.0, 4.4] }} gl={{ alpha: true, antialias: true }} dpr={[1, 2]}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
      }}
    >
      <Aim />
      <hemisphereLight args={[tokens.room.hemiSky, tokens.room.hemiGround, 2]} />
      <directionalLight position={[2, 4, 3]} intensity={1.6} color={tokens.room.sun} />
      <Model assets={assets} avatar={avatar} />
    </Canvas>
  );
}
