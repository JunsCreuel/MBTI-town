// 곡의 박자(BPM)와 첫 박 위치를 찾는다: 낮은 소리(킥 드럼)의 세기가 갑자기 커지는 곳(onset)을 모아
// 일정한 간격으로 가장 잘 맞는 빠르기와 시작점을 고른다. EDM처럼 빠르기가 일정한 곡에 맞다.
import { execFileSync } from 'node:child_process';

const SR = 22050;
const HOP = 128;
const FPS = SR / HOP;

/** 0~1 사이 소수 위치 값 (선형 보간) */
function at(a: Float32Array, i: number): number {
  const k = Math.floor(i);
  if (k < 0 || k + 1 >= a.length) return 0;
  const f = i - k;
  return a[k] * (1 - f) + a[k + 1] * f;
}

export function beatGrid(file: string, range: [number, number] = [100, 160]): { bpm: number; beat: number } {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-af', 'lowpass=f=180', '-f', 'f32le', '-'], {
    maxBuffer: 1 << 28,
  });
  const x = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 4));
  const n = Math.floor(x.length / HOP);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * HOP; j < (i + 1) * HOP; j++) s += x[j] * x[j];
    env[i] = Math.log(1e-5 + Math.sqrt(s / HOP));
  }
  // 세기가 커지는 만큼만 (줄어드는 건 0). 한 칸짜리 뾰족한 값은 칸 사이 간격에 치우치므로 살짝 펴 준다
  const rough = new Float32Array(n);
  for (let i = 1; i < n; i++) rough[i] = Math.max(0, env[i] - env[i - 1]);
  const on = new Float32Array(n);
  const K = [1, 4, 6, 4, 1];
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = -2; k <= 2; k++) s += (rough[i + k] ?? 0) * K[k + 2];
    on[i] = s / 16;
  }
  /** 이 빠르기로 박을 찍었을 때 가장 잘 맞는 시작점과 점수 (곡 전체에 걸쳐 맞아야 높다) */
  const grid = (bpm: number) => {
    const lag = (FPS * 60) / bpm;
    let phase = 0;
    let score = -1;
    for (let p = 0; p < lag; p += 0.5) {
      let s = 0;
      for (let i = p; i < n; i += lag) s += at(on, i);
      if (s > score) {
        score = s;
        phase = p;
      }
    }
    return { phase, score };
  };

  // 빠르기: 한 박·두 박 뒤와 얼마나 겹치는지
  let bestBpm = 120;
  let best = -1;
  for (let bpm = range[0]; bpm <= range[1]; bpm += 0.05) {
    const lag = (FPS * 60) / bpm;
    let s = 0;
    for (let i = 0; i < n; i++) {
      if (!on[i]) continue;
      s += on[i] * (at(on, i + lag) + 0.5 * at(on, i + 2 * lag) + 0.25 * at(on, i + 4 * lag));
    }
    if (s > best) {
      best = s;
      bestBpm = bpm;
    }
  }
  // 곡 전체에 박 격자를 대 보며 빠르기를 0.01 단위로 다듬는다 (조금만 틀려도 끝으로 갈수록 어긋난다)
  let fine = { bpm: bestBpm, ...grid(bestBpm) };
  for (let bpm = bestBpm - 0.6; bpm <= bestBpm + 0.6; bpm += 0.01) {
    const g = grid(bpm);
    if (g.score > fine.score) fine = { bpm, ...g };
  }
  return { bpm: Math.round(fine.bpm * 100) / 100, beat: Math.round((fine.phase / FPS) * 1000) / 1000 };
}
