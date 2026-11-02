// 임시 BGM을 코드로 만든다 (권리 문제가 없는 오리지널 곡). 실제 곡이 오면 같은 manifest 키에 파일만 바꾼다.
// 짧은 화음 진행을 패드·아르페지오·베이스·가벼운 타악기로 연주하고, 끝을 앞에 겹쳐 자연스럽게 반복되게 만든다.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RATE = 22050;

type Chord = number[]; // MIDI 음 번호

export interface TrackSpec {
  bpm: number;
  chords: Chord[];
  /** 진행을 몇 번 반복할지 */
  repeats: number;
  pad: number;
  arp: number;
  /** 한 박을 몇 개로 나눠 아르페지오를 칠지 */
  arpDiv: number;
  bass: number;
  /** 'none' | 'soft' (킥+하이햇) | 'four' (4박 킥) */
  drums: 'none' | 'soft' | 'four';
  bell?: number;
  rain?: number;
  swing?: number;
  seed: number;
}

export const TRACKS: Record<string, TrackSpec> = {
  forest: { bpm: 92, chords: [[55, 59, 62], [50, 54, 57], [52, 55, 59], [48, 52, 55]], repeats: 3, pad: 0.16, arp: 0.32, arpDiv: 2, bass: 0.3, drums: 'soft', seed: 3 },
  sunset: { bpm: 100, chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], repeats: 3, pad: 0.2, arp: 0.24, arpDiv: 2, bass: 0.36, drums: 'soft', seed: 7 },
  hill: { bpm: 84, chords: [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [57, 61, 64, 67]], repeats: 3, pad: 0.17, arp: 0.3, arpDiv: 2, bass: 0.34, drums: 'none', swing: 0.18, seed: 11 },
  silver: { bpm: 110, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], repeats: 3, pad: 0.12, arp: 0.24, arpDiv: 4, bass: 0.32, drums: 'four', seed: 5 },
  lake: { bpm: 68, chords: [[50, 54, 57, 61, 64], [47, 50, 54, 57, 61], [43, 47, 50, 54, 57], [45, 49, 52, 57, 59]], repeats: 2, pad: 0.26, arp: 0, arpDiv: 1, bass: 0.18, drums: 'none', bell: 0.22, seed: 13 },
  rain: { bpm: 72, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], repeats: 2, pad: 0.1, arp: 0.3, arpDiv: 1, bass: 0.16, drums: 'none', rain: 0.12, seed: 17 },
};

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** 곡 하나를 만든다 (모노, -1~1) */
export function renderTrack(spec: TrackSpec): Float32Array {
  const beat = 60 / spec.bpm;
  const barBeats = 4;
  const bars = spec.chords.length * spec.repeats;
  const seconds = bars * barBeats * beat;
  const tail = barBeats * beat; // 끝에서 울림이 남는 부분 (앞에 겹친다)
  const n = Math.ceil((seconds + tail) * RATE);
  const out = new Float32Array(n);
  const rand = rng(spec.seed);

  const addTone = (start: number, dur: number, f: number, amp: number, kind: 'pad' | 'pluck' | 'bass' | 'bell') => {
    const s0 = Math.floor(start * RATE);
    const len = Math.floor((dur + (kind === 'pad' ? 0.6 : kind === 'bell' ? 2.5 : 0.4)) * RATE);
    for (let i = 0; i < len && s0 + i < n; i++) {
      const t = i / RATE;
      let env: number;
      let v: number;
      const w = 2 * Math.PI * f * t;
      switch (kind) {
        case 'pad': {
          const a = Math.min(1, t / 0.5);
          const r = t > dur ? Math.max(0, 1 - (t - dur) / 0.6) : 1;
          env = a * r;
          v = Math.sin(w) * 0.6 + Math.sin(w * 1.003) * 0.4 + Math.sin(w * 2) * 0.12;
          break;
        }
        case 'pluck':
          env = Math.min(1, t / 0.005) * Math.exp(-t * 4.2);
          v = Math.sin(w) + Math.sin(w * 2) * 0.35 * Math.exp(-t * 6) + Math.sin(w * 3) * 0.1 * Math.exp(-t * 9);
          break;
        case 'bell':
          env = Math.min(1, t / 0.004) * Math.exp(-t * 1.4);
          v = Math.sin(w) + Math.sin(w * 2.76) * 0.3 * Math.exp(-t * 3) + Math.sin(w * 5.4) * 0.12 * Math.exp(-t * 5);
          break;
        default: {
          const r = t > dur ? Math.max(0, 1 - (t - dur) / 0.15) : 1;
          env = Math.min(1, t / 0.01) * r * Math.exp(-t * 1.2);
          v = Math.sin(w) + Math.sin(w * 2) * 0.2;
        }
      }
      out[s0 + i] += v * env * amp;
    }
  };

  const addNoise = (start: number, dur: number, amp: number, decay: number, bright: number) => {
    const s0 = Math.floor(start * RATE);
    let lp = 0;
    for (let i = 0; i < dur * RATE && s0 + i < n; i++) {
      const x = rand() * 2 - 1;
      lp += (x - lp) * bright;
      out[s0 + i] += (x - lp) * amp * Math.exp((-i / RATE) * decay);
    }
  };

  const addKick = (start: number, amp: number) => {
    const s0 = Math.floor(start * RATE);
    let phase = 0;
    for (let i = 0; i < 0.3 * RATE && s0 + i < n; i++) {
      const t = i / RATE;
      phase += (2 * Math.PI * (45 + 90 * Math.exp(-t * 30))) / RATE;
      out[s0 + i] += Math.sin(phase) * Math.exp(-t * 12) * amp;
    }
  };

  for (let bar = 0; bar < bars; bar++) {
    const chord = spec.chords[bar % spec.chords.length];
    const t0 = bar * barBeats * beat;
    const barDur = barBeats * beat;
    // 패드: 화음을 길게
    if (spec.pad) for (const m of chord) addTone(t0, barDur, freq(m), spec.pad / chord.length, 'pad');
    // 베이스: 1박과 3박(+가끔 엇박)
    if (spec.bass) {
      const root = chord[0] - 12;
      addTone(t0, beat * 1.6, freq(root), spec.bass, 'bass');
      addTone(t0 + beat * 2, beat * 1.4, freq(rand() < 0.5 ? root : root + 7), spec.bass * 0.8, 'bass');
      if (rand() < 0.4) addTone(t0 + beat * 3.5, beat * 0.4, freq(root + 12), spec.bass * 0.5, 'bass');
    }
    // 아르페지오: 화음 음을 오르내리며, 가끔 쉰다
    if (spec.arp) {
      const steps = barBeats * spec.arpDiv;
      const notes = [...chord, chord[0] + 12, chord[1] + 12];
      for (let k = 0; k < steps; k++) {
        if (rand() < 0.18) continue;
        const swing = spec.swing && k % 2 === 1 ? spec.swing * (beat / spec.arpDiv) : 0;
        const idx = k % 2 === 0 ? Math.floor(rand() * notes.length) : (k + bar) % notes.length;
        addTone(t0 + (k * beat) / spec.arpDiv + swing, beat / spec.arpDiv, freq(notes[idx] + 12), spec.arp * (k % spec.arpDiv === 0 ? 1 : 0.7), 'pluck');
      }
    }
    // 종소리: 마디마다 한두 번
    if (spec.bell) {
      addTone(t0 + beat * Math.floor(rand() * 2), beat * 2, freq(chord[chord.length - 1] + 12), spec.bell, 'bell');
      if (rand() < 0.6) addTone(t0 + beat * (2 + Math.floor(rand() * 2)), beat * 2, freq(chord[1] + 24), spec.bell * 0.6, 'bell');
    }
    // 타악기
    for (let b = 0; b < barBeats; b++) {
      const tb = t0 + b * beat;
      if (spec.drums === 'four') addKick(tb, 0.45);
      if (spec.drums === 'soft' && (b === 0 || b === 2)) addKick(tb, 0.35);
      if (spec.drums !== 'none') {
        addNoise(tb + beat / 2, 0.06, 0.08, 60, 0.9);
        if (spec.drums === 'soft' && (b === 1 || b === 3)) addNoise(tb, 0.18, 0.12, 20, 0.5);
      }
    }
  }

  // 빗소리: 고르게 깔리는 잡음 + 가끔 떨어지는 물방울
  if (spec.rain) {
    let lp = 0;
    let lp2 = 0;
    for (let i = 0; i < n; i++) {
      const x = rand() * 2 - 1;
      lp += (x - lp) * 0.35;
      lp2 += (lp - lp2) * 0.6;
      out[i] += lp2 * spec.rain;
    }
    for (let k = 0; k < seconds * 6; k++) addTone(rand() * seconds, 0.02, 1800 + rand() * 1600, 0.02, 'pluck');
  }

  // 공간감: 짧은 되울림 두 개
  for (const [delay, gain] of [[0.23, 0.22], [0.41, 0.14]] as const) {
    const d = Math.floor(delay * RATE);
    for (let i = n - 1; i >= d; i--) out[i] += out[i - d] * gain;
  }
  // 따뜻하게: 한 번 걸러 높은 소리를 줄인다
  let y = 0;
  for (let i = 0; i < n; i++) {
    y += (out[i] - y) * 0.55;
    out[i] = y;
  }

  // 끝의 울림을 앞에 겹쳐 반복할 때 끊기지 않게
  const loopLen = Math.floor(seconds * RATE);
  const loop = out.slice(0, loopLen);
  for (let i = loopLen; i < n; i++) loop[i - loopLen] += out[i];
  let peak = 0;
  for (const v of loop) peak = Math.max(peak, Math.abs(v));
  const g = 0.7 / (peak || 1);
  for (let i = 0; i < loop.length; i++) loop[i] *= g;
  return loop;
}

function wav(samples: Float32Array): Buffer {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + samples.length * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(RATE, 24);
  b.writeUInt32LE(RATE * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), 44 + i * 2));
  return b;
}

/** 곡을 OGG와 MP3로 만든다 (ffmpeg 필요). 길이(초)를 돌려준다. */
export function encodeTrack(spec: TrackSpec): { ogg: Buffer; mp3: Buffer; seconds: number } {
  const samples = renderTrack(spec);
  const dir = mkdtempSync(join(tmpdir(), 'bgm-'));
  try {
    const src = join(dir, 'in.wav');
    writeFileSync(src, wav(samples));
    const ogg = join(dir, 'out.ogg');
    const mp3 = join(dir, 'out.mp3');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-c:a', 'libvorbis', '-q:a', '2', ogg]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-c:a', 'libmp3lame', '-b:a', '64k', mp3]);
    return { ogg: readFileSync(ogg), mp3: readFileSync(mp3), seconds: Math.round((samples.length / RATE) * 10) / 10 };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
