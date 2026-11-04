'use client';

// 클럽 전광판: DJ 부스 뒤 북쪽 벽에 건 큰 화면. 지금 나오는 곡(목록 곡 또는 유튜브 신청곡), 신청한 사람, 진행 막대,
// 다음 곡과 기다리는 신청곡 수를 보여 주고, 아래 막대가 박자에 맞춰 뛴다. 글은 바뀔 때와 1초마다만 다시 그린다.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { tokens } from '@/design/tokens';
import { CLUB_TRACKS } from '@/shared/clubMusic';
import { creditLine } from '@/shared/music';
import { groundHeightAt } from '@/shared/townMap';
import { cardFont, wrapText } from '@/lib/shareCard';
import { clubNext, clubPulse, clubQueue, clubSchedule, songTitle } from './club';
import { useTown } from './context';

const S = tokens.scene;
const NEON = S.clubNeon;
/** 화면 크기 (칸). 카메라가 위에서 내려다봐서 낮고 넓게, 조금 젖혀 건다 */
const W = 5.2;
const H = 1.72;
/** 위 가장자리는 벽에 붙이고 아래를 앞으로 낸다 (라디안) */
const TILT = 0.45;
/** 화면 위 가장자리 높이 (바닥에서) */
const TOP = 3.0;
/** 캔버스 크기 (화면 비율과 같다) */
const CW = 1024;
const CH = Math.round((CW * H) / W);
const BARS = 22;

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** 한 줄에 들어가게 자른다 (넘치면 …) */
function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  const chars = [...text];
  while (chars.length && ctx.measureText(`${chars.join('')}…`).width > maxW) chars.pop();
  return `${chars.join('')}…`;
}

function draw(ctx: CanvasRenderingContext2D) {
  const s = clubSchedule();
  const next = clubNext();
  const waiting = clubQueue().length;
  ctx.fillStyle = S.signDark;
  ctx.fillRect(0, 0, CW, CH);
  // 옅은 네온 빛 배경
  const g = ctx.createLinearGradient(0, 0, CW, CH);
  g.addColorStop(0, NEON[1]);
  g.addColorStop(1, NEON[0]);
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CW, CH);
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const px = 48;
  const inner = CW - px * 2;
  ctx.fillStyle = NEON[0];
  ctx.font = cardFont(800, 28);
  ctx.fillText('NOW PLAYING', px, 62);
  if (!s) {
    ctx.fillStyle = S.clubBall;
    ctx.font = cardFont(800, 60);
    ctx.fillText('곧 음악이 나와요', px, 160);
    return;
  }
  // 오른쪽 위: 어떤 곡인지
  const badge = s.yt ? '유튜브 신청곡' : s.by ? '신청곡' : '클럽 플레이리스트';
  ctx.font = cardFont(800, 26);
  const bw = ctx.measureText(badge).width + 36;
  ctx.fillStyle = s.yt ? tokens.color.youtube : s.by ? NEON[1] : NEON[2];
  ctx.beginPath();
  ctx.roundRect(CW - px - bw, 30, bw, 44, 22);
  ctx.fill();
  ctx.fillStyle = tokens.color.accentText;
  ctx.textAlign = 'center';
  ctx.fillText(badge, CW - px - bw / 2, 62);
  ctx.textAlign = 'left';
  // 곡 이름과 신청한 사람
  ctx.fillStyle = S.clubBall;
  ctx.font = cardFont(800, 68);
  ctx.fillText(fit(ctx, songTitle(s), inner), px, 150);
  ctx.fillStyle = S.signNeonSub;
  ctx.font = cardFont(600, 30);
  const track = s.yt ? null : CLUB_TRACKS[s.index];
  ctx.fillText(fit(ctx, s.by ? `${s.by}의 신청곡` : track ? creditLine(track) : '유튜브', inner), px, 200);
  // 진행 막대와 시간
  const total = s.offset + s.left;
  const barY = CH - 88;
  ctx.fillStyle = S.clubTileOff;
  ctx.beginPath();
  ctx.roundRect(px, barY, inner, 12, 6);
  ctx.fill();
  ctx.fillStyle = NEON[2];
  ctx.beginPath();
  ctx.roundRect(px, barY, Math.max(12, inner * Math.min(1, total > 0 ? s.offset / total : 0)), 12, 6);
  ctx.fill();
  ctx.fillStyle = S.signNeonSub;
  ctx.font = cardFont(600, 26);
  const ty = barY + 48;
  ctx.fillText(mmss(s.offset), px, ty);
  ctx.textAlign = 'right';
  ctx.fillText(mmss(total), CW - px, ty);
  // 다음 곡
  if (next) {
    ctx.textAlign = 'center';
    ctx.fillStyle = S.clubBall;
    ctx.font = cardFont(700, 26);
    ctx.fillText(fit(ctx, `다음 곡 · ${songTitle(next)}${waiting > 1 ? ` 외 신청곡 ${waiting - 1}곡` : ''}`, inner - 240), CW / 2, ty);
  }
}

