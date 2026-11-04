'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { assetUrl } from '@/assets/manifest';
import { playConfig, townConfig } from '@/config/game';
import { call } from '@/lib/api';
import { FORTUNE_FRUIT, FRUITS, type FortuneFruit } from '@/shared/play';
import { withMaxLightness } from '@/design/mbti';
import { tokens } from '@/design/tokens';
import { Guide } from '@/components/app/Guide';
import { Icon } from '@/components/app/Icon';
import { InventorySheet, ItemIcon } from '@/components/app/Inventory';
import { GesturePicker } from '@/components/app/GesturePicker';
import { TabBar } from '@/components/app/TabBar';
import type { HouseView, TownView } from '@/server/scene/service';
import { DISTRICT, DISTRICTS, type District } from '@/shared/districts';
import { SPOT_NAME, parseRoomPlace, parseSpot, type RoomPlace, type Spot, type TownPlace } from '@/shared/protocol';
import { castTarget, districtAt, lotDoor, nearWater, parseTownMap, randomSpawnPoint, withDistrict, type Lot, type PropPlacement, type TownMap } from '@/shared/townMap';
import { lotKey, type TownCamera, type TownContextValue, type TownInput } from './context';
import { currentView, cycleView, initialCamera, isTurned, resetCamera, rotateCamera, type CameraView } from './camera';
import { placePoint } from '@/shared/spawn';
import { wakeRealtime } from '@/lib/realtime';
import { TownSession, now } from './session';
import { ClubMusic } from './ClubMusic';
import { NpcDialog } from './NpcDialog';
import { BarSheet, DjSheet, DrunkFx } from './ClubBar';
import { BARTENDER_NAME, DJ_NAME } from './ClubNpcs';
import { clubBar } from './club';
import { NPC_NAME, NPC_TALK_REACH, clubNpcSpots, guideNpcSpot, markNpcSeen, npcSeen } from './npc';
import { GATE_KEY, loadTownAssets, type TownAssets } from './assets';
import { VillageMusicButton, useVillageMusic } from './VillageMusic';
import {
  CLUB_FLOOR_RADIUS, FishingPanel, FortuneFruitSheet, beaconsOf, treesOf,
  type FishResult, type PickResult, type PlayState, type TreeInfo,
} from './Play';

// 마을 화면: 3D 장면 + 머리 위 HUD + 전체 지도.
// 마을이 이 서비스의 기본 틀이다. 나의 방은 마을 속 내 집 안이다 (문 앞에서 "들어가기").
// 본섬(중앙광장 + 다섯 지역 1동)과 새로 열린 동네(2동·3동…)는 큰길 끝 "동네 길" 아치로 오간다.
// three.js 장면은 브라우저에서만 불러온다 (첫 화면 코드에서 분리)
const VillageScene = dynamic(() => import('./VillageScene'), { ssr: false });

/** 중앙광장으로 치는 반지름 (광장 둘레 순환로까지) */
const PLAZA_RADIUS = 13.2;
/** 아치 앞 이만큼 안에 서면 "동네 길" 버튼이 뜬다 (칸) */
const GATE_DISTANCE = 2.6;

/** 동네 이름: 1동은 지역 이름, 2동부터는 번호 */
const hoodName = (d: District, hood: number) => (hood > 1 ? `${DISTRICT[d].short} ${hood}동` : `${DISTRICT[d].short} 지역`);
/** 동네로 가는 주소: 1동은 본섬 동네 길 앞 */
const hoodHref = (d: District, hood: number) => (hood > 1 ? `/village?hood=${d}.${hood}` : `/village?at=gate.${d}`);
/** 아치 앞 (아치는 마을 안쪽을 본다) */
const gateFront = (g: PropPlacement) => ({ x: g.x + Math.sin(g.yaw) * 1.6, z: g.z + Math.cos(g.yaw) * 1.6 });

const districtStyle = (d: District) =>
  ({ '--chip-color': tokens.district[d], '--chip-ink': withMaxLightness(tokens.district[d], 0.4) }) as CSSProperties;

/** 지금 서 있는 곳: 지역, 중앙광장, 바닷가 */
function areaAt(map: TownMap, x: number, z: number): { label: string; district: District | null } {
  const d = districtAt(map, x, z);
  if (d) return { label: `${DISTRICT[d].short} 지역`, district: d };
  const plaza = Math.hypot(x - map.width / 2, z - map.height / 2) < PLAZA_RADIUS;
  return { label: plaza ? '중앙광장' : '바닷가', district: null };
}

/** 집 카드 제목 */
function houseTitle(h: HouseView | undefined): string {
  if (!h) return '빈 집터';
  if (h.mine) return '내 집';
  return h.name ? `${h.name}의 집` : '이웃의 집';
}

/** 집에 들어갈 수 있으면 그 주소 */
function houseHref(h: HouseView | undefined): string | null {
  if (!h) return null;
  if (h.mine) return '/home';
  return h.handle ? `/r/${h.handle}` : null;
}

