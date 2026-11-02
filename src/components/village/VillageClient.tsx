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
import type { ActionKind, EmoteKind, TownPlace } from '@/shared/protocol';
import { districtAt, lotDoor, parseTownMap, type Lot, type TownMap } from '@/shared/townMap';
import { lotKey, type TownContextValue, type TownInput } from './context';
import { TownSession, now } from './session';
import { loadTownAssets, type TownAssets } from './assets';

// 마을 화면: 3D 장면 + 머리 위 HUD + 전체 지도.
// 마을이 이 서비스의 기본 틀이다. 나의 방은 마을 속 내 집 안이다 (문 앞에서 "들어가기").
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

export function VillageClient({ at, welcome }: { at: TownPlace; welcome: boolean }) {
  const router = useRouter();
  const session = useMemo(() => new TownSession(at), [at]);
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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const map = parseTownMap(await (await fetch(assetUrl('map.town'))).json());
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
  }, []);

  // 집 이름표: 새 이웃이 이사 오거나 친구가 되면 바뀐다. 받아 오지 못하면 지난 목록을 그대로 쓴다.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/town', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as TownView;
        if (alive) setTown(data);
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

  useEffect(() => {
    session.connect();
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
    }),
    [],
  );
  const houses = useMemo(() => new Map(town.houses.map((h) => [lotKey(h), h])), [town.houses]);
  const hidden = useMemo(() => new Set(town.hidden), [town.hidden]);

  // 집을 누르면 문 앞으로 걸어가고 집 카드를 연다
  const onHouse = useCallback(
    (lot: Lot) => {
      const d = lotDoor(lot);
      input.tapTarget = d;
      input.marker = { ...d, at: now() };
      setPicked(lot);
      setHint(false);
    },
    [input],
  );

  const ready = snap.status === 'ready' && loaded !== null;
  const value = useMemo<TownContextValue | null>(
    () => (ready ? { session, selfId: snap.selfId, map: loaded.map, assets: loaded.assets, input, houses, hidden, onHouse } : null),
    [ready, session, snap.selfId, loaded, input, houses, hidden, onHouse],
  );

  // 지금 서 있는 곳 이름과, 문 앞에 섰는지 (HUD)
  useEffect(() => {
    if (!loaded) return;
    const lots = Object.values(loaded.map.lots).flat();
    const t = setInterval(() => {
      if (!input.self.ready) return;
      const next = areaAt(loaded.map, input.self.x, input.self.z);
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
    }, 300);
    return () => clearInterval(t);
  }, [loaded, input]);

  const openMap = useCallback(
    (open: boolean) => {
      input.view = open ? 'map' : 'walk';
      input.keys.clear();
      input.tapTarget = null;
      setView(input.view);
      setHint(false);
      setPicked(null);
    },
    [input],
  );

  const goTo = useCallback(
    (to: TownPlace) => {
      session.sendWarp(to);
      openMap(false);
    },
    [session, openMap],
  );

  // Esc로 지도·집 카드를 닫는다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (view === 'map') openMap(false);
      else setPicked(null);
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

  const failed = loadError || snap.status === 'error' || snap.status === 'closed';
  const label = (key: string) => (el: HTMLElement | null) => {
    if (el) input.labels.set(key, el);
    else input.labels.delete(key);
  };
  const pass = snap.pass;
  const guest = snap.guest;
  const hasHome = !!pass?.district && pass.lot >= 0;
  const counts = useMemo(() => {
    const c = Object.fromEntries(DISTRICTS.map((d) => [d, 0])) as Record<District, number>;
    for (const h of town.houses) c[h.district]++;
    return c;
  }, [town.houses]);

  const pickedHouse = picked ? houses.get(lotKey(picked)) : undefined;
  const pickedHref = houseHref(pickedHouse);
  const doorHouse = door ? houses.get(lotKey(door)) : undefined;
  const doorHref = houseHref(doorHouse);
  const showDoor = !!doorHref && !picked && view === 'walk';

  return (
    <div className="village">
      {value && <VillageScene value={value} onFirstFrame={() => setRendered(true)} />}

      {value && rendered && (
        <div className={`map-labels${view === 'map' ? ' map-labels--on' : ''}`} aria-hidden={view !== 'map'}>
          <button className="map-label map-label--plaza" ref={label('plaza')} onClick={() => goTo('plaza')} tabIndex={view === 'map' ? 0 : -1}>
            중앙광장
          </button>
          {DISTRICTS.map((d) => (
            <button
              key={d}
              ref={label(d)}
              className={`map-label${pass?.district === d ? ' map-label--mine' : ''}`}
              style={districtStyle(d)}
              onClick={() => goTo(d)}
              tabIndex={view === 'map' ? 0 : -1}
              aria-label={`${DISTRICT[d].short} 지역으로 가기, 집 ${counts[d]}채`}
            >
              <span className="map-label__code">{DISTRICT[d].short} 지역</span>
              <span className="map-label__share">
                {DISTRICT[d].element} · 집 {counts[d]}채
              </span>
            </button>
          ))}
          {hasHome && (
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
                  {snap.channel}채널 · {snap.playerIds.length}명
                </span>
              </div>
              <Link className="pill debate-link" href="/debate">
                <span className="debate-link__tag">이벤트</span>
                <span className="debate-link__label">오늘의 토론</span> ›
              </Link>
            </div>
            <div className="hud__right">
              {hasHome && (
                <button className="icon-btn" onClick={() => goTo('home')} aria-label="내 집 앞으로 가기">
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
          </div>

          {showWelcome && (
            <div className="village-welcome">
              <Guide who="monnyang">
                {DISTRICT[pass?.district || 'wood'].short} 지역에 내 집이 생겼어요! 문 앞에서 &lsquo;들어가기&rsquo;를 누르면 나의 방이에요.
              </Guide>
              <button className="icon-btn icon-btn--plain" onClick={() => setShowWelcome(false)} aria-label="안내 닫기">
                <Icon name="close" size={18} />
              </button>
            </div>
          )}

          <div className="hud__bottom">
            <div className="hud__hint" style={{ opacity: hint && !showWelcome ? 1 : 0 }} aria-hidden={!hint}>
              바닥을 눌러 걸어요 · 집을 누르면 그 집 앞으로 가요
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
                    {DISTRICT[picked.district].short} 지역 {picked.index + 1}번지
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
              <h1 className="map-card__title">마을 지도</h1>
              <button className="icon-btn" onClick={() => openMap(false)} aria-label="지도 닫기">
                <Icon name="close" size={18} />
              </button>
            </div>
            <p className="map-card__sub">
              다섯 지역이 중앙광장을 둘러싸고 있어요. 지역마다 집터 {townConfig.lotsPerDistrict}곳에 이웃이 살아요.
            </p>
          </div>
          <div className="hud__bottom">
            <div className="hud__hint">가고 싶은 지역이나 광장을 누르세요</div>
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
            {snap.status === 'closed' ? '마을과 연결이 끊겼어요' : loadError ? '마을을 불러오지 못했어요' : snap.error}
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
