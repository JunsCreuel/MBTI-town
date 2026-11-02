'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { assetUrl } from '@/assets/manifest';
import { plazaConfig } from '@/config/game';
import { mbtiColor, type MbtiType } from '@/design/mbti';
import { loadMbti, saveMbti } from '@/lib/session';
import { parsePlazaMap, type PlazaMap } from '@/shared/plazaMap';
import type { ActionKind, EmoteKind } from '@/shared/protocol';
import type { PlazaContextValue, PlazaInput } from './context';
import { PlazaSession } from './session';
import { loadPlazaAssets, type PlazaAssets } from './assets';

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

function Plaza({ mbti }: { mbti: MbtiType }) {
  const session = useMemo(() => new PlazaSession(mbti), [mbti]);
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [loaded, setLoaded] = useState<{ map: PlazaMap; assets: PlazaAssets } | null>(null);
  const [progress, setProgress] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [cooling, setCooling] = useState(false);
  const [hint, setHint] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const map = parsePlazaMap(await (await fetch(assetUrl('map.plaza'))).json());
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
    () => ({ keys: new Set(), tapTarget: null, self: { x: 0, z: 0, ready: false }, marker: { x: 0, z: 0, at: -10 } }),
    [],
  );
  const ready = snap.status === 'ready' && loaded !== null;
  const value = useMemo<PlazaContextValue | null>(
    () => (ready ? { session, selfId: snap.selfId, map: loaded.map, assets: loaded.assets, input } : null),
    [ready, session, snap.selfId, loaded, input],
  );

  function gesture(send: () => void) {
    if (cooling) return;
    send();
    setHint(false);
    setCooling(true);
    setTimeout(() => setCooling(false), plazaConfig.emoteCooldownMs);
  }

  const failed = loadError || snap.status === 'error' || snap.status === 'closed';

  return (
    <div className="plaza">
      {value && <PlazaScene value={value} onFirstFrame={() => setRendered(true)} />}

      {value && rendered && (
        <div className="hud">
          <div className="hud__top">
            <div className="hud__left">
              <div className="pill" aria-live="polite">
                광장 {snap.channel}번 채널
                <span className="pill__sub">{snap.playerIds.length}명</span>
              </div>
              <Link className="pill debate-link" href="/debate">
                <span className="debate-link__label">오늘의 토론</span> 보러 가기 ›
              </Link>
            </div>
            <div className="hud__right">
              <div className="pill" style={{ '--chip-color': mbtiColor(mbti) } as CSSProperties}>
                <span className="pill__dot" aria-hidden />
                {mbti}
              </div>
              <Link className="icon-btn" href="/" aria-label="광장에서 나가기">
                <span className="icon" style={icon('ui.icon.exit')} aria-hidden />
              </Link>
            </div>
          </div>

          <div className="hud__bottom">
            <div className="hud__hint" style={{ opacity: hint ? 1 : 0 }} aria-hidden={!hint}>
              바닥을 눌러 이동해요 · PC는 방향키도 돼요
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

      {!rendered && !failed && (
        <div className="overlay">
          <div className="loader" aria-hidden />
          <p className="overlay__title">광장으로 가는 중</p>
          <p className="overlay__sub">
            {loaded ? '자리를 찾고 있어요' : `마을을 불러오는 중 ${Math.round(progress * 100)}%`}
          </p>
        </div>
      )}

      {failed && (
        <div className="overlay">
          <p className="overlay__title">
            {snap.status === 'closed' ? '광장과 연결이 끊겼어요' : loadError ? '광장을 불러오지 못했어요' : snap.error}
          </p>
          <p className="overlay__sub">잠시 후 다시 들어와 주세요.</p>
          <button className="btn-secondary" onClick={() => window.location.reload()}>다시 들어가기</button>
          <Link className="back-link" href="/">처음으로</Link>
        </div>
      )}
    </div>
  );
}
