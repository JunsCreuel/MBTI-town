'use client';

// 상가: 점포 20칸. 차양은 주인이 고른 색, 차양 위 간판에 점포 이름(빈 점포는 "빈 점포 · 값").
// 점포 앞에 서면 "점포 보기" 버튼이 뜨고(VillageClient), 점포를 눌러도 열린다. 시트에서 사고, 이름·소개·색을 바꾸고, 내놓는다.
// 점포 번호는 맵에 놓인 순서 (북서쪽부터 시계 방향, 1~20호).
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { marketConfig } from '@/config/game';
import { tokens } from '@/design/tokens';
import { call } from '@/lib/api';
import { cardFont } from '@/lib/shareCard';
import { SHOP_COLORS, SHOP_COLOR_NAME, STALL_KEY, refundFor, shopLabel, type MarketShop, type MarketView, type ShopColor } from '@/shared/market';
import { groundHeightAt, type TownMap } from '@/shared/townMap';
import { Sheet } from '../app/Sheet';
import { useTown } from './context';
import { InstancedProps, buildGroup } from './Props';

const S = tokens.scene;
/** 차양 위 간판 (marketStallParts와 같은 자리): 가운데 높이, 앞면 z, 크기 */
const SIGN = { y: 2.62, z: 0.7, w: 1.56, h: 0.4 };
const SIGN_PX = { w: 624, h: 160 };

export interface Stall {
  slot: number;
  x: number;
  z: number;
  yaw: number;
}

export function stallsOf(map: TownMap): Stall[] {
  return map.props.filter((p) => p.key === STALL_KEY).map((p, slot) => ({ slot, x: p.x, z: p.z, yaw: p.yaw }));
}

/** 손님이 서는 자리 (점포 정면 앞) */
export function stallFront(s: Stall, d = 1.25): { x: number; z: number } {
  return { x: s.x + Math.sin(s.yaw) * d, z: s.z + Math.cos(s.yaw) * d };
}

const money = (n: number) => n.toLocaleString('ko-KR');

async function drawSign(slot: number, shop: MarketShop | undefined): Promise<HTMLCanvasElement> {
  await Promise.all([document.fonts?.load(cardFont(800, 60)), document.fonts?.load(cardFont(600, 30))]);
  const c = document.createElement('canvas');
  c.width = SIGN_PX.w;
  c.height = SIGN_PX.h;
  const g = c.getContext('2d')!;
  g.fillStyle = S.signFace;
  g.fillRect(0, 0, c.width, c.height);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (shop) {
    // 이름이 길면 글자를 줄여 판 안에 넣는다
    let size = 64;
    g.font = cardFont(800, size);
    while (g.measureText(shop.name).width > c.width - 40 && size > 30) g.font = cardFont(800, (size -= 4));
    g.fillStyle = S.signInk;
    g.fillText(shop.name, c.width / 2, 62);
    g.fillStyle = S.signSub;
    g.font = cardFont(600, 28);
    g.fillText(`${shopLabel(slot)} · ${shop.owner.displayName}`, c.width / 2, 124);
  } else {
    g.fillStyle = S.signSub;
    g.font = cardFont(800, 52);
    g.fillText(`${shopLabel(slot)} 빈 점포`, c.width / 2, 62);
    g.font = cardFont(600, 30);
    g.fillText(`${money(marketConfig.price)}코인에 살 수 있어요`, c.width / 2, 122);
  }
  return c;
}

