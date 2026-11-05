// 동물 주민 NPC (고양이·여우·곰·토끼 네 가지 모습, 이름·성격이 다른 24마리). MBTI 마을마다 한두 마리가 산다
// (scripts/lib/town-map.ts가 맵을 만들 때 무작위로 나눴다). 집에서 나와 둘레 몇 군데를 들렀다가 다시 들어간다.
// 일과는 시각만으로 정해서 (서버 시계 기준) 모든 화면에서 같은 주민이 같은 자리에 보인다. 실시간 서버는 주민을 모른다.
import { findPath, type Point } from './pathfinding';
import { isBlockedTile, lotDoor, type ResidentHome, type TownMap } from './townMap';

/** 주민 모습 (모델 manifest 키) */
export const SPECIES = {
  cat: { animal: '고양이', key: 'char.resident.cat' },
  fox: { animal: '여우', key: 'char.resident.fox' },
  bear: { animal: '곰', key: 'char.resident.bear' },
  rabbit: { animal: '토끼', key: 'char.resident.rabbit' },
} as const;
export type Species = keyof typeof SPECIES;

/** 성격별 인사말. {마을} = 사는 마을 유형 */
const LINES = {
  lazy: ['음냐… 낮잠 자다 잠깐 나왔어.', '햇볕 잘 드는 자리 알면 나한테만 알려 줘!', '{마을} 마을은 조용해서 낮잠 자기 딱 좋아.', '천천히 걸어도 괜찮아. 서두를 거 없잖아.'],
  playful: ['쉿, 산책하는 척 탐험 중이야.', '{마을} 마을 골목은 내가 제일 잘 알아.', '나 잡아 봐라~ 아니다, 오늘은 그냥 걸을래.', '낚시터에 황금 고래가 있다는 소문 들었어?'],
  kind: ['{마을} 마을에 온 걸 환영해!', '배고프지 않아? 열매 따러 같이 갈까?', '오늘 하루도 수고 많았어.', '길을 잃으면 지도 버튼을 눌러 봐. 금방 찾을 거야.'],
  busy: ['오늘도 바쁘다 바빠! 집 청소 하고 나왔어.', '아침부터 열매를 세 바구니나 땄어!', '{마을} 마을 꽃밭은 내가 매일 물을 줘.', '바빠도 인사는 해야지! 안녕!'],
  chatty: ['있잖아, 오늘 광장 토론 봤어? 완전 팽팽하더라!', '{마을} 마을 소식은 나한테 물어봐!', '새 이웃이 이사 왔다던데, 혹시 너야?', '클럽 DJ 너굴이 오늘 신청곡을 엄청 받았대.'],
  stylish: ['오늘 털 손질 좀 했는데, 어때?', '{마을} 마을 노을은 사진 찍기 딱 좋아.', '클럽에서 춤 연습하고 왔어!', '모자 쓴 친구를 보면 나도 하나 갖고 싶더라.'],
} as const;
type Mood = keyof typeof LINES;

/** 주민 명단: id는 맵에 적히므로 바꾸지 않는다 (이름·성격은 바꿔도 된다). 같은 모습마다 여섯 마리 */
const ROSTER: { id: string; name: string; species: Species; mood: Mood }[] = [
  { id: 'cat1', name: '나비', species: 'cat', mood: 'lazy' },
  { id: 'cat2', name: '치즈', species: 'cat', mood: 'chatty' },
  { id: 'cat3', name: '모모', species: 'cat', mood: 'stylish' },
  { id: 'cat4', name: '보리', species: 'cat', mood: 'kind' },
  { id: 'cat5', name: '까미', species: 'cat', mood: 'playful' },
  { id: 'cat6', name: '루루', species: 'cat', mood: 'busy' },
  { id: 'fox1', name: '단풍', species: 'fox', mood: 'playful' },
  { id: 'fox2', name: '노을', species: 'fox', mood: 'stylish' },
  { id: 'fox3', name: '여울', species: 'fox', mood: 'lazy' },
  { id: 'fox4', name: '감귤', species: 'fox', mood: 'busy' },
  { id: 'fox5', name: '호두', species: 'fox', mood: 'chatty' },
  { id: 'fox6', name: '솔이', species: 'fox', mood: 'kind' },
  { id: 'bear1', name: '꿀떡', species: 'bear', mood: 'kind' },
  { id: 'bear2', name: '두부', species: 'bear', mood: 'lazy' },
  { id: 'bear3', name: '찐빵', species: 'bear', mood: 'chatty' },
  { id: 'bear4', name: '몽실', species: 'bear', mood: 'stylish' },
  { id: 'bear5', name: '누룽지', species: 'bear', mood: 'busy' },
  { id: 'bear6', name: '곰곰', species: 'bear', mood: 'playful' },
  { id: 'rabbit1', name: '토리', species: 'rabbit', mood: 'busy' },
  { id: 'rabbit2', name: '콩이', species: 'rabbit', mood: 'playful' },
  { id: 'rabbit3', name: '방울', species: 'rabbit', mood: 'stylish' },
  { id: 'rabbit4', name: '솜이', species: 'rabbit', mood: 'kind' },
  { id: 'rabbit5', name: '하양', species: 'rabbit', mood: 'lazy' },
  { id: 'rabbit6', name: '당근', species: 'rabbit', mood: 'chatty' },
];

