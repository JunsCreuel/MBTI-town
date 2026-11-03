'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { assetUrl } from '@/assets/manifest';
import { townConfig } from '@/config/game';
import { withMaxLightness } from '@/design/mbti';
import { tokens } from '@/design/tokens';
import { Guide } from '@/components/app/Guide';
import { Icon } from '@/components/app/Icon';
import { TabBar } from '@/components/app/TabBar';
import type { HouseView, TownView } from '@/server/scene/service';
import { DISTRICT, DISTRICTS, type District } from '@/shared/districts';
import { parseRoomPlace, type ActionKind, type EmoteKind, type RoomPlace, type TownPlace } from '@/shared/protocol';
import { districtAt, lotDoor, parseTownMap, withDistrict, type Lot, type PropPlacement, type TownMap } from '@/shared/townMap';
import { lotKey, type TownCamera, type TownContextValue, type TownInput } from './context';
import { currentView, cycleView, initialCamera, isTurned, resetCamera, rotateCamera, type CameraView } from './camera';
import { placePoint } from '@/shared/spawn';
import { wakeRealtime } from '@/lib/realtime';
import { TownSession, now } from './session';
import { GATE_KEY, loadTownAssets, type TownAssets } from './assets';

// 마을 화면: 3D 장면 + 머리 위 HUD + 전체 지도.
// 마을이 이 서비스의 기본 틀이다. 나의 방은 마을 속 내 집 안이다 (문 앞에서 "들어가기").
// 본섬(중앙광장 + 다섯 지역 1동)과 새로 열린 동네(2동·3동…)는 큰길 끝 "동네 길" 아치로 오간다.
// three.js 장면은 브라우저에서만 불러온다 (첫 화면 코드에서 분리)
const VillageScene = dynamic(() => import('./VillageScene'), { ssr: false });

const ACTION_BUTTONS: { kind: ActionKind; label: string; icon: string }[] = [
  { kind: 'cheer', label: '응원', icon: 'cheer' },
  { kind: 'clap', label: '박수', icon: 'clap' },
];
const EMOTE_BUTTONS: { kind: EmoteKind; label: string; icon: string }[] = [
  { kind: 'heart', label: '하트', icon: 'heart' },
  { kind: 'question', label: '궁금', icon: 'question' },
  { kind: 'wow', label: '놀람', icon: 'wow' },
];

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
  const here = useMemo(() => parseRoomPlace(place) ?? null, [place]);
  const hoodNo = here?.hood ?? 1;
  const session = useMemo(() => new TownSession(place, at), [place, at]);
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [loaded, setLoaded] = useState<{ map: TownMap; assets: TownAssets } | null>(null);
  const [progress, setProgress] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [cooling, setCooling] = useState(false);
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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 2동부터는 동네 틀 맵에 그 지역을 입혀 쓴다
        const raw = parseTownMap(await (await fetch(assetUrl(here ? 'map.hood' : 'map.town'))).json());
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
  }, [here]);

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
    }),
    [],
  );

  // 맵과 토큰이 오면 실시간 서버를 기다리지 않고 내 캐릭터를 세운다. 실시간 서버에는 뒤에서 붙는다.
  const [spawn, setSpawn] = useState<{ x: number; z: number } | null>(null);
  useEffect(() => {
    if (!loaded || !snap.pass || spawn) return;
    const p = placePoint(loaded.map, snap.pass, at, here);
    input.self.x = p.x;
    input.self.z = p.z;
    setSpawn(p);
    void session.join(() => ({ x: input.self.x, z: input.self.z }));
  }, [loaded, snap.pass, spawn, at, here, input, session]);
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
  const look = useMemo(
    () => (passName !== undefined && passColor && passAcc ? { name: passName, color: passColor, acc: passAcc } : null),
    [passName, passColor, passAcc],
  );
  const value = useMemo<TownContextValue | null>(
    () =>
      loaded && spawn && look
        ? { session, selfId: snap.selfId, spawn, look, map: loaded.map, assets: loaded.assets, input, hood: hoodNo, houses, hidden, onHouse, onGate }
        : null,
    [session, snap.selfId, spawn, look, loaded, input, hoodNo, houses, hidden, onHouse, onGate],
  );

  // 지금 서 있는 곳 이름과, 문 앞·아치 앞에 섰는지 (HUD)
  useEffect(() => {
    if (!loaded) return;
    const lots = Object.values(loaded.map.lots).flat();
    const gates = loaded.map.props.filter((p) => p.key === GATE_KEY && p.district);
    const t = setInterval(() => {
      if (!input.self.ready) return;
      const next = here
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
    }, 300);
    return () => clearInterval(t);
  }, [loaded, input, here]);

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

  function gesture(send: () => void) {
    if (cooling) return;
    send();
    setHint(false);
    setCooling(true);
    setTimeout(() => setCooling(false), townConfig.emoteCooldownMs);
  }

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
    <div className="village">
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
              <Link className="pill debate-link" href="/debate">
                <span className="debate-link__tag">이벤트</span>
                <span className="debate-link__label">오늘의 토론</span> ›
              </Link>
            </div>
            <div className="hud__right hud__right--stack">
              <div className="hud__icons">
                {hasHome && (
                  <button className="icon-btn" onClick={goHome} aria-label="내 집 앞으로 가기">
                    <Icon name="home" />
                  </button>
                )}
                <Link className="icon-btn" href="/explore" aria-label="이웃 방 둘러보기">
                  <Icon name="friends" />
                </Link>
                <button className="icon-btn icon-btn--accent" onClick={() => openMap(true)} aria-label="전체 지도 보기">
                  <Icon name="map" />
                </button>
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

            <div className="actionbar" role="toolbar" aria-label="몸짓">
              {ACTION_BUTTONS.map((b) => (
                <button key={b.kind} className="action-btn" disabled={cooling} onClick={() => gesture(() => session.sendAction(b.kind))}>
                  <Icon name={b.icon} />
                  {b.label}
                </button>
              ))}
              <span className="actionbar__sep" aria-hidden />
              {EMOTE_BUTTONS.map((b) => (
                <button key={b.kind} className="action-btn" disabled={cooling} onClick={() => gesture(() => session.sendEmote(b.kind))}>
                  <Icon name={b.icon} />
                  {b.label}
                </button>
              ))}
            </div>
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
