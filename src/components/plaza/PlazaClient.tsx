'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { assetUrl } from '@/assets/manifest';
import { plazaConfig, townConfig } from '@/config/game';
import { MBTI_TYPES, mbtiColor, withMaxLightness, type MbtiType } from '@/design/mbti';
import { loadMbti, saveMbti } from '@/lib/session';
import { parsePlazaMap, type PlazaMap } from '@/shared/plazaMap';
import type { ActionKind, EmoteKind } from '@/shared/protocol';
import { assignTerritory, equalShares, ownerAt, type Shares, type TownView } from '@/shared/territory';
import type { PlazaContextValue, PlazaInput } from './context';
import { PlazaSession } from './session';
import { loadPlazaAssets, type PlazaAssets } from './assets';

// 마을 화면: 3D 장면 + 머리 위 HUD + 전체 지도.
// three.js 장면은 브라우저에서만 불러온다 (첫 화면 코드에서 분리)
const PlazaScene = dynamic(() => import('./PlazaScene'), { ssr: false });

const icon = (key: string) => ({ '--icon': `url(${assetUrl(key)})` }) as CSSProperties;

const ACTION_BUTTONS: { kind: ActionKind; label: string; icon: string }[] = [
  { kind: 'cheer', label: '응원', icon: 'ui.icon.cheer' },
  { kind: 'clap', label: '박수', icon: 'ui.icon.clap' },
];
const EMOTE_BUTTONS: { kind: EmoteKind; label: string; icon: string }[] = [
  { kind: 'heart', label: '하트', icon: 'ui.icon.heart' },
  { kind: 'question', label: '궁금', icon: 'ui.icon.question' },
  { kind: 'wow', label: '놀람', icon: 'ui.icon.wow' },
];

export function PlazaClient({ initialMbti }: { initialMbti: MbtiType | null }) {
  const router = useRouter();
  const [mbti, setMbti] = useState<MbtiType | null>(initialMbti);

  useEffect(() => {
    if (initialMbti) {
      saveMbti(initialMbti);
      return;
    }
    const saved = loadMbti();
    if (saved) setMbti(saved);
    else router.replace('/');
  }, [initialMbti, router]);

  if (!mbti) return <div className="plaza" />;
  return <Plaza key={mbti} mbti={mbti} />;
}

/** 지금 서 있는 곳: 유형 마을, 광장, 바닷가 */
function areaAt(map: PlazaMap, territory: ReturnType<typeof assignTerritory>, x: number, z: number): string {
  const owner = ownerAt(map, territory, x, z);
  if (owner) return `${owner} 마을`;
  return Math.hypot(x - map.width / 2, z - map.height / 2) < 14 ? '광장' : '바닷가';
}