export interface ResidentDef {
  id: string;
  name: string;
  species: Species;
  animal: string;
  /** 모델 manifest 키 */
  key: string;
  /** 인사말. {마을} = 사는 마을 유형 */
  lines: readonly string[];
}

export const RESIDENTS: readonly ResidentDef[] = ROSTER.map((r) => ({
  id: r.id,
  name: r.name,
  species: r.species,
  animal: SPECIES[r.species].animal,
  key: SPECIES[r.species].key,
  lines: LINES[r.mood],
}));

export const residentDef = (id: string): ResidentDef | undefined => RESIDENTS.find((r) => r.id === id);
export const residentLine = (def: ResidentDef, home: ResidentHome, n: number) => def.lines[((n % def.lines.length) + def.lines.length) % def.lines.length].replaceAll('{마을}', home.district);

/** 일과 한 바퀴 (초): 집 안에 있다가 → 나와서 둘레를 들르고 → 다시 들어간다 */
export const RESIDENT_CYCLE = 90;
/** 한 바퀴에 집 안에 있는 시간은 적어도 이만큼 */
const MIN_INSIDE = 14;
/** 걷는 빠르기 (칸/초)와 문을 드나들 때 빠르기 */
export const RESIDENT_WALK_SPEED = 1.3;
const DOOR_SPEED = 0.8;
/** 문 앞 자리와 사라지는 자리 (집 가운데에서 바라보는 쪽으로) */
const DOOR_DIST = 1.9;
const INNER_DIST = 1.0;
/** 문 앞에서 이 거리 안을 돌아다닌다 */
const WANDER_R = 6;
/** 한 번 나와서 들르는 곳 수, 들른 곳에서 머무는 시간 (초) */
const STOPS = 4;
const PAUSE = [6, 12] as const;

/** 들른 곳에서 하는 것 */
export type ResidentAct = 'idle' | 'think' | 'dance';

interface Leg {
  kind: 'walk';
  t0: number;
  t1: number;
  pts: Point[];
  /** 점마다 처음부터 잰 거리 */
  cum: number[];
  fade?: 'in' | 'out';
}
interface Stop {
  kind: 'stop';
  t0: number;
  t1: number;
  at: Point;
  yaw: number;
  act: ResidentAct;
}
interface Route {
  /** 이 바퀴에서 나오는 시각 (바퀴 처음부터 초). 그 전에는 집 안 */
  out: number;
  steps: (Leg | Stop)[];
}

export interface ResidentPose {
  /** 집 안에 있다 (보이지 않는다) */
  inside: boolean;
  x: number;
  z: number;
  /** 바라보는 방향 (라디안, 0 = +Z) */
  yaw: number;
  walking: boolean;
  act: ResidentAct;
  /** 문을 드나들 때 흐려진다 (0~1) */
  opacity: number;
  /** 지금 바퀴 번호 (말을 바꿀 때 쓴다) */
  cycle: number;
}

/** 문 앞 (집 가운데에서 바라보는 쪽으로) */
export const residentDoor = (home: ResidentHome) => lotDoor(home, DOOR_DIST);
const residentInner = (home: ResidentHome) => lotDoor(home, INNER_DIST);

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const areas = new WeakMap<TownMap, Map<string, Point[]>>();

/**
 * 문 앞에서 막히지 않은 칸으로 이어진 둘레 자리 (칸 가운데). 집 앞쪽(문이 보이는 쪽)만 들르고, 문에 너무 가까운 칸은 뺀다
 */
export function residentArea(map: TownMap, home: ResidentHome): Point[] {
  let byId = areas.get(map);
  if (!byId) areas.set(map, (byId = new Map()));
  const cached = byId.get(home.id);
  if (cached) return cached;
  const door = residentDoor(home);
  const sx = Math.floor(door.x);
  const sz = Math.floor(door.z);
  const out: Point[] = [];
  if (!isBlockedTile(map, sx, sz)) {
    const seen = new Set([sz * map.width + sx]);
    const queue: [number, number][] = [[sx, sz]];
    while (queue.length) {
      const [x, z] = queue.shift()!;
      const d = Math.hypot(x + 0.5 - door.x, z + 0.5 - door.z);
      const ahead = (x + 0.5 - home.x) * Math.sin(home.yaw) + (z + 0.5 - home.z) * Math.cos(home.yaw);
      if (d >= 2 && ahead > 1.6) out.push({ x: x + 0.5, z: z + 0.5 });
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const nz = z + dz;
        const i = nz * map.width + nx;
        if (seen.has(i) || isBlockedTile(map, nx, nz) || Math.hypot(nx + 0.5 - door.x, nz + 0.5 - door.z) > WANDER_R) continue;
        seen.add(i);
        queue.push([nx, nz]);
      }
    }
  }
  byId.set(home.id, out);
  return out;
}

