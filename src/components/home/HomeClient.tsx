'use client';

// HOME: 나의 방 = 마을 속 내 집 안 (PROJECT_GUIDE.md 4, 6장). 마을에서 내 집 문으로 들어온다.
// 보기: 바닥을 누르면 걷고, 턴테이블·책상·우편함·옷장·액자를 누르면 그 기능이 열린다.
// 꾸미기: 소품 추가·옮기기·돌리기·빼기, 벽지·바닥·BGM 바꾸기, 저장.
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { recordConfig, roomConfig } from '@/config/game';
import { tokens } from '@/design/tokens';
import { call, errorMessage, shrinkImage } from '@/lib/api';
import type { RoomView } from '@/server/scene/service';
import { ACCESSORIES, AVATAR_COLORS, petNameOf, profileTag, type Avatar } from '@/shared/avatar';
import { BGM_TRACKS } from '@/shared/bgm';
import { DEFAULT_DISTRICT, DISTRICT } from '@/shared/districts';
import {
  FLOORS, FURNITURE, WALLPAPERS, canPlace, findFreeSpot, furnitureDef,
  type FurnitureAction, type PlacedItem, type RoomLayout, type Rot,
} from '@/shared/room';
import { BgmPlayer, type BgmHandle } from '../app/BgmPlayer';
import { LookPickers } from '../app/LookPickers';
import { PANEL_CLOSED_EVENT, openPanel } from '../app/panelState';
import { GesturePicker } from '../app/GesturePicker';
import { Guide } from '../app/Guide';
import { PetNameSheet } from '../app/PetNameSheet';
import { Icon } from '../app/Icon';
import { Sheet } from '../app/Sheet';
import { TabBar } from '../app/TabBar';
import { useMe } from '../app/useMe';
import { loadRoomAssets, type RoomAssets } from '../room/assets';
import { Guestbook } from '../room/Guestbook';

import { useHousePresence } from '../room/useHousePresence';
import { useHudInsets } from '../room/useHudInsets';
const RoomScene = dynamic(() => import('../room/RoomScene'), { ssr: false });
const AvatarPreview = dynamic(() => import('../room/AvatarPreview'), { ssr: false });

type SheetKind = 'guestbook' | 'visitors' | 'wardrobe' | 'frame' | 'petName' | null;
type EditTab = 'items' | 'wall' | 'floor' | 'bgm';

const newId = () => Math.random().toString(36).slice(2, 10);
const photoUrl = (id: string) => `/api/photos/${id}`;

