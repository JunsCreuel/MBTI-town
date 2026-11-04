'use client';

// 비콘 간판: 비콘 옆에 기둥 둘 달린 간판을 세워 어디로 가는 곳인지 글자로 보여 준다.
// - 광장: "낚시터"(나무 간판, 물고기 그림), "CLUB"(네온 간판), "상가"(나무 간판, 장바구니 그림)
// - 놀이터: "광장으로" (클럽 안에서는 초록 네온 EXIT)
// 글자는 캔버스로 그려 앞뒤 두 면에 붙인다 (뒤에서 봐도 거꾸로 보이지 않는다). 맵 파일은 건드리지 않는다.
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { assetUrl } from '@/assets/manifest';
import { tokens } from '@/design/tokens';
import { groundHeightAt } from '@/shared/townMap';
import { cardFont, loadImage } from '@/lib/shareCard';
import { useTown } from './context';
import { isIndoor } from './club';
import { beaconsOf } from './Play';

const S = tokens.scene;
const W = 512;
const H = 200;
/** 간판 판 크기 (칸) */
const BOARD_W = 2.0;
const BOARD_H = 0.82;
const BOARD_Y = 1.62;
/** 멀리서도 읽히게 조금 크게 */
const SCALE = 1.2;

type Style = 'fishing' | 'club' | 'market' | 'home' | 'exit';

