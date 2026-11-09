'use client';

// 3D 화면(마을·방)이 같이 쓰는 성능 도우미: 그림자 덜 자주 그리기, 프레임이 밀리면 해상도 낮추기, 창이 열리면 멈추기.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { townConfig } from '@/config/game';
import { panelOpen, subscribePanel } from './panelState';

/**
 * 그림자 지도를 every 장면마다 한 번만 다시 그린다 (가벼운 모드). 1이면 매 장면 (three 기본).
 * 해·캐릭터가 움직여도 몇 장면 늦게 따라올 뿐 티가 거의 나지 않는다.
 */
export function ShadowThrottle({ every }: { every: number }) {
  const gl = useThree((s) => s.gl);
  const n = useRef(0);
  useEffect(() => {
    if (every <= 1) return;
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl, every]);
  useFrame(() => {
    if (every <= 1) return;
    n.current = (n.current + 1) % every;
    if (n.current === 0) gl.shadowMap.needsUpdate = true;
  });
  return null;
}

/**
 * 프레임이 밀리면(끊겨 보이면) 해상도를 한 단계씩 낮춘다. 다시 올리지는 않는다 (오르내리며 깜빡이지 않게).
 * 처음 몇 초는 셰이더 준비로 느리므로 세지 않는다.
 */
export function AdaptiveResolution() {
  const setDpr = useThree((st) => st.setDpr);
  const viewport = useThree((st) => st.viewport);
  const state = useRef({ frames: 0, time: 0, skip: 3, dpr: 0 });
  useFrame((_, dt) => {
    const st = state.current;
    if (!st.dpr) st.dpr = viewport.dpr;
    if (document.hidden || dt > 1) return;
    if (st.skip > 0) {
      st.skip -= dt;
      return;
    }
    st.frames++;
    st.time += dt;
    if (st.time < 2) return;
    const fps = st.frames / st.time;
    st.frames = 0;
    st.time = 0;
    if (fps < townConfig.minFps && st.dpr > 1) {
      st.dpr = Math.max(1, Math.round((st.dpr - 0.25) * 100) / 100);
      setDpr(st.dpr);
      // 바뀐 해상도가 자리 잡을 때까지 잠깐 쉰다
      st.skip = 1;
    }
  });
  return null;
}

/** 가방·도감 같은 창이 화면을 다 덮고 있는지 (덮고 있으면 뒤의 3D 장면은 그리지 않는다) */
export function usePanelOpen(): boolean {
  return useSyncExternalStore(subscribePanel, panelOpen, () => false);
}
