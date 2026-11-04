'use client';

// 둘러보기 지도: 마을에서 전체 지도를 켰을 때와 같은 3D 화면 (위에서 내려다본 본섬, 지역 색, 집, 비콘).
// 걷는 사람은 없다. 지역·중앙광장 이름표를 누르면 아래 목록이 그 지역으로 바뀐다.
// WebGL을 못 쓰거나 불러오지 못하면 onFail을 불러 부르는 쪽이 그림 지도로 바꾼다.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { assetUrl } from '@/assets/manifest';
import { townConfig } from '@/config/game';
import { tokens } from '@/design/tokens';
import { withMaxLightness } from '@/design/mbti';
import type { TownView } from '@/server/scene/service';
import { DISTRICT, DISTRICTS, type District } from '@/shared/districts';
import { parseTownMap, type TownMap } from '@/shared/townMap';
import { loadTownAssets, type TownAssets } from '../village/assets';
import { initialCamera } from '../village/camera';
import { lotKey, type TownContextValue, type TownInput } from '../village/context';
import { TownSession } from '../village/session';
import { MapScene } from '../village/VillageScene';

const districtStyle = (d: District) =>
  ({ '--chip-color': tokens.district[d], '--chip-ink': withMaxLightness(tokens.district[d], 0.4) }) as CSSProperties;

const noop = () => {};

export default function ExploreMap({
  selected, counts, onSelect, onFail,
}: {
  selected: District | 'plaza';
  counts: Partial<Record<District, number>>;
  onSelect: (d: District | 'plaza') => void;
  onFail: () => void;
}) {
  const [loaded, setLoaded] = useState<{ map: TownMap; assets: TownAssets } | null>(null);
  const [progress, setProgress] = useState(0);
  const [rendered, setRendered] = useState(false);
  const [town, setTown] = useState<TownView>({ houses: [], hidden: [] });

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
        if (alive) onFail();
      }
    })();
    fetch('/api/town', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((v: TownView | null) => alive && v && setTown(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [onFail]);

  // 걷기 없이 처음부터 지도 (카메라가 섬 전체를 위에서 본다)
  const input = useMemo<TownInput>(
    () => ({
      keys: new Set(),
      tapTarget: null,
      self: { x: 0, z: 0, ready: false },
      marker: { x: 0, z: 0, at: -10 },
      view: 'map',
      mapBlend: 1,
      labels: new Map(),
      camera: initialCamera(),
      drops: [],
      fishing: null,
      npc: { talking: false, talked: false },
    }),
    [],
  );
  const session = useMemo(() => new TownSession('town', 'plaza'), []);
  // 본섬(1동) 집만 (이름표는 공개·친구·내 집만 붙는다)
  const houses = useMemo(() => new Map(town.houses.filter((h) => h.hood === 1).map((h) => [lotKey(h), h])), [town.houses]);
  const hidden = useMemo(() => new Set(town.hidden), [town.hidden]);

  const value = useMemo<TownContextValue | null>(() => {
    if (!loaded) return null;
    const center = { x: loaded.map.width / 2, z: loaded.map.height / 2 };
    input.self.x = center.x;
    input.self.z = center.z;
    return {
      session, selfId: '', spawn: center, look: { name: '', color: 'mint', acc: 'none' }, map: loaded.map, assets: loaded.assets,
      input, hood: 1, houses, hidden, onHouse: noop, onGate: noop, market: null, onStall: noop,
    };
  }, [loaded, session, input, houses, hidden]);

  const label = (key: string) => (el: HTMLElement | null) => {
    if (el) input.labels.set(key, el);
    else input.labels.delete(key);
  };

  return (
    <div className="explore-map" role="group" aria-label="마을 지도">
      {value && <MapScene value={value} onFirstFrame={() => setRendered(true)} />}
      {!rendered && (
        <div className="explore-map__loading" aria-hidden>
          <div className="loader" />
          <span>{Math.round(progress * 100)}%</span>
        </div>
      )}
      {value && rendered && (
        <div className="map-labels map-labels--on">
          <button
            ref={label('plaza')}
            className={`map-label map-label--plaza${selected === 'plaza' ? ' map-label--picked' : ''}`}
            onClick={() => onSelect('plaza')}
            aria-pressed={selected === 'plaza'}
          >
            중앙광장
          </button>
          {DISTRICTS.map((d) => (
            <button
              key={d}
              ref={label(d)}
              className={`map-label${selected === d ? ' map-label--picked' : ''}`}
              style={districtStyle(d)}
              onClick={() => onSelect(d)}
              aria-pressed={selected === d}
              aria-label={`${DISTRICT[d].name}, 주민 ${counts[d] ?? 0}명`}
            >
              <span className="map-label__code">{DISTRICT[d].short} 지역</span>
              <span className="map-label__share">주민 {counts[d] ?? 0}</span>
            </button>
          ))}
        </div>
      )}
      <span className="explore-map__hint" aria-hidden>
        지역 이름표를 눌러 보세요 · 집 {town.houses.filter((h) => h.hood === 1).length}/{townConfig.lotsPerDistrict * DISTRICTS.length}채
      </span>
    </div>
  );
}