async function drawSign(style: Style): Promise<HTMLCanvasElement> {
  await Promise.all([document.fonts?.load(cardFont(800, 80)), document.fonts?.load(cardFont(600, 30))]);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const neon = style === 'club' || style === 'exit';
  g.fillStyle = neon ? S.signDark : S.signFace;
  g.fillRect(0, 0, W, H);
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  const glow = (color: string, blur: number) => {
    g.shadowColor = color;
    g.shadowBlur = blur;
  };
  const textX = 196;
  if (style === 'fishing') {
    try {
      g.drawImage(await loadImage(assetUrl('item.fish.crucian')), 22, 26, 150, 150);
    } catch {
      // 그림 없이 글자만
    }
    g.fillStyle = S.signInk;
    g.font = cardFont(800, 84);
    g.fillText('낚시터', textX, 84);
    g.fillStyle = S.signSub;
    g.font = cardFont(600, 30);
    g.fillText('물고기를 낚아요', textX + 4, 150);
  } else if (style === 'market') {
    try {
      g.drawImage(await loadImage(assetUrl('ui.icon.basket')), 30, 34, 132, 132);
    } catch {
      // 그림 없이 글자만
    }
    g.fillStyle = S.signInk;
    g.font = cardFont(800, 84);
    g.fillText('상가', textX, 84);
    g.fillStyle = S.signSub;
    g.font = cardFont(600, 30);
    g.fillText('점포 20칸 · 내 가게 열기', textX + 4, 150);
  } else if (style === 'home') {
    // 집 모양 그림
    g.fillStyle = tokens.color.accent;
    g.beginPath();
    g.moveTo(97, 40);
    g.lineTo(162, 98);
    g.lineTo(144, 98);
    g.lineTo(144, 160);
    g.lineTo(50, 160);
    g.lineTo(50, 98);
    g.lineTo(32, 98);
    g.closePath();
    g.fill();
    g.fillStyle = S.signFace;
    g.fillRect(84, 118, 26, 42);
    g.fillStyle = tokens.color.accent;
    g.font = cardFont(800, 76);
    g.fillText('광장으로', textX - 6, 84);
    g.fillStyle = S.signSub;
    g.font = cardFont(600, 30);
    g.fillText('중앙광장으로 돌아가요', textX - 2, 150);
  } else {
    const main = style === 'club' ? S.clubNeon[0] : S.signExit;
    // 음표(클럽) 또는 화살표(출구)
    g.strokeStyle = style === 'club' ? S.clubNeon[2] : S.signExit;
    g.fillStyle = g.strokeStyle;
    g.lineWidth = 8;
    g.lineCap = 'round';
    glow(g.strokeStyle, 18);
    if (style === 'club') {
      g.beginPath();
      g.ellipse(70, 140, 22, 16, -0.4, 0, Math.PI * 2);
      g.ellipse(140, 124, 22, 16, -0.4, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(90, 136);
      g.lineTo(90, 52);
      g.lineTo(160, 36);
      g.lineTo(160, 120);
      g.stroke();
    } else {
      // 열린 문 (앞뒤 어느 쪽에서 봐도 방향이 헷갈리지 않게 화살표 대신)
      g.beginPath();
      g.rect(56, 40, 76, 120);
      g.moveTo(56, 40);
      g.lineTo(98, 56);
      g.lineTo(98, 172);
      g.lineTo(56, 160);
      g.stroke();
      g.beginPath();
      g.arc(88, 106, 5, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = main;
    glow(main, 26);
    g.font = cardFont(800, style === 'club' ? 104 : 92);
    g.fillText(style === 'club' ? 'CLUB' : 'EXIT', textX, 86);
    g.fillStyle = S.signNeonSub;
    glow(S.signNeonSub, 12);
    g.font = cardFont(600, 30);
    g.fillText(style === 'club' ? '클럽 · EDM 파티' : '광장으로 돌아가기', textX + 4, 156);
    // 네온 테두리
    g.strokeStyle = main;
    g.lineWidth = 5;
    glow(main, 20);
    g.strokeRect(10, 10, W - 20, H - 20);
  }
  return c;
}

function Sign({ style, x, z, yaw }: { style: Style; x: number; z: number; yaw: number }) {
  const { map } = useTown();
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    let alive = true;
    let made: THREE.CanvasTexture | null = null;
    drawSign(style).then((canvas) => {
      if (!alive) return;
      made = new THREE.CanvasTexture(canvas);
      made.colorSpace = THREE.SRGBColorSpace;
      made.anisotropy = 4;
      setTexture(made);
    });
    return () => {
      alive = false;
      made?.dispose();
    };
  }, [style]);
  const neon = style === 'club' || style === 'exit';
  const y = groundHeightAt(map, x, z);
  const frame = neon ? S.signDark : S.signWood;
  const post = neon ? S.clubTileOff : S.signWoodDark;
  return (
    <group position={[x, y, z]} rotation-y={yaw} scale={SCALE}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (BOARD_W / 2 - 0.12), (BOARD_Y + BOARD_H / 2) / 2, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.065, BOARD_Y + BOARD_H / 2, 8]} />
          <meshStandardMaterial color={post} roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, BOARD_Y, 0]} castShadow>
        <boxGeometry args={[BOARD_W + 0.12, BOARD_H + 0.12, 0.08]} />
        <meshStandardMaterial color={frame} roughness={0.8} />
      </mesh>
      {texture &&
        [0, Math.PI].map((r) => (
          <group key={r} rotation-y={r}>
            {/* 판 앞면(뒷면) 바로 위에 붙인다 */}
            <mesh position={[0, BOARD_Y, 0.045]}>
              <planeGeometry args={[BOARD_W, BOARD_H]} />
              {/* 글자가 늘 잘 보이게 빛을 받지 않는 재질 (네온은 더 밝게) */}
              <meshBasicMaterial map={texture} toneMapped={!neon} />
            </mesh>
          </group>
        ))}
    </group>
  );
}

/** 비콘마다 간판 하나. 본섬(비콘 둘)은 가는 곳, 놀이터(비콘 하나)는 광장으로 돌아가는 곳 */
export function BeaconSigns() {
  const { map } = useTown();
  const signs = useMemo(() => {
    const beacons = beaconsOf(map);
    const isReturn = beacons.length === 1;
    const indoor = isIndoor(map);
    return beacons.map((b) => {
      // 비콘의 왼쪽 옆 (비콘이 바라보는 쪽에서 볼 때), 같은 방향을 본다
      const lx = -1.6;
      const lz = 0.15;
      const x = b.x + lx * Math.cos(b.yaw) + lz * Math.sin(b.yaw);
      const z = b.z - lx * Math.sin(b.yaw) + lz * Math.cos(b.yaw);
      const style: Style = isReturn ? (indoor ? 'exit' : 'home') : b.kind;
      return { key: `${b.kind}:${b.x}:${b.z}`, style, x, z, yaw: b.yaw };
    });
  }, [map]);
  return (
    <>
      {signs.map((s) => (
        <Sign key={s.key} style={s.style} x={s.x} z={s.z} yaw={s.yaw} />
      ))}
    </>
  );
}