function StallSign({ stall, shop }: { stall: Stall; shop: MarketShop | undefined }) {
  const { map } = useTown();
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const key = shop ? `${shop.name}|${shop.owner.displayName}` : '';
  useEffect(() => {
    let alive = true;
    let made: THREE.CanvasTexture | null = null;
    void drawSign(stall.slot, shop).then((canvas) => {
      if (!alive) return;
      made = new THREE.CanvasTexture(canvas);
      made.colorSpace = THREE.SRGBColorSpace;
      made.anisotropy = 4;
      setTexture(made);
    });
    return () => {
      alive = false;
      made?.dispose();
    };
    // 이름·주인이 바뀔 때만 다시 그린다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stall.slot, key]);
  if (!texture) return null;
  return (
    <group position={[stall.x, groundHeightAt(map, stall.x, stall.z), stall.z]} rotation-y={stall.yaw}>
      <mesh position={[0, SIGN.y, SIGN.z]}>
        <planeGeometry args={[SIGN.w, SIGN.h]} />
        <meshBasicMaterial map={texture} />
      </mesh>
    </group>
  );
}

/** 상가 점포 20칸 (3D). 차양 색 = 주인이 고른 색, 빈 점포는 흰색 */
export function MarketStalls() {
  const { map, assets, market, onStall } = useTown();
  const stalls = useMemo(() => stallsOf(map), [map]);
  const bySlot = useMemo(() => new Map((market?.shops ?? []).map((s) => [s.slot, s])), [market]);
  const colors = stalls.map((s) => bySlot.get(s.slot)?.color ?? '').join(',');
  const group = useMemo(() => {
    if (!stalls.length || !assets.props[STALL_KEY]) return null;
    return buildGroup(
      STALL_KEY,
      stalls.map((s) => {
        const color = bySlot.get(s.slot)?.color;
        return { key: STALL_KEY, x: s.x, z: s.z, yaw: s.yaw, tint: color ? tokens.taste[color] : tokens.taste.white };
      }),
      assets,
    );
    // 색이 바뀔 때만 다시 만든다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stalls, assets, colors]);
  if (!group) return null;
  return (
    <>
      <InstancedProps key={colors} group={group} onPick={(k) => onStall(stalls[k].slot)} />
      {stalls.map((s) => (
        <StallSign key={s.slot} stall={s} shop={bySlot.get(s.slot)} />
      ))}
    </>
  );
}

// ───────────────────────── 점포 시트 ─────────────────────────

function ShopForm({
  initial, submitLabel, busy, disabled = false, onSubmit,
}: {
  initial: { name: string; intro: string; color: ShopColor };
  submitLabel: string;
  busy: boolean;
  disabled?: boolean;
  onSubmit: (v: { name: string; intro: string; color: ShopColor }) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [intro, setIntro] = useState(initial.intro);
  const [color, setColor] = useState<ShopColor>(initial.color);
  return (
    <form
      className="shop-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name: name.trim(), intro: intro.trim(), color });
      }}
    >
      <label className="field">
        <span className="field__label">점포 이름</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={marketConfig.nameMax} placeholder="예: 붕어빵 가게" required />
      </label>
      <label className="field">
        <span className="field__label">한 줄 소개 (선택)</span>
        <input value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={marketConfig.introMax} placeholder="예: 갓 낚은 물고기 자랑하는 곳" />
      </label>
      <div className="field">
        <span className="field__label">차양 색</span>
        <div className="shop-colors" role="radiogroup" aria-label="차양 색">
          {SHOP_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === color}
              aria-label={SHOP_COLOR_NAME[c]}
              className={`shop-color${c === color ? ' shop-color--on' : ''}`}
              style={{ background: tokens.taste[c] }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>
      <button className="btn-primary" disabled={busy || disabled || !name.trim()}>
        {submitLabel}
      </button>
    </form>
  );
}

export function MarketSheet({
  slot, view, onChanged, onClose,
}: {
  slot: number;
  view: MarketView | null;
  onChanged: (v: MarketView) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const shop = view?.shops.find((s) => s.slot === slot);

  async function run(method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown> | undefined, done: string) {
    setBusy(true);
    setNote(null);
    try {
      const url = method === 'DELETE' ? `/api/market?slot=${slot}` : '/api/market';
      onChanged(await call<MarketView>(method, url, body));
      setNote(done);
    } catch (e) {
      setNote(e instanceof Error ? e.message : '잠시 뒤에 다시 해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  const title = shop ? `${shopLabel(slot)} · ${shop.name}` : `${shopLabel(slot)} 빈 점포`;
  return (
    <Sheet title={title} onClose={onClose}>
      {!view ? (
        <div className="loader" aria-hidden />
      ) : (
        <div className="shop-sheet">
          {view.coins !== null && (
            <p className="shop-sheet__coins">
              내 코인 <b>{money(view.coins)}</b>
            </p>
          )}

          {shop && !shop.mine && (
            <>
              <div className="shop-card" style={{ borderColor: tokens.taste[shop.color] }}>
                <p className="shop-card__name">{shop.name}</p>
                {shop.intro && <p className="shop-card__intro">{shop.intro}</p>}
                <p className="muted">주인 {shop.owner.displayName}</p>
              </div>
              {shop.owner.handle && (
                <Link className="btn-secondary" href={`/r/${shop.owner.handle}`}>
                  주인 방 구경 가기
                </Link>
              )}
              {view.admin && (
                <button
                  className="btn-danger btn-small"
                  disabled={busy}
                  onClick={() => confirm(`${title}을(를) 비울까요? 주인에게 ${money(refundFor())}코인을 돌려줘요.`) && void run('DELETE', undefined, '점포를 비웠어요.')}
                >
                  운영자: 점포 비우기
                </button>
              )}
            </>
          )}

          {shop?.mine && (
            <>
              <p className="muted">내 점포예요. 이름·소개·차양 색을 바꿀 수 있어요.</p>
              <ShopForm key={`${shop.name}|${shop.intro}|${shop.color}`} initial={shop} submitLabel="저장하기" busy={busy} onSubmit={(v) => void run('PATCH', v, '저장했어요.')} />
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={() => confirm(`점포를 내놓을까요? ${money(refundFor())}코인을 돌려받아요.`) && void run('DELETE', undefined, `점포를 내놓고 ${money(refundFor())}코인을 돌려받았어요.`)}
              >
                점포 내놓기 ({money(refundFor())}코인 돌려받기)
              </button>
            </>
          )}

          {!shop && (
            <>
              <p>
                {money(view.price)}코인에 살 수 있는 빈 점포예요. 이름과 차양 색을 정하면 간판이 걸려요.
              </p>
              {view.coins === null ? (
                <p className="notice">집이 있는 주민만 점포를 살 수 있어요.</p>
              ) : view.myShop !== null ? (
                <p className="notice">이미 {shopLabel(view.myShop)} 점포 주인이에요. 점포는 한 사람에 한 칸이에요.</p>
              ) : (
                <>
                  {view.coins < view.price && (
                    <p className="notice">코인이 {money(view.price - view.coins)} 모자라요. 낚시와 열매 따기로 모아 보세요.</p>
                  )}
                  <ShopForm
                    initial={{ name: '', intro: '', color: SHOP_COLORS[slot % SHOP_COLORS.length] }}
                    submitLabel={`${money(view.price)}코인에 사기`}
                    busy={busy}
                    disabled={view.coins < view.price}
                    onSubmit={(v) => void run('POST', { slot, ...v }, `${shopLabel(slot)} 점포 주인이 되었어요!`)}
                  />
                </>
              )}
            </>
          )}

          {note && (
            <p className="notice" role="status">
              {note}
            </p>
          )}
          <p className="muted shop-sheet__foot">코인은 낚시(물고기마다)와 열매 따기로 모아요. 게임 안에서만 쓰는 돈이에요.</p>
        </div>
      )}
    </Sheet>
  );
}