export function HomeClient() {
  const router = useRouter();
  const params = useSearchParams();
  const { me, reload } = useMe({ require: 'onboarded' });
  // 위에 연 창(캐릭터·MY 등)을 닫으면 바뀐 모습·이름을 다시 읽는다
  useEffect(() => {
    const on = () => void reload();
    window.addEventListener(PANEL_CLOSED_EVENT, on);
    return () => window.removeEventListener(PANEL_CLOSED_EVENT, on);
  }, [reload]);
  const [assets, setAssets] = useState<RoomAssets | null>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [layout, setLayout] = useState<RoomLayout | null>(null);
  const [bgm, setBgm] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [draft, setDraft] = useState<{ layout: RoomLayout; bgm: string | null } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editTab, setEditTab] = useState<EditTab>('items');
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [frameItem, setFrameItem] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [welcome, setWelcome] = useState(params.get('welcome') === '1');
  const [saving, setSaving] = useState(false);
  /** 보기: 1인칭(기본) 또는 방 전체를 위에서 */
  const [overview, setOverview] = useState(false);
  /** 강아지를 누르면 잠깐 뜨는 이름 카드 (이름 짓기로 이어진다) */
  const [petCard, setPetCard] = useState(false);
  /** 쓰다듬기 버튼을 누른 횟수 (방 장면이 강아지 곁으로 걸어가 쓰다듬는다) */
  const [petCall, setPetCall] = useState(0);
  useEffect(() => {
    if (!petCard) return;
    const t = setTimeout(() => setPetCard(false), 5000);
    return () => clearTimeout(t);
  }, [petCard]);
  const player = useRef<BgmHandle>(null);

  useEffect(() => {
    loadRoomAssets(setProgress).then(setAssets).catch(() => setToast('방을 불러오지 못했어요. 새로고침해 주세요.'));
  }, []);

  useEffect(() => {
    if (me?.room && !layout) {
      setLayout(me.room.layout);
      setBgm(me.room.bgm);
    }
  }, [me, layout]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!welcome) return;
    router.replace('/home');
    const t = setTimeout(() => setWelcome(false), 9000);
    return () => clearTimeout(t);
  }, [welcome, router]);

  const profile = me?.profile;
  const shown = mode === 'edit' && draft ? draft.layout : layout;

  const onAction = useCallback(
    (action: FurnitureAction, item: PlacedItem) => {
      setWelcome(false);
      if (action === 'bgm') player.current?.toggle();
      else if (action === 'archive') openPanel('archive');
      // 우편함: 방명록
      else if (action === 'guestbook') setSheet('guestbook');
      else if (action === 'wardrobe') setSheet('wardrobe');
      else if (action === 'frame') {
        setFrameItem(item.id);
        setSheet('frame');
      } else if (action === 'window' && profile?.district) {
        setToast(`${DISTRICT[profile.district].name} 풍경이에요. MY에서 MBTI를 바꾸면 그 마을로 이사해요.`);
      }
    },
    [router, profile?.district],
  );

  // ───────── 꾸미기 ─────────

  function startEdit() {
    if (!layout) return;
    setDraft({ layout: structuredClone(layout), bgm });
    setSelected(null);
    setEditTab('items');
    setMode('edit');
    setWelcome(false);
  }

  function cancelEdit() {
    setDraft(null);
    setSelected(null);
    setMode('view');
    // 손님 화면은 저장된 방으로 돌아간다
    presence?.sendFurni({ op: 'reset' });
  }

  async function saveEdit() {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await call<{ layout: RoomLayout; bgm: string | null }>('PUT', '/api/room', draft);
      setLayout(saved.layout);
      setBgm(saved.bgm);
      setDraft(null);
      setSelected(null);
      setMode('view');
      setToast('방을 저장했어요');
      // 손님 화면은 저장한 방을 다시 받는다
      presence?.sendFurni({ op: 'reset' });
    } catch (e) {
      setToast(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const updateItems = (fn: (items: PlacedItem[]) => PlacedItem[]) =>
    setDraft((d) => (d ? { ...d, layout: { ...d.layout, items: fn(d.layout.items) } } : d));

  function addItem(key: string) {
    if (!draft) return;
    const def = furnitureDef(key)!;
    if (draft.layout.items.length >= roomConfig.maxItems) return setToast(`소품은 ${roomConfig.maxItems}개까지 둘 수 있어요`);
    if (def.unique && draft.layout.items.some((i) => i.key === key)) return setToast(`${def.name}은(는) 하나만 둘 수 있어요`);
    const spot = findFreeSpot(draft.layout.items, key, newId());
    if (!spot) return setToast('둘 자리가 없어요. 다른 소품을 옮겨 보세요');
    updateItems((items) => [...items, spot]);
    setSelected(spot.id);
    presence?.sendFurni({ op: 'set', item: spot });
  }

  function rotateSelected() {
    if (!draft || !selected) return;
    const item = draft.layout.items.find((i) => i.id === selected);
    if (!item || furnitureDef(item.key)?.kind === 'wall') return;
    for (let k = 1; k <= 3; k++) {
      const next = { ...item, rot: ((item.rot + k) % 4) as Rot };
      if (canPlace(draft.layout.items, next)) {
        presence?.sendFurni({ op: 'set', item: next });
        return updateItems((items) => items.map((i) => (i.id === item.id ? next : i)));
      }
    }
    setToast('돌릴 자리가 없어요');
  }

  function removeSelected() {
    if (!selected) return;
    updateItems((items) => items.filter((i) => i.id !== selected));
    presence?.sendFurni({ op: 'remove', id: selected });
    setSelected(null);
  }

  const selectedItem = draft?.layout.items.find((i) => i.id === selected) ?? null;
  const selectedDef = selectedItem ? furnitureDef(selectedItem.key) : null;

  // ───────── 옷장·액자 ─────────

  async function saveAvatar(avatar: Avatar) {
    try {
      await call('PATCH', '/api/me', { avatar });
      await reload();
      setSheet(null);
    } catch (e) {
      setToast(errorMessage(e));
    }
  }

  async function hangPhoto(photoId: string | null) {
    if (!layout || !frameItem) return;
    const next = { ...layout, items: layout.items.map((i) => (i.id === frameItem ? { ...i, photoId: photoId ?? undefined } : i)) };
    try {
      const saved = await call<{ layout: RoomLayout }>('PUT', '/api/room', { layout: next });
      setLayout(saved.layout);
      setSheet(null);
      setToast(photoId ? '액자에 사진을 걸었어요' : '액자를 비웠어요');
      presence?.sendFurni({ op: 'reset' });
    } catch (e) {
      setToast(errorMessage(e));
    }
  }

  // 내 방에 들어온 친구·손님과 함께 있는다
  const { presence, snap: presenceSnap, others } = useHousePresence(profile?.handle ?? null);
  // 같이 꾸미기: 손님이 옮긴 가구를 내 초안에 넣는다 (놓을 수 없는 자리면 내 자리로 되돌려 알린다)
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(
    () =>
      presence?.onFurni((m) => {
        if (m.op !== 'carry' && m.op !== 'move' && m.op !== 'drop') return;
        const d = draftRef.current;
        const cur = d?.layout.items.find((i) => i.id === m.item.id);
        if (!d || !cur || cur.key !== m.item.key) return;
        if (!canPlace(d.layout.items, m.item)) {
          if (m.op === 'drop') presence.sendFurni({ op: 'set', item: cur });
          return;
        }
        const next = { ...cur, x: m.item.x, z: m.item.z, ...(m.item.wall ? { wall: m.item.wall } : {}) };
        setDraft((dd) => (dd ? { ...dd, layout: { ...dd.layout, items: dd.layout.items.map((i) => (i.id === next.id ? next : i)) } } : dd));
      }),
    [presence],
  );

  // HUD 사이에 방이 오게 (모드가 바뀌거나 HUD가 처음 그려지면 다시 잰다)
  const insets = useHudInsets(`${mode}:${!!(me && profile && shown)}`, mode === 'edit' ? { top: 70, bottom: 190 } : { top: 104, bottom: 250 });

  if (!me || !profile || !shown) {
    return (
      <main className="room-page">
        <div className="overlay">
          <div className="loader" aria-hidden />
        </div>
      </main>
    );
  }

  const district = profile.district ?? profile.mbti ?? DEFAULT_DISTRICT;
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/r/${profile.handle}` : '';

  return (
    <main className="room-page" style={{ '--district': tokens.district[district] } as CSSProperties}>
      <div className="room-page__stage">
        {assets && (
          <RoomScene
            assets={assets}
            layout={shown}
            district={district}
            avatar={profile.avatar}
            selfName={profile.displayName}
            selfTag={profileTag(profile.mbti)}
            presence={presence}
            mode={mode}
            framing={overview ? 'overview' : 'inside'}
            selectedId={selected}
            onSelect={setSelected}
            onMove={(item) => updateItems((items) => items.map((i) => (i.id === item.id ? item : i)))}
            onAction={onAction}
            playing={playing}
            photoUrl={photoUrl}
            petName={petNameOf(profile.avatar, 'dog')}
            onPetTap={() => setPetCard(true)}
            petCall={petCall}
            insetTop={insets.top}
            insetBottom={insets.bottom}
            onReady={() => setReady(true)}
          />
        )}
      </div>

      {/* 마을에서 문을 열고 들어오는 동안. 장면이 그려지면 서서히 걷힌다 */}
      <div className={`room-enter${ready ? ' room-enter--done' : ''}`} aria-hidden={ready}>
        <div className="loader" aria-hidden />
        <p className="room-enter__text">방에 들어가는 중…</p>
        {!assets && <p className="room-enter__sub">{Math.round(progress * 100)}%</p>}
      </div>

      {mode === 'view' && (
        <>
          <header className="room-top" data-hud="top">
            <div className="owner-card">
              <span className="owner-card__dot" style={{ background: tokens.avatar[profile.avatar.color] }} aria-hidden />
              <div className="owner-card__text">
                <strong>{profile.displayName}의 방</strong>
                <span>{others > 0 ? `${others}명이 놀러 와 있어요` : profile.bio || '프로필 문구를 MY에서 적어 보세요'}</span>
              </div>
              <span className="district-chip">{DISTRICT[district].name}</span>
            </div>
            <div className="room-top__actions">
              <button className={`icon-btn${overview ? ' icon-btn--accent' : ''}`} aria-label={overview ? '눈높이로 보기' : '방 전체 보기'} aria-pressed={overview} onClick={() => setOverview((o) => !o)}>
                <Icon name="map" size={20} />
              </button>
              {/* 문을 나서면 마을의 내 집 앞이다 */}
              <Link className="icon-btn" href="/village" aria-label="마을로 나가기">
                <Icon name="exit" size={20} />
              </Link>
              <button
                className="icon-btn"
                aria-label="방 주소 복사"
                onClick={async () => {
                  try {
                    if (navigator.share) await navigator.share({ title: `${profile.displayName}의 방`, url: shareUrl });
                    else {
                      await navigator.clipboard.writeText(shareUrl);
                      setToast('방 주소를 복사했어요');
                    }
                  } catch {}
                }}
              >
                <Icon name="share" size={20} />
              </button>
              <button className="icon-btn icon-btn--accent" aria-label="방 꾸미기" onClick={startEdit}>
                <Icon name="edit" size={20} />
              </button>
            </div>
          </header>

          {welcome && (
            <div className="room-welcome">
              <Guide>나의 방이 생겼어요! 바닥을 누르면 걸어가고, 화면을 끌면 둘러봐요. 지도 버튼은 방 전체 보기예요. 턴테이블을 누르면 음악이 나오고, 강아지를 누르면 쓰다듬고 이름도 지어 줄 수 있어요. 연필 버튼으로 꾸며 보세요.</Guide>
            </div>
          )}

          <div className="room-bottom" data-hud="bottom">
            {petCard && (
              <div className="guest-card pet-card">
                <span>{petNameOf(profile.avatar, 'dog')}</span>
                <button
                  className="btn-primary btn-primary--inline"
                  onClick={() => {
                    setPetCard(false);
                    setSheet('petName');
                  }}
                >
                  이름 짓기
                </button>
              </div>
            )}
            {presence && (
              <GesturePicker variant="button" onAction={(k) => presence.sendAction(k)} onEmote={(k) => presence.sendEmote(k)} onPet={() => setPetCall((n) => n + 1)} selfPop={!overview} />
            )}
            <BgmPlayer ref={player} trackKey={bgm} onPlayingChange={setPlaying} />
            <div className="quick-actions">
              <button className="quick" onClick={() => openPanel('archive', { startNew: true })}>
                <Icon name="edit" size={20} />
                기록 쓰기
              </button>
              <button className="quick" onClick={() => setSheet('guestbook')}>
                <Icon name="mail" size={20} />
                방명록
              </button>
              <button className="quick" onClick={() => setSheet('visitors')}>
                <Icon name="friends" size={20} />
                방문자
              </button>
              <button className="quick" onClick={() => setSheet('wardrobe')}>
                <Icon name="my" size={20} />
                옷장
              </button>
            </div>
          </div>
          <TabBar stay />
        </>
      )}

      {mode === 'edit' && draft && (
        <>
          <header className="edit-top" data-hud="top">
            <button className="btn-ghost" onClick={cancelEdit}>취소</button>
            <strong>방 꾸미기</strong>
            <button className="btn-primary btn-primary--inline" onClick={saveEdit} disabled={saving}>
              {saving ? '저장 중…' : '저장'}
            </button>
          </header>
          <div className="edit-panel" data-hud="bottom">
            {/* 방에 손님이 있으면 같이 꾸미기를 켤 수 있다 (손님은 가구를 들고 옮기기만, 저장은 내가) */}
            {(others > 0 || presenceSnap?.coEdit) && (
              <button
                className={`pill-btn coedit-toggle${presenceSnap?.coEdit ? ' coedit-toggle--on' : ''}`}
                aria-pressed={!!presenceSnap?.coEdit}
                onClick={() => presence?.sendCoEdit(!presenceSnap?.coEdit)}
              >
                <Icon name="friends" size={16} /> {presenceSnap?.coEdit ? '같이 꾸미는 중 · 끄기' : '손님과 같이 꾸미기'}
              </button>
            )}
            {selectedItem && selectedDef ? (
              <div className="edit-selected">
                <span className="edit-selected__name">{selectedDef.name}</span>
                <span className="muted">끌어서 옮겨요</span>
                {selectedDef.kind !== 'wall' && (
                  <button className="tool-btn" onClick={rotateSelected}>
                    <Icon name="rotate" size={18} /> 돌리기
                  </button>
                )}
                <button className="tool-btn tool-btn--danger" onClick={removeSelected}>
                  <Icon name="trash" size={18} /> 빼기
                </button>
                <button className="tool-btn" onClick={() => setSelected(null)}>
                  <Icon name="check" size={18} /> 다 했어요
                </button>
              </div>
            ) : (
              <>
                <div className="seg" role="tablist">
                  {([['items', '소품'], ['wall', '벽지'], ['floor', '바닥'], ['bgm', 'BGM']] as const).map(([id, label]) => (
                    <button key={id} role="tab" aria-selected={editTab === id} className={`seg__btn${editTab === id ? ' seg__btn--on' : ''}`} onClick={() => setEditTab(id)}>
                      {label}
                    </button>
                  ))}
                </div>
                {editTab === 'items' && (
                  <div className="catalog">
                    {FURNITURE.map((f) => {
                      const placed = draft.layout.items.some((i) => i.key === f.key);
                      return (
                        <button key={f.key} className="catalog__item" onClick={() => addItem(f.key)} disabled={f.unique && placed}>
                          <Icon name="plus" size={14} />
                          {f.name}
                          {f.unique && placed && <small>놓음</small>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {editTab === 'wall' && (
                  <div className="swatches">
                    {WALLPAPERS.map((w) => (
                      <button key={w.id} className={`swatch swatch--square${draft.layout.wallpaper === w.id ? ' swatch--on' : ''}`} style={{ background: tokens.room.wall[w.id] }} title={w.label} aria-label={w.label}
                        onClick={() => setDraft({ ...draft, layout: { ...draft.layout, wallpaper: w.id } })} />
                    ))}
                  </div>
                )}
                {editTab === 'floor' && (
                  <div className="swatches">
                    {FLOORS.map((f) => (
                      <button key={f.id} className={`swatch swatch--square${draft.layout.floor === f.id ? ' swatch--on' : ''}`} style={{ background: tokens.room.floor[f.id] }} title={f.label} aria-label={f.label}
                        onClick={() => setDraft({ ...draft, layout: { ...draft.layout, floor: f.id } })} />
                    ))}
                  </div>
                )}
                {editTab === 'bgm' && (
                  <div className="chips">
                    {BGM_TRACKS.map((t) => (
                      <button key={t.key} className={`chip${draft.bgm === t.key ? ' chip--on' : ''}`} onClick={() => setDraft({ ...draft, bgm: t.key })}>
                        <Icon name="music" size={14} /> {t.title}
                      </button>
                    ))}
                  </div>
                )}
                <p className="muted edit-hint">소품을 누르면 고를 수 있어요. 고른 소품은 끌어서 옮겨요.</p>
              </>
            )}
          </div>
        </>
      )}

      {sheet === 'guestbook' && <OwnerGuestbook handle={profile.handle} onClose={() => setSheet(null)} />}
      {sheet === 'visitors' && <Visitors handle={profile.handle} onClose={() => setSheet(null)} />}
      {sheet === 'petName' && (
        <PetNameSheet
          pet="dog"
          current={profile.avatar.petNames.dog ?? ''}
          onSaved={async (avatar) => {
            setSheet(null);
            setToast(`강아지 이름: ${petNameOf(avatar, 'dog')}`);
            await reload();
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'wardrobe' && assets && (
        <Wardrobe assets={assets} initial={profile.avatar} onSave={saveAvatar} onClose={() => setSheet(null)} />
      )}
      {sheet === 'frame' && (
        <FramePicker
          current={layout?.items.find((i) => i.id === frameItem)?.photoId ?? null}
          onPick={hangPhoto}
          onClose={() => setSheet(null)}
          onError={setToast}
        />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function OwnerGuestbook({ handle, onClose }: { handle: string; onClose: () => void }) {
  const [view, setView] = useState<RoomView | null>(null);
  const load = useCallback(() => call<RoomView>('GET', `/api/rooms/${handle}`).then(setView).catch(() => {}), [handle]);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <Sheet title="방명록" onClose={onClose}>
      {view ? <Guestbook handle={handle} entries={view.guestbook} canWrite={false} isOwner onChange={load} /> : <div className="loader" aria-hidden />}
    </Sheet>
  );
}

function Visitors({ handle, onClose }: { handle: string; onClose: () => void }) {
  const [view, setView] = useState<RoomView | null>(null);
  useEffect(() => {
    call<RoomView>('GET', `/api/rooms/${handle}`).then(setView).catch(() => {});
  }, [handle]);
  return (
    <Sheet title="최근 방문자" onClose={onClose}>
      <p className="muted">최근 30일 동안 다녀간 사람이에요. 나만 볼 수 있고, MY에서 끌 수 있어요.</p>
      {!view ? (
        <div className="loader" aria-hidden />
      ) : view.visitors?.length ? (
        <ul className="people">
          {view.visitors.map((v) => (
            <li key={v.handle}>
              <a className="person" href={`/r/${v.handle}`}>
                <span className="dot" style={{ background: tokens.avatar[v.avatar.color] }} aria-hidden />
                <span className="person__name">{v.displayName}</span>
                <span className="muted">{new Date(v.lastAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">아직 다녀간 사람이 없어요.</p>
      )}
    </Sheet>
  );
}

function Wardrobe({ assets, initial, onSave, onClose }: { assets: RoomAssets; initial: Avatar; onSave: (a: Avatar) => void; onClose: () => void }) {
  const [avatar, setAvatar] = useState(initial);
  return (
    <Sheet title="옷장" onClose={onClose}>
      <div className="avatar-stage avatar-stage--small">
        <AvatarPreview assets={assets} avatar={avatar} />
      </div>
      <LookPickers avatar={avatar} onChange={setAvatar} titleClassName="sub-title" />
      <h2 className="sub-title">티셔츠 색</h2>
      <div className="swatches">
        {AVATAR_COLORS.map((c) => (
          <button key={c} className={`swatch${avatar.color === c ? ' swatch--on' : ''}`} style={{ background: tokens.avatar[c] }} aria-label={c} onClick={() => setAvatar({ ...avatar, color: c })} />
        ))}
      </div>
      <div className="chips">
        {ACCESSORIES.map((a) => (
          <button key={a.id} className={`chip${avatar.accessory === a.id ? ' chip--on' : ''}`} onClick={() => setAvatar({ ...avatar, accessory: a.id })}>
            {a.label}
          </button>
        ))}
      </div>
      <button className="btn-primary" onClick={() => onSave(avatar)}>이렇게 입을래요</button>
    </Sheet>
  );
}

function FramePicker({ current, onPick, onClose, onError }: {
  current: string | null;
  onPick: (id: string | null) => void;
  onClose: () => void;
  onError: (m: string) => void;
}) {
  const [photos, setPhotos] = useState<{ id: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => call<{ photos: { id: string }[] }>('GET', '/api/photos').then((r) => setPhotos(r.photos)).catch(() => setPhotos([])), []);
  useEffect(() => {
    load();
  }, [load]);

  async function upload(file: File) {
    setBusy(true);
    try {
      const { blob, width, height } = await shrinkImage(file, recordConfig.photoMaxSide);
      const res = await fetch(`/api/photos?w=${width}&h=${height}`, { method: 'POST', body: blob, headers: { 'content-type': 'image/jpeg' } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? '사진을 올리지 못했어요');
      onPick(data.id);
    } catch (e) {
      onError(e instanceof Error ? e.message : '사진을 올리지 못했어요');
    } finally {
      setBusy(false);
    }
  }

  const grid = useMemo(() => photos ?? [], [photos]);
  return (
    <Sheet title="사진 액자" onClose={onClose}>
      <p className="muted">액자에 건 사진은 내 방을 볼 수 있는 사람에게 보여요.</p>
      <label className="btn-secondary upload-btn">
        <Icon name="photo" size={18} /> {busy ? '올리는 중…' : '새 사진 올리기'}
        <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
      <div className="album">
        {grid.map((p) => (
          <button key={p.id} className={`album__item${current === p.id ? ' album__item--on' : ''}`} onClick={() => onPick(p.id)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- 권한 검사가 필요한 사진 */}
            <img src={photoUrl(p.id)} alt="" loading="lazy" />
          </button>
        ))}
      </div>
      {current && <button className="link-btn" onClick={() => onPick(null)}>액자 비우기</button>}
    </Sheet>
  );
}
