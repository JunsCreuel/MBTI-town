// 땅따먹기. 유형별 땅 지분과, 지분대로 마을 땅 칸을 나누는 규칙. 서버(API)와 화면이 함께 쓴다.
//
// - 처음에는 16개 유형이 땅을 똑같이 나눠 갖는다.
// - 토론에서 이긴 팀이 진 팀 땅의 일부를 가져온다 (비율은 판정 득표율 차에 비례, config/game.ts landConfig).
// - 지분은 경기 결과(MatchResult.land)를 처음부터 더해서 구한다. 따로 저장하지 않는다.
// - 화면에서는 마을 한가운데는 고정해 두고, 지분대로 둘레 땅 칸의 주인을 다시 나눈다.
import { landConfig, townConfig } from '../config/game';
import { MBTI_TYPES, isMbtiType, type MbtiType } from '../design/mbti';

export type Shares = Record<MbtiType, number>;

/** 한 경기의 땅 이동. 유형별 지분 변화의 합은 0이다. */
export interface LandChange {
  /** 진 팀 땅에서 가져온 비율 (0~1) */
  rate: number;
  /** 유형별 지분 변화 (전체 땅 대비, -1~1) */
  delta: Partial<Record<MbtiType, number>>;
}

/** 마을 전체 지도에 보여 줄 땅 지분과 가장 최근의 땅 이동 (/api/town 응답) */
export interface TownView {
  shares: Shares;
  last: {
    matchId: string;
    decidedAt: string | null;
    winner: { label: string; members: MbtiType[] };
    loser: { label: string; members: MbtiType[] };
    land: LandChange;
  } | null;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function equalShares(): Shares {
  return Object.fromEntries(MBTI_TYPES.map((t) => [t, 1 / MBTI_TYPES.length])) as Shares;
}

/** 판정 득표율 차(%p)에 따라 진 팀 땅에서 가져오는 비율 */
export function takeRate(marginPoints: number): number {
  const r = landConfig.takeBase + landConfig.takePerPoint * Math.max(0, marginPoints);
  return Math.min(landConfig.takeMax, Math.max(0, r));
}

/**
 * 이긴 팀이 진 팀 땅을 가져온다. 진 팀 유형마다 자기 땅의 rate만큼 내놓고(최소 지분은 남긴다),
 * 모은 땅을 이긴 팀 유형이 똑같이 나눈다. 가져올 땅이 없으면 null.
 */
export function landTransfer(
  shares: Shares,
  winners: readonly MbtiType[],
  losers: readonly MbtiType[],
  marginPoints: number,
): LandChange | null {
  const win = winners.filter((t) => !losers.includes(t));
  if (!win.length || !losers.length) return null;
  const rate = takeRate(marginPoints);
  const delta: Partial<Record<MbtiType, number>> = {};
  let taken = 0;
  for (const t of losers) {
    const give = round6(Math.max(0, Math.min(shares[t] * rate, shares[t] - landConfig.minShare)));
    if (give <= 0) continue;
    delta[t] = -give;
    taken += give;
  }
  if (taken <= 0) return null;
  // 나누어 떨어지지 않는 끝자리는 첫 번째 유형이 갖는다 (합이 정확히 0이 되게)
  const each = round6(taken / win.length);
  win.forEach((t, i) => (delta[t] = i === 0 ? round6(taken - each * (win.length - 1)) : each));
  return { rate, delta };
}

/** 지금까지의 땅 이동을 더해 지금 지분을 구한다 */
export function sharesFrom(changes: readonly (LandChange | null | undefined)[]): Shares {
  const s = equalShares();
  for (const c of changes) {
    if (!c?.delta) continue;
    for (const [t, d] of Object.entries(c.delta)) {
      if (isMbtiType(t) && typeof d === 'number' && Number.isFinite(d)) s[t] = Math.max(0, s[t] + d);
    }
  }
  const sum = MBTI_TYPES.reduce((a, t) => a + s[t], 0);
  for (const t of MBTI_TYPES) s[t] = sum > 0 ? s[t] / sum : 1 / MBTI_TYPES.length;
  return s;
}

// ───────────────────────── 땅 칸 나누기 ─────────────────────────

export interface TerritoryMap {
  width: number;
  height: number;
  /** 1 = 땅따먹기 땅 */
  land: Uint8Array;
  villages: Partial<Record<MbtiType, { x: number; z: number }>>;
}

export interface Territory {
  /** 칸별 주인 (MBTI_TYPES 번호). 땅이 아니면 -1. */
  owner: Int8Array;
  /** 유형별 땅 칸 수 */
  tiles: Record<MbtiType, number>;
  /** 땅따먹기 땅 전체 칸 수 */
  total: number;
}

const NEIGHBORS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/**
 * 지분대로 땅 칸의 주인을 정한다. 같은 입력이면 어디서 계산해도 같은 결과다.
 * - 마을 한가운데(coreRadius 안)는 늘 그 마을 땅이다.
 * - 나머지 칸은 "거리 - 마을 힘"이 가장 작은 마을이 갖는다. 마을 힘을 조절해 칸 수를 지분에 맞춘다.
 *   이렇게 나누면 마을 땅은 한가운데에서 이어진 한 덩어리가 되고, 지분이 바뀌면 경계가 조금씩 움직인다.
 */
export function assignTerritory(map: TerritoryMap, shares: Shares): Territory {
  const types = MBTI_TYPES.filter((t) => map.villages[t]);
  const k = types.length;
  const sites = types.map((t) => map.villages[t]!);
  const cells: number[] = [];
  for (let i = 0; i < map.land.length; i++) if (map.land[i]) cells.push(i);
  const n = cells.length;

  const dist = new Float32Array(n * k);
  const core = new Int8Array(n).fill(-1);
  const coreR = townConfig.coreRadius;
  cells.forEach((cell, c) => {
    const x = (cell % map.width) + 0.5;
    const z = Math.floor(cell / map.width) + 0.5;
    let nearest = -1;
    let nearestD = Infinity;
    for (let j = 0; j < k; j++) {
      const d = Math.hypot(x - sites[j].x, z - sites[j].z);
      dist[c * k + j] = d;
      if (d < nearestD) {
        nearestD = d;
        nearest = j;
      }
    }
    if (nearestD <= coreR) core[c] = nearest;
  });

  const shareSum = types.reduce((a, t) => a + Math.max(0, shares[t] ?? 0), 0) || 1;
  const target = types.map((t) => (n * Math.max(0, shares[t] ?? 0)) / shareSum);
  const weight = new Float64Array(k);
  const own = new Int8Array(n);
  const count = new Float64Array(k);

  const assign = () => {
    count.fill(0);
    for (let c = 0; c < n; c++) {
      let best = core[c];
      if (best < 0) {
        let bestV = Infinity;
        for (let j = 0; j < k; j++) {
          const v = dist[c * k + j] - weight[j];
          if (v < bestV) {
            bestV = v;
            best = j;
          }
        }
      }
      own[c] = best;
      count[best]++;
    }
  };

  let bestErr = Infinity;
  let bestWeight = weight.slice();
  for (let iter = 0; iter < 160; iter++) {
    assign();
    let err = 0;
    for (let j = 0; j < k; j++) err += Math.abs(target[j] - count[j]);
    if (err < bestErr) {
      bestErr = err;
      bestWeight = weight.slice();
    }
    if (err <= k) break;
    // 경계 길이만큼 나눠 힘을 조금씩 옮긴다 (흔들리지 않게 반만)
    for (let j = 0; j < k; j++) weight[j] += (0.5 * (target[j] - count[j])) / (2 * Math.sqrt(Math.max(target[j], 1)));
  }
  weight.set(bestWeight);
  assign();

  const owner = new Int8Array(map.width * map.height).fill(-1);
  cells.forEach((cell, c) => (owner[cell] = MBTI_TYPES.indexOf(types[own[c]])));
  keepConnected(map, owner, types, sites);

  const tiles = Object.fromEntries(MBTI_TYPES.map((t) => [t, 0])) as Record<MbtiType, number>;
  for (const cell of cells) if (owner[cell] >= 0) tiles[MBTI_TYPES[owner[cell]]]++;
  return { owner, tiles, total: n };
}

/** 마을 한가운데와 이어지지 않은 조각 칸은 옆 마을에 붙인다 (경계의 자잘한 섬 정리) */
function keepConnected(map: TerritoryMap, owner: Int8Array, types: MbtiType[], sites: { x: number; z: number }[]) {
  const W = map.width;
  const reached = new Uint8Array(owner.length);
  types.forEach((t, j) => {
    const id = MBTI_TYPES.indexOf(t);
    const start = Math.floor(sites[j].z) * W + Math.floor(sites[j].x);
    if (owner[start] !== id) return;
    const queue = [start];
    reached[start] = 1;
    while (queue.length) {
      const i = queue.pop()!;
      const x = i % W;
      const z = Math.floor(i / W);
      for (const [dx, dz] of NEIGHBORS4) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= map.height) continue;
        const ni = nz * W + nx;
        if (!reached[ni] && owner[ni] === id) {
          reached[ni] = 1;
          queue.push(ni);
        }
      }
    }
  });
  for (let i = 0; i < owner.length; i++) {
    if (owner[i] < 0 || reached[i]) continue;
    const x = i % W;
    const z = Math.floor(i / W);
    for (const [dx, dz] of NEIGHBORS4) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= map.height) continue;
      const ni = nz * W + nx;
      if (owner[ni] >= 0 && owner[ni] !== owner[i] && reached[ni]) {
        owner[i] = owner[ni];
        break;
      }
    }
  }
}

/** 이 자리 땅의 주인 (땅따먹기 땅이 아니면 null) */
export function ownerAt(map: TerritoryMap, territory: Territory, x: number, z: number): MbtiType | null {
  const tx = Math.floor(x);
  const tz = Math.floor(z);
  if (tx < 0 || tz < 0 || tx >= map.width || tz >= map.height) return null;
  const o = territory.owner[tz * map.width + tx];
  return o >= 0 ? MBTI_TYPES[o] : null;
}
