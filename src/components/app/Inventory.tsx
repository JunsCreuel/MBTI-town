'use client';

// 가방(인벤토리): 놀거리로 모은 열매와 물고기 도감. 아이템마다 아이콘(manifest item.fruit.* / item.fish.*).
// 마을(위쪽 가방 버튼)과 MY에서 연다. 아직 못 잡은 물고기는 실루엣과 ???로 보인다.
import { useMemo, useState } from 'react';
import { assetUrl } from '@/assets/manifest';
import { tokens } from '@/design/tokens';
import type { PlayState } from '@/server/scene/service';
import { DISTRICTS } from '@/shared/districts';
import { FISH, FORTUNE_FRUIT, FRUITS, type FishDef, type FruitDef } from '@/shared/play';
import { Sheet } from './Sheet';

export type ItemKind = 'fruit' | 'fish';

export function ItemIcon({ kind, id, size = 40, unknown = false }: { kind: ItemKind; id: string; size?: number; unknown?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`item-icon${unknown ? ' item-icon--unknown' : ''}`} src={assetUrl(`item.${kind}.${id}`)} width={size} height={size} alt="" draggable={false} />
  );
}

export const RARITY: Record<FishDef['rarity'], { label: string; color: string }> = {
  common: { label: '흔해요', color: tokens.color.textSub },
  rare: { label: '드물어요', color: tokens.color.sky },
  legend: { label: '전설', color: tokens.emotion.joy },
  mythic: { label: '신화', color: tokens.color.goldInk },
  junk: { label: '잡동사니', color: tokens.color.lose },
};

const ALL_FRUITS: FruitDef[] = [...DISTRICTS.map((d) => FRUITS[d]), FORTUNE_FRUIT];

type Pick = { kind: 'fruit'; item: FruitDef } | { kind: 'fish'; item: FishDef };

export function InventorySheet({ state, onClose }: { state: PlayState | null; onClose: () => void }) {
  const [tab, setTab] = useState<ItemKind>('fruit');
  const [picked, setPicked] = useState<Pick | null>(null);
  const totals = useMemo(() => {
    if (!state) return null;
    return {
      fruits: Object.values(state.fruits).reduce((a, b) => a + b, 0),
      fishKinds: FISH.filter((f) => state.fish[f.id]).length,
      fish: Object.values(state.fish).reduce((a, b) => a + b, 0),
    };
  }, [state]);

  return (
    <Sheet title="가방" onClose={onClose}>
      {!state || !totals ? (
        <div className="loader" aria-hidden />
      ) : (
        <div className="inventory">
          <div className="inventory__tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'fruit'} className={`chip${tab === 'fruit' ? ' chip--on' : ''}`} onClick={() => { setTab('fruit'); setPicked(null); }}>
              열매 <b>{totals.fruits}</b>
            </button>
            <button role="tab" aria-selected={tab === 'fish'} className={`chip${tab === 'fish' ? ' chip--on' : ''}`} onClick={() => { setTab('fish'); setPicked(null); }}>
              물고기 도감 <b>{totals.fishKinds}/{FISH.length}</b>
            </button>
          </div>

          <p className="inventory__coins">
            코인 <b>{state.coins.toLocaleString('ko-KR')}</b>
            <span className="muted"> · 낚시·열매로 모아 상가 점포를 살 수 있어요</span>
          </p>

          {picked && <ItemDetail pick={picked} count={(picked.kind === 'fruit' ? state.fruits : state.fish)[picked.item.id] ?? 0} />}

          <ul className="inventory__grid">
            {tab === 'fruit'
              ? ALL_FRUITS.map((f) => {
                  const n = state.fruits[f.id] ?? 0;
                  return (
                    <li key={f.id}>
                      <button className={`inventory__item${n ? '' : ' inventory__item--empty'}${picked?.item.id === f.id ? ' inventory__item--on' : ''}`} onClick={() => setPicked({ kind: 'fruit', item: f })}>
                        <ItemIcon kind="fruit" id={f.id} size={44} unknown={!n} />
                        <span className="inventory__name">{f.name}</span>
                        {n > 0 && <span className="inventory__count">{n}</span>}
                      </button>
                    </li>
                  );
                })
              : FISH.map((f) => {
                  const n = state.fish[f.id] ?? 0;
                  return (
                    <li key={f.id}>
                      <button
                        className={`inventory__item${n ? '' : ' inventory__item--empty'}${picked?.item.id === f.id ? ' inventory__item--on' : ''}`}
                        onClick={() => n && setPicked({ kind: 'fish', item: f })}
                        disabled={!n}
                        aria-label={n ? `${f.name} ${n}마리` : '아직 못 잡은 물고기'}
                      >
                        <ItemIcon kind="fish" id={f.id} size={44} unknown={!n} />
                        <span className="inventory__name">{n ? f.name : '???'}</span>
                        {n > 0 && <span className="inventory__count">{n}</span>}
                        {n > 0 && (f.rarity === 'legend' || f.rarity === 'mythic') && (
                          <span className={`inventory__badge${f.rarity === 'mythic' ? ' inventory__badge--mythic' : ''}`}>{RARITY[f.rarity].label}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
          </ul>
          <p className="muted inventory__note">
            {tab === 'fruit'
              ? '열매는 지역마다 있는 열매 나무(하루 한 번)와 광장 운세 나무에서 따요.'
              : `낚시는 광장의 낚시터 비콘으로 가서 해요. 지금까지 ${totals.fish}마리.`}
          </p>
        </div>
      )}
    </Sheet>
  );
}

function ItemDetail({ pick, count }: { pick: Pick; count: number }) {
  return (
    <div className="inventory__detail">
      <ItemIcon kind={pick.kind} id={pick.item.id} size={72} unknown={!count} />
      <div className="inventory__detail-text">
        <p className="inventory__detail-name">
          {pick.item.name}
          {pick.kind === 'fish' && (
            <span className="inventory__rarity" style={{ color: RARITY[pick.item.rarity].color }}>
              {RARITY[pick.item.rarity].label}
            </span>
          )}
        </p>
        <p className="inventory__detail-desc">{pick.item.desc}</p>
        <p className="muted inventory__detail-meta">
          {count > 0 ? `${count}${pick.kind === 'fish' ? '마리' : '개'} 모았어요` : '아직 없어요'}
          {pick.kind === 'fish' && pick.item.size[1] > 0 && ` · 크기 ${pick.item.size[0]}~${pick.item.size[1]}cm`}
        </p>
      </div>
    </div>
  );
}