export function VillageClient({ place, at, welcome }: { place: RoomPlace; at: TownPlace; welcome: boolean }) {
  const router = useRouter();
  /** 지금 있는 동네 (본섬이면 null) */
  /** 놀이터(낚시터·클럽)면 그곳 */
  const spot = parseSpot(place);
  const here = useMemo(() => (spot ? null : (parseRoomPlace(place) ?? null)), [place, spot]);
  const hoodNo = here?.hood ?? 1;
  const session = useMemo(() => new TownSession(place, at), [place, at]);
  // 마을 음악: 클럽 안에서는 클럽 음악만
  const villageMusic = useVillageMusic(spot !== 'club');
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [loaded, setLoaded] = useState<{ map: TownMap; assets: TownAssets } | null>(null);
  const [progress, setProgress] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [hint, setHint] = useState(true);
  const [showWelcome, setShowWelcome] = useState(welcome);
  const [town, setTown] = useState<TownView>({ houses: [], hidden: [] });
  const [view, setView] = useState<'walk' | 'map'>('walk');
  const [area, setArea] = useState<{ label: string; district: District | null }>({ label: '마을', district: null });
  const [picked, setPicked] = useState<Lot | null>(null);
  const [door, setDoor] = useState<Lot | null>(null);
  /** 동네 길 카드를 연 지역 */
  const [gateFor, setGateFor] = useState<District | null>(null);
  const [nearGate, setNearGate] = useState<District | null>(null);
  // 놀거리: 가까운 나무, 오늘 딴 나무·모은 것, 운세 열매 결과, 바구니
  const [nearTree, setNearTree] = useState<TreeInfo | null>(null);
  const [play, setPlay] = useState<PlayState | null>(null);
  const [fortuneFruit, setFortuneFruit] = useState<FortuneFruit | null>(null);
  const [basketOpen, setBasketOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  /** 잠깐 뜨는 알림. 아이템을 얻었으면 아이콘을 함께 보인다 */
  const [toast, setToast] = useState<string | { text: string; fruit: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 2동부터는 동네 틀 맵에 그 지역을 입혀 쓴다
        const key = spot ? `map.${spot}` : here ? 'map.hood' : 'map.town';
        const raw = parseTownMap(await (await fetch(assetUrl(key))).json());
        const map = here ? withDistrict(raw, here.district) : raw;
        const assets = await loadTownAssets(map, (r) => alive && setProgress(r));
        await document.fonts?.ready;
        if (alive) setLoaded({ map, assets });
      } catch (e) {
        console.error(e);
        if (alive) setLoadError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [here, spot]);

  // 집 이름표: 새 이웃이 이사 오거나 친구가 되면 바뀐다. 받아 오지 못하면 지난 목록을 그대로 쓴다.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/town', { cache: 'no-store' });
        if (!res.ok) return;
        const text = await res.text();
        // 바뀐 게 없으면 그대로 둔다 (집·이름표를 다시 만들지 않게)
        if (alive) setTown((cur) => (JSON.stringify(cur) === text ? cur : (JSON.parse(text) as TownView)));
      } catch {
        // 다음 주기에 다시 받는다
      }
    };
    load();
    const t = setInterval(load, townConfig.refreshMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // 입장 토큰을 받고, 잠들어 있을지 모를 실시간 서버를 미리 깨운다 (에셋을 받는 동안 같이)
  useEffect(() => {
    void wakeRealtime();
    void session.prepare();
    return () => session.dispose();
  }, [session]);


  useEffect(() => {
    if (!rendered) return;
    const t = setTimeout(() => setHint(false), 6000);
    return () => clearTimeout(t);
  }, [rendered]);

  const input = useMemo<TownInput>(
    () => ({
      keys: new Set(),
      tapTarget: null,
      self: { x: 0, z: 0, ready: false },
      marker: { x: 0, z: 0, at: -10 },
      view: 'walk',
      mapBlend: 0,
      labels: new Map(),
      camera: initialCamera(),
      drops: [],
      fishing: null,
      npc: { talking: false, talked: false },
    }),
    [],
  );

  // 맵과 토큰이 오면 실시간 서버를 기다리지 않고 내 캐릭터를 세운다. 실시간 서버에는 뒤에서 붙는다.
  const [spawn, setSpawn] = useState<{ x: number; z: number } | null>(null);
  useEffect(() => {
    if (!loaded || !snap.pass || spawn) return;
    const p = spot ? randomSpawnPoint(loaded.map) : placePoint(loaded.map, snap.pass, at, here);
    input.self.x = p.x;
    input.self.z = p.z;
    setSpawn(p);
    void session.join(() => ({ x: input.self.x, z: input.self.z }));
  }, [loaded, snap.pass, spawn, at, here, spot, input, session]);
  // 지금 동네에 선 집만 (본섬 = 다섯 지역의 1동)
  const houses = useMemo(
    () => new Map(town.houses.filter((h) => h.hood === hoodNo && (!here || h.district === here.district)).map((h) => [lotKey(h), h])),
    [town.houses, here, hoodNo],
  );
  const hidden = useMemo(() => new Set(town.hidden), [town.hidden]);

  // 집을 누르면 문 앞으로 걸어가고 집 카드를 연다
  const onHouse = useCallback(
    (lot: Lot) => {
      const d = lotDoor(lot);
      input.tapTarget = d;
      input.marker = { ...d, at: now() };
      setPicked(lot);
      setGateFor(null);
      setHint(false);
    },
    [input],
  );

  // 동네 길 아치를 누르면 아치 앞으로 걸어가고 동네 카드를 연다
  const onGate = useCallback(
    (g: PropPlacement) => {
      if (!g.district) return;
      const f = gateFront(g);
      input.tapTarget = f;
      input.marker = { ...f, at: now() };
      setGateFor(g.district);
      setPicked(null);
      setHint(false);
    },
    [input],
  );

  const passName = snap.pass?.name;
  const passColor = snap.pass?.color;
  const passAcc = snap.pass?.acc;
  const passMbti = snap.pass?.mbti;
  const passIlju = snap.pass?.ilju;
  const look = useMemo(
    () =>
      passName !== undefined && passColor && passAcc
        ? { name: passName, color: passColor, acc: passAcc, mbti: passMbti, ilju: passIlju }
        : null,
    [passName, passColor, passAcc, passMbti, passIlju],
  );
  const value = useMemo<TownContextValue | null>(
    () =>
      loaded && spawn && look
        ? { session, selfId: snap.selfId, spawn, look, map: loaded.map, assets: loaded.assets, input, hood: hoodNo, houses, hidden, onHouse, onGate }
        : null,
    [session, snap.selfId, spawn, look, loaded, input, hoodNo, houses, hidden, onHouse, onGate],
  );

  const trees = useMemo(() => (loaded ? treesOf(loaded.map) : []), [loaded]);
  const beacons = useMemo(() => (loaded ? beaconsOf(loaded.map) : []), [loaded]);
  const [nearBeacon, setNearBeacon] = useState<Spot | null>(null);
  // 안내 NPC 몬냥이 (광장): 가까우면 말 걸기, 처음 온 사람에게는 먼저 인사한다
  const npcSpot = useMemo(() => (loaded ? guideNpcSpot(loaded.map) : null), [loaded]);
  const [nearNpc, setNearNpc] = useState(false);
  // 클럽: DJ 너굴(신청곡), 바텐더 곰돌(한 잔)
  const clubSpots = useMemo(() => (loaded ? clubNpcSpots(loaded.map) : null), [loaded]);
  const [nearClub, setNearClub] = useState<'dj' | 'bar' | null>(null);
  const [clubSheet, setClubSheet] = useState<'dj' | 'bar' | null>(null);
  const villageRef = useRef<HTMLDivElement>(null);
  const [npcOpen, setNpcOpen] = useState<{ first: boolean } | null>(null);
  const openNpc = useCallback(
    (first: boolean) => {
      input.npc.talking = true;
      input.keys.clear();
      input.tapTarget = null;
      setNpcOpen({ first });
    },
    [input],
  );
  const closeNpc = useCallback(() => {
    input.npc.talking = false;
    input.npc.talked = true;
    markNpcSeen();
    setNpcOpen(null);
  }, [input]);
  useEffect(() => {
    if (!npcSpot) return;
    input.npc.talked = npcSeen();
    if (!rendered || input.npc.talked) return;
    const t = setTimeout(() => openNpc(true), 1500);
    return () => clearTimeout(t);
  }, [npcSpot, rendered, input, openNpc]);
  const [canFish, setCanFish] = useState(false);
  const [fishing, setFishing] = useState(false);
  const [onFloor, setOnFloor] = useState(false);
  const lastDance = useRef(0);
  // 클럽 음악: 무대 가운데에서 멀어지면 작게 들린다
  const clubDistance = useCallback(() => {
    const map = loaded?.map;
    return map ? Math.hypot(input.self.x - map.width / 2, input.self.z - map.height / 2) : 0;
  }, [loaded, input]);
  const isGuest = snap.guest;
  const refreshPlay = useCallback(() => {
    call<PlayState>('GET', '/api/play').then(setPlay).catch(() => {});
  }, []);
  useEffect(() => {
    if (snap.pass && !isGuest) refreshPlay();
  }, [snap.pass, isGuest, refreshPlay]);

  async function pickTree(t: TreeInfo) {
    if (isGuest) {
      setToast('집이 있는 주민만 열매를 딸 수 있어요');
      return;
    }
    setPicking(true);
    try {
      const r = await call<PickResult>('POST', '/api/play/pick', { spot: t.spot });
      if (!r.already) input.drops.push({ x: t.x, z: t.z, color: r.fruit.color, at: now() });
      if (r.fortune) setFortuneFruit(r.fortune);
      else setToast({ text: r.already ? `이 나무는 오늘 이미 땄어요 (${r.fruit.name} ${r.count}개)` : `${r.fruit.name} ${r.added}개를 땄어요! 가방에 ${r.count}개`, fruit: r.fruit.id });
      if (!r.already) session.sendAction('jump');
      refreshPlay();
    } catch (e) {
      setToast(e instanceof Error ? e.message : '열매를 따지 못했어요');
    } finally {
      setPicking(false);
    }
  }

  // 지금 서 있는 곳 이름과, 문 앞·아치 앞에 섰는지 (HUD)
  useEffect(() => {
    if (!loaded) return;
    const lots = Object.values(loaded.map.lots).flat();
    const gates = loaded.map.props.filter((p) => p.key === GATE_KEY && p.district);
    const t = setInterval(() => {
      if (!input.self.ready) return;
      const next = spot
        ? { label: SPOT_NAME[spot], district: null }
        : here
          ? { label: hoodName(here.district, here.hood), district: here.district }
          : areaAt(loaded.map, input.self.x, input.self.z);
      setArea((a) => (a.label === next.label ? a : next));
      let best: Lot | null = null;
      let bestD: number = townConfig.doorDistance;
      for (const l of lots) {
        const p = lotDoor(l);
        const d = Math.hypot(p.x - input.self.x, p.z - input.self.z);
        if (d < bestD) {
          bestD = d;
          best = l;
        }
      }
      setDoor((cur) => (cur === best ? cur : best));
      const g = gates.find((p) => {
        const f = gateFront(p);
        return Math.hypot(f.x - input.self.x, f.z - input.self.z) < GATE_DISTANCE;
      });
      setNearGate(g?.district ?? null);
      // 나무: 손이 닿는 거리 안에서 가장 가까운 것 (운세 나무는 화단이 넓어 조금 더 멀리서도)
      let tree: TreeInfo | null = null;
      let treeD = Infinity;
      for (const t of trees) {
        const d = Math.hypot(t.x - input.self.x, t.z - input.self.z) - (t.kind === 'fortune' ? 0.8 : 0);
        if (d < playConfig.reach && d < treeD) {
          treeD = d;
          tree = t;
        }
      }
      setNearTree((cur) => (cur?.spot === tree?.spot ? cur : tree));
      // 비콘: 본섬에서는 놀이터로, 놀이터에서는 광장으로
      const b = beacons.find((q) => Math.hypot(q.x - input.self.x, q.z - input.self.z) < playConfig.reach + 0.4);
      setNearBeacon(b?.kind ?? null);
      setNearNpc(!!npcSpot && Math.hypot(npcSpot.x - input.self.x, npcSpot.z - input.self.z) < NPC_TALK_REACH);
      if (clubSpots) {
        const dDj = Math.hypot(clubSpots.dj.x - input.self.x, clubSpots.dj.z - input.self.z);
        const dBar = Math.hypot(clubSpots.bartender.x - input.self.x, clubSpots.bartender.z - input.self.z);
        setNearClub(dDj < 3.2 ? 'dj' : dBar < 3 ? 'bar' : null);
      } else setNearClub(null);
      // 낚시터 물가
      setCanFish(spot === 'fishing' && nearWater(loaded.map, input.self.x, input.self.z));
      // 클럽 무대에 서 있으면 저절로 춤춘다 (2초마다, 걷는 중에는 걷기가 먼저)
      if (spot === 'club') {
        const onFloor = Math.hypot(input.self.x - loaded.map.width / 2, input.self.z - loaded.map.height / 2) < CLUB_FLOOR_RADIUS;
        const t = now();
        if (onFloor && t - lastDance.current > 2.2) {
          lastDance.current = t;
          session.sendAction('dance');
        }
        setOnFloor(onFloor);
      }
    }, 300);
    return () => clearInterval(t);
  }, [loaded, input, here, trees, beacons, spot, session, npcSpot, clubSpots]);

  const openMap = useCallback(
    (open: boolean) => {
      input.view = open ? 'map' : 'walk';
      input.keys.clear();
      input.tapTarget = null;
      setView(input.view);
      setHint(false);
      setPicked(null);
      setGateFor(null);
    },
    [input],
  );

  const goTo = useCallback(
    (to: TownPlace) => {
      const pass = session.getSnapshot().pass;
      if (!loaded || !pass) return;
      session.sendWarp(to, () => placePoint(loaded.map, pass, to, here));
      openMap(false);
    },
    [session, openMap, loaded, here],
  );

  // 카메라 단축키: Q/E 돌리기, V 시점 바꾸기, R 정면 (걷기 화면에서만, 글 쓰는 칸에서는 무시)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view !== 'walk' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const cam = input.camera;
      if (e.code === 'KeyQ') rotateCamera(cam, -1);
      else if (e.code === 'KeyE') rotateCamera(cam, 1);
      else if (e.code === 'KeyR') resetCamera(cam);
      else if (e.code === 'KeyV') cycleView(cam, window.innerWidth, window.innerHeight);
      else return;
      e.preventDefault();
      cam.onChange?.();
      setHint(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, input]);

  // Esc로 지도·집 카드를 닫는다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (view === 'map') openMap(false);
      else {
        setPicked(null);
        setGateFor(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, openMap]);


  const failed = loadError || snap.status === 'error';
  const label = (key: string) => (el: HTMLElement | null) => {
    if (el) input.labels.set(key, el);
    else input.labels.delete(key);
  };
  const pass = snap.pass;
  const guest = snap.guest;
  const hasHome = !!pass?.district && pass.lot >= 0;
  /** 내 집이 지금 이 동네에 있는지 */
  const homeHere = hasHome && pass.hood === hoodNo && (!here || pass.district === here.district);
  // 지역별·동네별 집 수 (이름 없는 집도 센다)
  const counts = useMemo(() => {
    const c = Object.fromEntries(DISTRICTS.map((d) => [d, new Map<number, number>()])) as Record<District, Map<number, number>>;
    for (const h of town.houses) c[h.district].set(h.hood, (c[h.district].get(h.hood) ?? 0) + 1);
    return c;
  }, [town.houses]);
  /** 그 지역에 열린 동네 수 (1동 포함) */
  const hoodCount = (d: District) => Math.max(1, ...counts[d].keys());
  /** 내 집으로: 이 동네에 있으면 문 앞으로, 다른 동네면 그 동네로 간다 */
  const goHome = () => (homeHere ? goTo('home') : router.push('/village'));

  const pickedHouse = picked ? houses.get(lotKey(picked)) : undefined;
  const pickedHref = houseHref(pickedHouse);
  const doorHouse = door ? houses.get(lotKey(door)) : undefined;
  const doorHref = houseHref(doorHouse);
  const showDoor = !!doorHref && !picked && !gateFor && view === 'walk';

  return (
    <div className="village" ref={villageRef}>
      {value && <VillageScene value={value} onFirstFrame={() => setRendered(true)} />}

      {value && rendered && (
        <div className={`map-labels${view === 'map' ? ' map-labels--on' : ''}`} aria-hidden={view !== 'map'}>
          {!here && (
            <button className="map-label map-label--plaza" ref={label('plaza')} onClick={() => goTo('plaza')} tabIndex={view === 'map' ? 0 : -1}>
              중앙광장
            </button>
          )}
          {here && (
            <button
              className="map-label"
              ref={label(here.district)}
              style={districtStyle(here.district)}
              onClick={() => goTo('plaza')}
              tabIndex={view === 'map' ? 0 : -1}
              aria-label={`${hoodName(here.district, here.hood)} 입구로 가기`}
            >
              <span className="map-label__code">{hoodName(here.district, here.hood)}</span>
              <span className="map-label__share">
                집 {counts[here.district].get(here.hood) ?? 0}/{townConfig.hoodLots}채
              </span>
            </button>
          )}
          {!here && DISTRICTS.map((d) => (
            <button
              key={d}
              ref={label(d)}
              className={`map-label${pass?.district === d ? ' map-label--mine' : ''}`}
              style={districtStyle(d)}
              onClick={() => goTo(d)}
              tabIndex={view === 'map' ? 0 : -1}
              aria-label={`${DISTRICT[d].short} 지역으로 가기, 1동 집 ${counts[d].get(1) ?? 0}채`}
            >
              <span className="map-label__code">{DISTRICT[d].short} 지역</span>
              <span className="map-label__share">
                {DISTRICT[d].element} · 집 {counts[d].get(1) ?? 0}채{hoodCount(d) > 1 && ` · ${hoodCount(d)}동까지`}
              </span>
            </button>
          ))}
          {homeHere && (
            <button className="map-label map-label--home" ref={label('home')} onClick={() => goTo('home')} tabIndex={view === 'map' ? 0 : -1}>
              <Icon name="home" size={14} /> 내 집
            </button>
          )}
        </div>
      )}

      {value && rendered && view === 'walk' && (
        <div className={`hud${guest ? '' : ' hud--tabs'}`}>
          <div className="hud__top">
            <div className="hud__left">
              <div className="pill" aria-live="polite" style={area.district ? districtStyle(area.district) : undefined}>
                {area.district && <span className="pill__dot" aria-hidden />}
                {area.label}
                <span className="pill__sub">
                  {snap.status === 'ready' ? `${snap.channel}채널 · ${snap.playerIds.length}명` : snap.status === 'offline' ? '혼자 보는 중' : '이웃 연결 중…'}
                </span>
              </div>
              {snap.status === 'offline' && (
                <button className="pill reconnect" onClick={() => void session.reconnect()} title={snap.error}>
                  {snap.error ?? '연결이 끊겼어요'} · <b>다시 연결</b>
                </button>
              )}
              {spot === 'club' && loaded && <ClubMusic distance={clubDistance} />}
              <Link className="pill debate-link" href="/debate">
                <span className="debate-link__tag">이벤트</span>
                <span className="debate-link__label">오늘의 토론</span> ›
              </Link>
            </div>
            <div className="hud__right hud__right--stack">
              <div className="hud__icons">
                {spot !== 'club' && <VillageMusicButton music={villageMusic} />}
                {hasHome && (
                  <button className="icon-btn" onClick={goHome} aria-label="내 집 앞으로 가기">
                    <Icon name="home" />
                  </button>
                )}
                {!guest && (
                  <button
                    className="icon-btn"
                    onClick={() => {
                      setBasketOpen(true);
                      refreshPlay();
                    }}
                    aria-label="가방 (열매·물고기 도감)"
                  >
                    <Icon name="basket" />
                  </button>
                )}
                <Link className="icon-btn" href="/explore" aria-label="이웃 방 둘러보기">
                  <Icon name="friends" />
                </Link>
                {spot ? (
                  <Link className="icon-btn icon-btn--accent" href="/village?at=plaza" aria-label="광장으로 돌아가기">
                    <Icon name="exit" />
                  </Link>
                ) : (
                <button className="icon-btn icon-btn--accent" onClick={() => openMap(true)} aria-label="전체 지도 보기">
                  <Icon name="map" />
                </button>
                )}
              </div>
              <CameraControls cam={input.camera} onUse={() => setHint(false)} />
            </div>
          </div>

          {showWelcome && (
            <div className="village-welcome">
              <Guide who="monnyang">
                {hoodName(pass?.district || 'wood', pass?.hood ?? 1)}에 내 집이 생겼어요! 문 앞에서 &lsquo;들어가기&rsquo;를 누르면 나의 방이에요.
              </Guide>
              <button className="icon-btn icon-btn--plain" onClick={() => setShowWelcome(false)} aria-label="안내 닫기">
                <Icon name="close" size={18} />
              </button>
            </div>
          )}

          <div className="hud__bottom">
            <div className="hud__hint" style={{ opacity: hint && !showWelcome ? 1 : 0 }} aria-hidden={!hint}>
              바닥을 눌러 걸어요 · 옆으로 끌면 화면이 돌아요
            </div>

            {picked && (
              <div className="house-card" role="dialog" aria-label={houseTitle(pickedHouse)}>
                <span className="house-card__dot" style={districtStyle(picked.district)} aria-hidden />
                <div className="house-card__text">
                  <b>
                    {houseTitle(pickedHouse)}
                    {pickedHouse?.friend && <span className="tag">친구</span>}
                  </b>
                  <span>
                    {hoodName(picked.district, hoodNo)} {picked.index + 1}번지
                    {!pickedHouse && ' · 아직 아무도 살지 않아요'}
                    {pickedHouse && !pickedHref && ' · 방을 공개하지 않은 이웃이에요'}
                  </span>
                </div>
                {pickedHref && (
                  <button className="btn-primary btn-primary--inline" onClick={() => router.push(pickedHref)}>
                    {pickedHouse?.mine ? '들어가기' : '놀러 가기'}
                  </button>
                )}
                <button className="icon-btn icon-btn--plain" onClick={() => setPicked(null)} aria-label="닫기">
                  <Icon name="close" size={18} />
                </button>
              </div>
            )}

            {gateFor && (
              <div className="house-card hood-card" role="dialog" aria-label={`${DISTRICT[gateFor].short} 동네 길`}>
                <span className="house-card__dot" style={districtStyle(gateFor)} aria-hidden />
                <div className="house-card__text">
                  <b>{DISTRICT[gateFor].short} 동네 길</b>
                  <span>
                    {hoodCount(gateFor) > 1
                      ? '가고 싶은 동네를 고르세요'
                      : `1동 집터 ${townConfig.lotsPerDistrict}곳이 다 차면 2동이 열려요`}
                  </span>
                  <div className="hood-list">
                    {Array.from({ length: hoodCount(gateFor) }, (_, i) => i + 1).map((n) => {
                      const current = n === hoodNo && (n === 1 ? !here : here?.district === gateFor);
                      const total = n === 1 ? townConfig.lotsPerDistrict : townConfig.hoodLots;
                      return (
                        <button
                          key={n}
                          className={`hood-chip${current ? ' hood-chip--on' : ''}`}
                          disabled={current}
                          onClick={() => router.push(hoodHref(gateFor, n))}
                        >
                          <b>{n}동{n === 1 && ' · 본섬'}</b>
                          <span>
                            {current ? '여기' : `집 ${counts[gateFor].get(n) ?? 0}/${total}`}
                            {hasHome && pass.district === gateFor && pass.hood === n && ' · 내 집'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button className="icon-btn icon-btn--plain" onClick={() => setGateFor(null)} aria-label="닫기">
                  <Icon name="close" size={18} />
                </button>
              </div>
            )}

            {nearGate && !gateFor && !picked && !showDoor && (
              <button className="door-btn" onClick={() => setGateFor(nearGate)}>
                <Icon name="map" size={20} />
                {here ? '동네 길 · 본섬으로' : `${DISTRICT[nearGate].short} 동네 길`}
              </button>
            )}

            {nearBeacon && !picked && !gateFor && !showDoor && (
              <button
                className="door-btn"
                onClick={() => router.push(spot ? '/village?at=plaza' : `/village?place=${nearBeacon}`)}
              >
                <Icon name={nearBeacon === 'fishing' ? 'fishing' : 'music'} size={20} />
                {spot ? '광장으로 돌아가기' : `${SPOT_NAME[nearBeacon]}로 가기`}
              </button>
            )}

            {nearClub && !clubSheet && !picked && (
              <button className="door-btn" onClick={() => setClubSheet(nearClub)}>
                <Icon name={nearClub === 'dj' ? 'music' : 'drink'} size={20} />
                {nearClub === 'dj' ? `${DJ_NAME}에게 신청곡` : `${BARTENDER_NAME}에게 한 잔`}
              </button>
            )}

            {nearNpc && !npcOpen && !picked && !gateFor && !showDoor && (
              <button className="door-btn" onClick={() => openNpc(false)}>
                <Icon name="question" size={20} />
                {NPC_NAME}와 이야기하기
              </button>
            )}

            {canFish && !nearBeacon && !fishing && (
              <button
                className="door-btn"
                onClick={() => (guest ? setToast('집이 있는 주민만 낚시할 수 있어요') : setFishing(true))}
              >
                <Icon name="fishing" size={20} />
                낚시하기
              </button>
            )}

            {spot === 'club' && onFloor && <div className="hud__hint club-hint">무대 위에서는 저절로 춤을 춰요</div>}

            {nearTree && !picked && !gateFor && !showDoor && !nearGate && (
              <button className="door-btn" onClick={() => pickTree(nearTree)} disabled={picking}>
                <ItemIcon kind="fruit" id={nearTree.kind === 'fortune' ? FORTUNE_FRUIT.id : FRUITS[nearTree.district!].id} size={24} />
                {nearTree.kind === 'fortune'
                  ? play?.pickedTrees.includes('fortune')
                    ? '오늘의 운세 다시 보기'
                    : '운세 열매 따기'
                  : play?.pickedTrees.includes(nearTree.spot)
                    ? `${FRUITS[nearTree.district!].name} 나무 (오늘은 다 땄어요)`
                    : `${FRUITS[nearTree.district!].name} 따기`}
              </button>
            )}

            {showDoor && (
              <button className="door-btn" onClick={() => router.push(doorHref)}>
                <Icon name="home" size={20} />
                {doorHouse?.mine ? '내 집 들어가기' : `${doorHouse?.name}의 집 놀러 가기`}
              </button>
            )}

            {guest && (
              <div className="guest-card">
                <span>손님으로 구경하는 중이에요</span>
                <Link className="btn-primary btn-primary--inline" href="/login?next=/onboarding">
                  나도 집 짓기
                </Link>
              </div>
            )}

            <GesturePicker
              onAction={(k) => {
                session.sendAction(k);
                setHint(false);
              }}
              onEmote={(k) => {
                session.sendEmote(k);
                setHint(false);
              }}
            />
          </div>
        </div>
      )}

      {value && rendered && view === 'map' && (
        <div className="hud hud--map">
          <div className="map-card">
            <div className="map-card__head">
              <h1 className="map-card__title">{here ? `${hoodName(here.district, here.hood)} 지도` : '마을 지도'}</h1>
              <button className="icon-btn" onClick={() => openMap(false)} aria-label="지도 닫기">
                <Icon name="close" size={18} />
              </button>
            </div>
            {here ? (
              <>
                <p className="map-card__sub">본섬 {DISTRICT[here.district].short} 지역 큰길 끝 동네 길과 이어져 있어요.</p>
                <button className="btn-secondary map-card__action" onClick={() => router.push(hoodHref(here.district, 1))}>
                  본섬으로 나가기
                </button>
              </>
            ) : (
              <p className="map-card__sub">
                다섯 지역이 중앙광장을 둘러싸고 있어요. 지역마다 1동 집터 {townConfig.lotsPerDistrict}곳이 다 차면 큰길 끝 동네 길 너머에 2동이 열려요.
              </p>
            )}
          </div>
          <div className="hud__bottom">
            <div className="hud__hint">{here ? '이름표를 누르면 동네 입구로 가요' : '가고 싶은 지역이나 광장을 누르세요'}</div>
          </div>
        </div>
      )}

      {value && rendered && view === 'walk' && !guest && <TabBar />}

      {!rendered && !failed && (
        <div className="overlay">
          <div className="loader" aria-hidden />
          <p className="overlay__title">마을로 가는 중</p>
          <p className="overlay__sub">{loaded ? '자리를 찾고 있어요' : `마을을 불러오는 중 ${Math.round(progress * 100)}%`}</p>
        </div>
      )}

      {fortuneFruit && (
        <FortuneFruitSheet
          fortune={fortuneFruit}
          name={pass?.name ?? '손님'}
          district={pass?.district || null}
          day={play?.day ?? new Date().toISOString().slice(0, 10)}
          onClose={() => setFortuneFruit(null)}
        />
      )}
      {basketOpen && <InventorySheet state={play} onClose={() => setBasketOpen(false)} />}
      {fishing && (
        <FishingPanel
          onCast={async () => {
            // 낚싯대를 휘둘러 물 위로 찌를 던진다 (화면 연출). 결과는 서버가 정한다
            const t = loaded ? castTarget(loaded.map, input.self.x, input.self.z) : null;
            input.fishing = t ? { castAt: now(), tx: t.x, tz: t.z } : null;
            if (t) session.sendAction('fish');
            try {
              const r = await call<FishResult>('POST', '/api/play/fish');
              refreshPlay();
              return r;
            } catch (e) {
              input.fishing = null;
              session.endAction();
              throw e;
            }
          }}
          onBite={() => {
            if (input.fishing) input.fishing.biteAt = now();
          }}
          onCaught={(r) => {
            if (input.fishing) Object.assign(input.fishing, { caughtAt: now(), fishId: r.fish?.id });
            // 잡은 물고기를 머리 위로 들어 보인 뒤에 이모티콘 (꽝이면 바로 시무룩)
            const f = r.fish;
            if (!f) session.sendEmote('sad');
            else setTimeout(() => session.sendEmote(f.rarity === 'legend' ? 'sparkle' : f.rarity === 'junk' ? 'question' : 'joy'), 2600);
          }}
          onClose={() => {
            input.fishing = null;
            session.endAction();
            setFishing(false);
          }}
        />
      )}
      {npcOpen && <NpcDialog guest={isGuest} first={npcOpen.first} onClose={closeNpc} />}
      {clubSheet === 'dj' && <DjSheet onRequest={(i) => session.requestSong(i)} onClose={() => setClubSheet(null)} />}
      {clubSheet === 'bar' && (
        <BarSheet
          onDrink={(d) => {
            clubBar.servedAt = now();
            // 잔을 들어 건배 (물은 그냥)
            if (d.units > 0) session.sendAction('cheer');
          }}
          onClose={() => setClubSheet(null)}
        />
      )}
      <DrunkFx host={villageRef} />
      {toast && (
        <div className="toast" role="status">
          {typeof toast === 'string' ? (
            toast
          ) : (
            <span className="toast__item">
              <ItemIcon kind="fruit" id={toast.fruit} size={28} />
              {toast.text}
            </span>
          )}
        </div>
      )}

      {failed && (
        <div className="overlay">
          <p className="overlay__title">
            {loadError ? '마을을 불러오지 못했어요' : snap.error}
          </p>
          <p className="overlay__sub">잠시 후 다시 들어와 주세요. 나의 방은 마을 없이도 열 수 있어요.</p>
          <button className="btn-secondary" onClick={() => window.location.reload()}>
            다시 들어가기
          </button>
          <Link className="back-link" href={guest ? '/' : '/home'}>
            {guest ? '처음으로' : '나의 방으로'}
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * 카메라 버튼: ⟲ 돌리기 · 시점(기본/가까이/멀리) · ⟳ 돌리기, 돌려 놓았으면 '정면'.
 * 단축키 Q · V · E · R 과 같다. 카메라 값은 장면이 매 프레임 읽는 input.camera에 쓴다.
 */
function CameraControls({ cam, onUse }: { cam: TownCamera; onUse: () => void }) {
  const size = () => [window.innerWidth, window.innerHeight] as const;
  const [current, setCurrent] = useState<CameraView | null>(null);
  const [turned, setTurned] = useState(false);

  useEffect(() => {
    const sync = () => {
      setCurrent(currentView(cam, ...size()));
      setTurned(isTurned(cam));
    };
    sync();
    // 휠·두 손가락 확대, 끌어서 돌리기, 단축키로 바뀐 것도 글자에 맞춘다
    cam.onChange = sync;
    window.addEventListener('resize', sync);
    return () => {
      cam.onChange = undefined;
      window.removeEventListener('resize', sync);
    };
  }, [cam]);

  function run(change: () => void) {
    change();
    setCurrent(currentView(cam, ...size()));
    setTurned(isTurned(cam));
    onUse();
  }

  return (
    <div className="cam-ctrl" role="toolbar" aria-label="카메라 시점">
      <button onClick={() => run(() => rotateCamera(cam, -1))} aria-label="화면 왼쪽으로 돌리기" title="왼쪽으로 돌리기 (Q)">
        <Icon name="rotate" size={18} className="icon--flip" />
      </button>
      <button
        className="cam-ctrl__view"
        onClick={() => run(() => cycleView(cam, ...size()))}
        aria-label={`시점 바꾸기, 지금 ${current?.label ?? '기본'}`}
        title="시점 바꾸기 (V)"
      >
        {current?.label ?? '기본'}
      </button>
      <button onClick={() => run(() => rotateCamera(cam, 1))} aria-label="화면 오른쪽으로 돌리기" title="오른쪽으로 돌리기 (E)">
        <Icon name="rotate" size={18} />
      </button>
      {turned && (
        <button className="cam-ctrl__reset" onClick={() => run(() => resetCamera(cam))} aria-label="정면으로 돌아가기" title="정면 (R)">
          정면
        </button>
      )}
    </div>
  );
}
