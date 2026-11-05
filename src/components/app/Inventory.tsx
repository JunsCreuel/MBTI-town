'use client';

// 가방(지금 가진 것)과 도감(모든 물고기·열매, 못 잡은 것은 실루엣과 ???). 아이템마다 아이콘(manifest item.*).
// 아래 탭의 가방·도감 화면(/bag, /dex)과 마을 위쪽 가방 버튼에서 연다.
import { useState } from 'react';
import { assetUrl } from '@/assets/manifest';
import { tokens } from '@/design/tokens';
import type { PlayState } from '@/server/scene/service';
import { ALL_FRUITS, FISH, type FishDef, type FruitDef } from '@/shared/play';
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

type Pick = { kind: 'fruit'; item: FruitDef } | { kind: 'fish'; item: FishDef };

const RARITY_ORDER: FishDef['rarity'][] = ['mythic', 'legend', 'rare', 'common', 'junk'];

/** 가방: 지금 가진 것 (코인, 모은 열매, 잡은 물고기). 누르면 자세히 */
export function BagContent({ state }: { state: PlayState }) {
  const [picked, setPicked] = useState<Pick | null>(null);
  const fruits = ALL_FRUITS.filter((f) => (state.fruits[f.id] ?? 0) > 0);
  const fish = FISH.filter((f) => (state.fish[f.id] ?? 0) > 0).sort(
    (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || (state.fish[b.id] ?? 0) - (state.fish[a.id] ?? 0),
  );
  return (
    <div className="inventory">
      <p className="inventory__coins">
        코인 <b>{state.coins.toLocaleString('ko-KR')}</b>
      </p>
      {picked && <ItemDetail pick={picked} count={(picked.kind === 'fruit' ? state.fruits : state.fish)[picked.item.id] ?? 0} />}
      {fruits.length + fish.length === 0 ? (
        <p className="empty">아직 모은 게 없어요. 열매 나무와 낚시터에 가 보세요.</p>
      ) : (
        <ul className="inventory__grid">
          {[...fruits.map((f) => ({ kind: 'fruit' as const, item: f, n: state.fruits[f.id] })), ...fish.map((f) => ({ kind: 'fish' as const, item: f, n: state.fish[f.id] }))].map(
            (x) => (
              <li key={`${x.kind}:${x.item.id}`}>
                <button
                  className={`inventory__item${picked?.item.id === x.item.id ? ' inventory__item--on' : ''}`}
                  onClick={() => setPicked(x.kind === 'fruit' ? { kind: 'fruit', item: x.item } : { kind: 'fish', item: x.item as FishDef })}
                >
                  <ItemIcon kind={x.kind} id={x.item.id} size={44} />
                  <span className="inventory__name">{x.item.name}</span>
                  <span className="inventory__count">{x.n}</span>
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

/** 도감: 모든 물고기·열매 (못 잡은 것은 실루엣과 ???), 채운 정도 */
export function DexContent({ state }: { state: PlayState }) {
  const [tab, setTab] = useState<'fish' | 'fruit'>('fish');
  const [picked, setPicked] = useState<Pick | null>(null);
  const fishKinds = FISH.filter((f) => state.fish[f.id]).length;
  const fruitKinds = ALL_FRUITS.filter((f) => state.fruits[f.id]).length;
  const [have, all] = tab === 'fish' ? [fishKinds, FISH.length] : [fruitKinds, ALL_FRUITS.length];
  return (
    <div className="inventory">
      <div className="inventory__tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'fish'} className={`chip${tab === 'fish' ? ' chip--on' : ''}`} onClick={() => { setTab('fish'); setPicked(null); }}>
          물고기 <b>{fishKinds}/{FISH.length}</b>
        </button>
        <button role="tab" aria-selected={tab === 'fruit'} className={`chip${tab === 'fruit' ? ' chip--on' : ''}`} onClick={() => { setTab('fruit'); setPicked(null); }}>
          열매 <b>{fruitKinds}/{ALL_FRUITS.length}</b>
        </button>
      </div>
      <div className="dex-progress" role="progressbar" aria-valuemin={0} aria-valuemax={all} aria-valuenow={have} aria-label="도감 채운 정도">
        <span style={{ width: `${(have / all) * 100}%` }} />
        <b>{Math.round((have / all) * 100)}%</b>
      </div>
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
                    aria-label={n ? f.name : '아직 못 잡은 물고기'}
                  >
                    <ItemIcon kind="fish" id={f.id} size={44} unknown={!n} />
                    <span className="inventory__name">{n ? f.name : '???'}</span>
                    {n > 0 && (f.rarity === 'legend' || f.rarity === 'mythic') && (
                      <span className={`inventory__badge${f.rarity === 'mythic' ? ' inventory__badge--mythic' : ''}`}>{RARITY[f.rarity].label}</span>
                    )}
                  </button>
                </li>
              );
            })}
      </ul>
    </div>
  );
}

/** 마을에서 여는 가방 (가방 · 도감 두 칸) */
export function InventorySheet({ state, onClose }: { state: PlayState | null; onClose: () => void }) {
  const [tab, setTab] = useState<'bag' | 'dex'>('bag');
  return (
    <Sheet title={tab === 'bag' ? '가방' : '도감'} onClose={onClose}>
      {!state ? (
        <div className="loader" aria-hidden />
      ) : (
        <>
          <div className="inventory__tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'bag'} className={`chip${tab === 'bag' ? ' chip--on' : ''}`} onClick={() => setTab('bag')}>
              가방
            </button>
            <button role="tab" aria-selected={tab === 'dex'} className={`chip${tab === 'dex' ? ' chip--on' : ''}`} onClick={() => setTab('dex')}>
              도감
            </button>
          </div>
          {tab === 'bag' ? <BagContent state={state} /> : <DexContent state={state} />}
        </>
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