function Plaza({ mbti }: { mbti: MbtiType }) {
  const session = useMemo(() => new PlazaSession(mbti), [mbti]);
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [loaded, setLoaded] = useState<{ map: PlazaMap; assets: PlazaAssets } | null>(null);
  const [progress, setProgress] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [cooling, setCooling] = useState(false);
  const [hint, setHint] = useState(true);
  const [town, setTown] = useState<{ shares: Shares; last: TownView['last'] }>({ shares: equalShares(), last: null });
  const [view, setView] = useState<'walk' | 'map'>('walk');
  const [area, setArea] = useState(`${mbti} 마을`);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const map = parsePlazaMap(await (await fetch(assetUrl('map.town'))).json());
        const assets = await loadPlazaAssets(map, (r) => alive && setProgress(r));
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

  // 땅 지분: 토론 결과가 나오면 바뀐다. 받아 오지 못하면 똑같이 나눈 땅으로 보여 준다.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/town', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as TownView;
        if (alive) setTown({ shares: data.shares, last: data.last });
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

  const input = useMemo<PlazaInput>(
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
  const territory = useMemo(() => (loaded ? assignTerritory(loaded.map, town.shares) : null), [loaded, town.shares]);
  const ready = snap.status === 'ready' && loaded !== null && territory !== null;
  const value = useMemo<PlazaContextValue | null>(
    () => (ready ? { session, selfId: snap.selfId, map: loaded.map, assets: loaded.assets, input, territory } : null),
    [ready, session, snap.selfId, loaded, input, territory],
  );

  // 지금 서 있는 곳 이름 (HUD)
  useEffect(() => {
    if (!loaded || !territory) return;
    const t = setInterval(() => {
      if (input.self.ready) setArea(areaAt(loaded.map, territory, input.self.x, input.self.z));
    }, 400);
    return () => clearInterval(t);
  }, [loaded, territory, input]);

  const openMap = useCallback(
    (open: boolean) => {
      input.view = open ? 'map' : 'walk';
      input.keys.clear();
      input.tapTarget = null;
      setView(input.view);
      setHint(false);
    },
    [input],
  );

  const goTo = useCallback(
    (to: MbtiType | 'plaza') => {
      session.sendWarp(to);
      openMap(false);
    },
    [session, openMap],
  );

  // Esc로 지도를 닫는다
  useEffect(() => {
    if (view !== 'map') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && openMap(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, openMap]);

  function gesture(send: () => void) {
    if (cooling) return;
    send();
    setHint(false);
    setCooling(true);
    setTimeout(() => setCooling(false), plazaConfig.emoteCooldownMs);
  }

  const failed = loadError || snap.status === 'error' || snap.status === 'closed';
  const label = (key: string) => (el: HTMLElement | null) => {
    if (el) input.labels.set(key, el);
    else input.labels.delete(key);
  };
  const last = town.last;

  return (
    <div className="plaza">
      {value && <PlazaScene value={value} onFirstFrame={() => setRendered(true)} />}

      {value && rendered && (
        <div className={`map-labels${view === 'map' ? ' map-labels--on' : ''}`} aria-hidden={view !== 'map'}>
          <button className="map-label map-label--plaza" ref={label('plaza')} onClick={() => goTo('plaza')} tabIndex={view === 'map' ? 0 : -1}>
            광장
          </button>
          {MBTI_TYPES.filter((t) => loaded?.map.villages[t]).map((t) => (
            <button
              key={t}
              ref={label(t)}
              className={`map-label${t === mbti ? ' map-label--mine' : ''}`}
              style={{ '--chip-color': mbtiColor(t), '--chip-ink': withMaxLightness(mbtiColor(t), 0.42) } as CSSProperties}
              onClick={() => goTo(t)}
              tabIndex={view === 'map' ? 0 : -1}
              aria-label={`${t} 마을로 가기, 땅 ${pct(town.shares[t])}`}
            >
              <span className="map-label__code">{t}</span>
              <span className="map-label__share">{pct(town.shares[t])}</span>
              {t === mbti && <span className="map-label__mine">내 마을</span>}
            </button>
          ))}
        </div>
      )}

      {value && rendered && view === 'walk' && (
        <div className="hud">
          <div className="hud__top">
            <div className="hud__left">
              <div className="pill" aria-live="polite">
                {area}
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
              <div className="pill" style={{ '--chip-color': mbtiColor(mbti) } as CSSProperties}>
                <span className="pill__dot" aria-hidden />
                {mbti}
              </div>
              <button className="icon-btn icon-btn--accent" onClick={() => openMap(true)} aria-label="전체 지도 보기">
                <span className="icon" style={icon('ui.icon.map')} aria-hidden />
              </button>
              <Link className="icon-btn" href="/" aria-label="마을에서 나가기">
                <span className="icon" style={icon('ui.icon.exit')} aria-hidden />
              </Link>
            </div>
          </div>

          <div className="hud__bottom">
            <div className="hud__hint" style={{ opacity: hint ? 1 : 0 }} aria-hidden={!hint}>
              바닥을 눌러 이동해요 · 지도에서 다른 마을로 갈 수 있어요
            </div>

            <div className="actionbar" role="toolbar" aria-label="몸짓">
              {ACTION_BUTTONS.map((b) => (
                <button
                  key={b.kind}
                  className="action-btn"
                  disabled={cooling}
                  onClick={() => gesture(() => session.sendAction(b.kind))}
                >
                  <span className="icon" style={icon(b.icon)} aria-hidden />
                  {b.label}
                </button>
              ))}
              <span className="actionbar__sep" aria-hidden />
              {EMOTE_BUTTONS.map((b) => (
                <button
                  key={b.kind}
                  className="action-btn"
                  disabled={cooling}
                  onClick={() => gesture(() => session.sendEmote(b.kind))}
                >
                  <span className="icon" style={icon(b.icon)} aria-hidden />
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
              <h1 className="map-card__title">MBTI 마을 지도</h1>
              <button className="icon-btn" onClick={() => openMap(false)} aria-label="지도 닫기">
                <span aria-hidden>✕</span>
              </button>
            </div>
            <p className="map-card__sub">
              {last
                ? `최근 토론: ${last.winner.label}이 ${last.loser.label} 땅 ${Math.round(last.land.rate * 100)}%를 가져왔어요.`
                : '처음에는 16개 유형이 땅을 똑같이 나눠 가져요. 토론에서 이기면 진 팀 땅을 가져와요.'}
            </p>
          </div>
          <div className="hud__bottom">
            <div className="hud__hint">가고 싶은 마을이나 광장을 누르세요</div>
          </div>
        </div>
      )}

      {!rendered && !failed && (
        <div className="overlay">
          <div className="loader" aria-hidden />
          <p className="overlay__title">{mbti} 마을로 가는 중</p>
          <p className="overlay__sub">
            {loaded ? '자리를 찾고 있어요' : `마을을 불러오는 중 ${Math.round(progress * 100)}%`}
          </p>
        </div>
      )}

      {failed && (
        <div className="overlay">
          <p className="overlay__title">
            {snap.status === 'closed' ? '마을과 연결이 끊겼어요' : loadError ? '마을을 불러오지 못했어요' : snap.error}
          </p>
          <p className="overlay__sub">잠시 후 다시 들어와 주세요.</p>
          <button className="btn-secondary" onClick={() => window.location.reload()}>다시 들어가기</button>
          <Link className="back-link" href="/">처음으로</Link>
        </div>
      )}
    </div>
  );
}

/** 땅 지분 (전체 땅 대비 %) */
const pct = (share: number) => `${(share * 100).toFixed(1)}%`;