function leg(pts: Point[], speed: number, t0: number, fade?: Leg['fade']): Leg {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  return { kind: 'walk', t0, t1: t0 + cum[cum.length - 1] / speed, pts, cum, fade };
}

const yawOf = (a: Point, b: Point) => Math.atan2(b.x - a.x, b.z - a.z);

/** 한 바퀴 일정: 들를 곳을 고르고 길을 찾는다. 집 안 시간이 MIN_INSIDE보다 짧아지면 들를 곳을 줄인다 */
function buildRoute(map: TownMap, home: ResidentHome, cycle: number): Route | null {
  const area = residentArea(map, home);
  if (!area.length) return null;
  const rand = seeded(hash(`${home.id}|${cycle}`));
  const door = residentDoor(home);
  const inner = residentInner(home);
  // 들를 곳: 앞 자리와 1.5칸 넘게 떨어진 곳
  const stops: Point[] = [];
  for (let tries = 0; tries < 30 && stops.length < STOPS; tries++) {
    const c = area[Math.floor(rand() * area.length)];
    const prev = stops[stops.length - 1] ?? door;
    if (Math.hypot(c.x - prev.x, c.z - prev.z) < 1.5) continue;
    stops.push({ x: c.x + (rand() - 0.5) * 0.4, z: c.z + (rand() - 0.5) * 0.4 });
  }
  const pauses = stops.map(() => PAUSE[0] + rand() * (PAUSE[1] - PAUSE[0]));
  const acts = stops.map((): ResidentAct => {
    const r = rand();
    return r < 0.55 ? 'idle' : r < 0.8 ? 'think' : 'dance';
  });
  for (let n = stops.length; n >= 1; n--) {
    const steps: (Leg | Stop)[] = [];
    let t = 0;
    const push = (l: Leg) => {
      steps.push(l);
      t = l.t1;
    };
    push(leg([inner, door], DOOR_SPEED, t, 'in'));
    let at = door;
    let ok = true;
    for (let k = 0; k < n; k++) {
      const path = findPath(map, at, stops[k], 800);
      if (!path) {
        ok = false;
        break;
      }
      const l = leg([at, ...path], RESIDENT_WALK_SPEED, t);
      push(l);
      const end = l.pts[l.pts.length - 1];
      const before = l.pts[l.pts.length - 2] ?? at;
      steps.push({ kind: 'stop', t0: t, t1: t + pauses[k], at: end, yaw: yawOf(before, end), act: acts[k] });
      t += pauses[k];
      at = end;
    }
    if (!ok) continue;
    const back = findPath(map, at, door, 800);
    if (!back) continue;
    push(leg([at, ...back], RESIDENT_WALK_SPEED, t));
    push(leg([door, inner], DOOR_SPEED, t, 'out'));
    if (t <= RESIDENT_CYCLE - MIN_INSIDE) return { out: RESIDENT_CYCLE - t, steps };
  }
  return null;
}

const routes = new WeakMap<TownMap, Map<string, Route | null>>();

function routeFor(map: TownMap, home: ResidentHome, cycle: number): Route | null {
  let m = routes.get(map);
  if (!m) routes.set(map, (m = new Map()));
  const key = `${home.id}|${cycle}`;
  if (!m.has(key)) {
    if (m.size > 32) m.clear();
    m.set(key, buildRoute(map, home, cycle));
  }
  return m.get(key)!;
}

/** 시각 t(초, 서버 시계)에 이 주민이 어디서 무엇을 하는지. 주민마다 바퀴 시작이 다르다 */
export function residentPose(map: TownMap, home: ResidentHome, t: number): ResidentPose {
  const shifted = t + (hash(home.id) / 4294967296) * RESIDENT_CYCLE;
  const cycle = Math.floor(shifted / RESIDENT_CYCLE);
  const local = shifted - cycle * RESIDENT_CYCLE;
  const route = routeFor(map, home, cycle);
  const inner = residentInner(home);
  const inside: ResidentPose = { inside: true, x: inner.x, z: inner.z, yaw: home.yaw, walking: false, act: 'idle', opacity: 0, cycle };
  if (!route || local < route.out) return inside;
  const u = local - route.out;
  for (const s of route.steps) {
    if (u >= s.t1) continue;
    if (s.kind === 'stop') return { inside: false, x: s.at.x, z: s.at.z, yaw: s.yaw, walking: false, act: s.act, opacity: 1, cycle };
    const progress = s.t1 > s.t0 ? (u - s.t0) / (s.t1 - s.t0) : 1;
    const dist = progress * s.cum[s.cum.length - 1];
    let i = 1;
    while (i < s.pts.length - 1 && s.cum[i] < dist) i++;
    const a = s.pts[i - 1];
    const b = s.pts[i];
    const seg = s.cum[i] - s.cum[i - 1];
    const f = seg > 0 ? (dist - s.cum[i - 1]) / seg : 1;
    const opacity = s.fade === 'in' ? progress : s.fade === 'out' ? 1 - progress : 1;
    return { inside: false, x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, yaw: yawOf(a, b), walking: true, act: 'idle', opacity, cycle };
  }
  return inside;
}