export function ClubScreen() {
  const { map, input } = useTown();
  /** 북쪽 벽 (정면 = 남쪽, 홀 안쪽) */
  const place = useMemo(() => {
    const north = map.props.filter((p) => p.key === 'prop.club.wall' && Math.abs(p.yaw) < 0.01);
    if (!north.length || !map.props.some((p) => p.key === 'prop.club.booth')) return null;
    const z = Math.min(...north.map((p) => p.z));
    const x = map.width / 2;
    return { x, wallZ: z, z: z + 0.3, y: groundHeightAt(map, x, z + 1) + TOP };
  }, [map]);
  const canvas = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = CW;
    c.height = CH;
    return c;
  }, []);
  const texture = useMemo(() => {
    if (!canvas) return null;
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  useEffect(() => () => texture?.dispose(), [texture]);
  const group = useRef<THREE.Group>(null);
  const bars = useRef<THREE.InstancedMesh>(null);
  const last = useRef({ at: -1, key: '' });
  const o = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  // 글꼴을 읽으면 다시 그린다
  useEffect(() => {
    void document.fonts?.ready.then(() => {
      last.current.at = -1;
    });
  }, []);

  useFrame(() => {
    if (!place || !canvas || !texture) return;
    // 카메라 쪽 벽이 되면 (벽이 흐려지면) 화면도 숨긴다
    const g = group.current;
    if (g) {
      const yaw = input.camera.yawNow;
      const vis = input.view !== 'walk' || (place.x - input.self.x) * Math.sin(yaw) + (place.wallZ - input.self.z) * Math.cos(yaw) <= 0.4;
      g.visible = vis;
      if (!vis) return;
    }
    const t = performance.now();
    const s = clubSchedule();
    const key = `${s ? songTitle(s) : ''}|${s?.by ?? ''}|${clubQueue().length}`;
    if (key !== last.current.key || t - last.current.at > 1000) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        draw(ctx);
        texture.needsUpdate = true;
      }
      last.current = { at: t, key };
    }
    const m = bars.current;
    if (m) {
      const beat = clubPulse();
      const level = beat ? beat.level : 0.3;
      const step = beat ? beat.step : 0;
      for (let i = 0; i < BARS; i++) {
        // 박마다 막대 높이가 조금씩 다르게 뛴다
        const wobble = 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + step * 0.9));
        const h = 0.05 + 0.3 * level * wobble;
        o.position.set(-W / 2 + (i + 0.5) * (W / BARS), H / 2 + 0.16 + h / 2, -0.02);
        o.scale.set(W / BARS - 0.06, h, 0.04);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        m.setColorAt(i, col.set(NEON[(i + Math.floor(step / 2)) % NEON.length]));
      }
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  });

  if (!place || !texture) return null;
  return (
    <group ref={group} position={[place.x, place.y, place.z]} rotation={[-TILT, 0, 0]}>
      <group position={[0, -H / 2 - 0.5, 0]}>
      {/* 테두리 */}
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[W + 0.24, H + 0.24, 0.08]} />
        <meshStandardMaterial color={S.clubTileOff} roughness={0.5} />
      </mesh>
      <mesh>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <instancedMesh ref={bars} args={[undefined, undefined, BARS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      </group>
    </group>
  );
}
