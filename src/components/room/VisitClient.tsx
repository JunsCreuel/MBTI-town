'use client';

// 다른 사람의 방 /r/[handle] (PROJECT_GUIDE.md 9장). 공개 범위·차단은 서버가 이미 걸러서 보낸다.
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { tokens } from '@/design/tokens';
import { ApiError, call, errorMessage } from '@/lib/api';
import type { RoomView } from '@/server/scene/service';
import { DEFAULT_AVATAR, petNameOf, profileTag, type Avatar } from '@/shared/avatar';
import { DEFAULT_DISTRICT, DISTRICT } from '@/shared/districts';
import type { FurnitureAction } from '@/shared/room';
import { RecordCard } from '../archive/RecordCard';
import { BgmPlayer, type BgmHandle } from '../app/BgmPlayer';
import { GesturePicker } from '../app/GesturePicker';
import { Guide } from '../app/Guide';
import { Icon } from '../app/Icon';
import { Sheet } from '../app/Sheet';
import { TabBar } from '../app/TabBar';
import { loadRoomAssets, type RoomAssets } from './assets';
import { Guestbook } from './Guestbook';
import { useHousePresence } from './useHousePresence';
import { useHudInsets } from './useHudInsets';

const RoomScene = dynamic(() => import('./RoomScene'), { ssr: false });

const VISIBILITY_NOTE = { friends: '이 방은 친구에게만 열려 있어요.', private: '이 방은 지금 주인만 볼 수 있어요.', public: '' };

export function VisitClient({ handle }: { handle: string }) {
  const router = useRouter();
  const [view, setView] = useState<RoomView | null>(null);
  const [missing, setMissing] = useState(false);
  const [assets, setAssets] = useState<RoomAssets | null>(null);
  const [ready, setReady] = useState(false);
  /** 보기: 1인칭(기본) 또는 방 전체를 위에서 */
  const [overview, setOverview] = useState(false);
  const [sheet, setSheet] = useState<'guestbook' | 'records' | 'more' | null>(null);
  const [playing, setPlaying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const player = useRef<BgmHandle>(null);

  const load = useCallback(async () => {
    try {
      const v = await call<RoomView>('GET', `/api/rooms/${handle}`);
      if (v.relation === 'self') return router.replace('/home');
      setView(v);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setMissing(true);
      else setToast(errorMessage(e));
    }
  }, [handle, router]);

  useEffect(() => {
    load();
    loadRoomAssets().then(setAssets).catch(() => setToast('방을 불러오지 못했어요.'));
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const onAction = useCallback((action: FurnitureAction) => {
    if (action === 'bgm') player.current?.toggle();
    else if (action === 'guestbook') setSheet('guestbook');
    else if (action === 'archive' || action === 'frame') setSheet('records');
  }, []);

  async function friend(action: 'request' | 'accept' | 'remove') {
    try {
      await call('POST', '/api/friends', { handle, action });
      await load();
      setToast(action === 'request' ? '친구 신청을 보냈어요' : action === 'accept' ? '이제 친구예요' : '친구를 끊었어요');
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.code === 'onboarding_required')) router.push(`/login?next=/r/${handle}`);
      else setToast(errorMessage(e));
    }
  }

  async function block() {
    if (!confirm('차단하면 서로의 방과 기록을 볼 수 없고, 친구도 끊겨요. 차단할까요?')) return;
    try {
      await call('POST', '/api/blocks', { handle, action: 'block' });
      router.replace('/explore');
    } catch (e) {
      setToast(errorMessage(e));
    }
  }

  async function report() {
    const reason = prompt('신고 이유를 적어 주세요 (선택). 운영자만 봐요.') ?? null;
    if (reason === null) return;
    await call('POST', '/api/reports', { kind: 'user', targetId: handle, reason }).catch(() => {});
    setSheet(null);
    setToast('신고했어요. 확인 후 조치할게요.');
  }

  // HUD 사이에 방이 오게 (HUD가 처음 그려지면 다시 잰다)
  const insets = useHudInsets(!!view, { top: 104, bottom: 250 });
  // 방을 볼 수 있으면 같은 방에 들어간다: 내 캐릭터로 걷고, 주인·다른 손님이 있으면 함께 보인다
  const { presence, snap: presenceSnap, others } = useHousePresence(view?.room ? handle : null);
  const pass = presenceSnap?.pass;
  const myAvatar: Avatar | null = pass
    ? { body: pass.body, color: pass.color, skin: pass.skin, hair: pass.hair, accessory: pass.acc, pet: '', petNames: {} }
    : presenceSnap?.status === 'denied'
      ? DEFAULT_AVATAR
      : null;

  if (missing) {
    return (
      <main className="page page--center">
        <Guide who="monnyang">방을 찾을 수 없어요. 주소가 바뀌었거나 볼 수 없는 방이에요.</Guide>
        <Link className="btn-secondary" href="/village">마을로 가기</Link>
        <TabBar stay />
      </main>
    );
  }

  if (!view) {
    return (
      <main className="room-page">
        <div className="overlay"><div className="loader" aria-hidden /></div>
      </main>
    );
  }

  const owner = view.owner;
  const district = owner.district ?? owner.mbti ?? DEFAULT_DISTRICT;

  return (
    <main className="room-page" style={{ '--district': tokens.district[district] } as CSSProperties}>
      <div className="room-page__stage">
        {view.room && assets && myAvatar && (
          <RoomScene
            assets={assets}
            layout={view.room.layout}
            district={district}
            avatar={myAvatar}
            selfName={pass?.name}
            selfTag={profileTag(pass?.mbti)}
            presence={presence}
            mode="view"
            framing={overview ? 'overview' : 'inside'}
            onAction={onAction}
            playing={playing}
            photoUrl={(id) => `/api/photos/${id}`}
            petName={petNameOf(owner.avatar, 'dog')}
            insetTop={insets.top}
            insetBottom={insets.bottom}
            onReady={() => setReady(true)}
          />
        )}
      </div>
      {view.room && (
        <div className={`room-enter${ready ? ' room-enter--done' : ''}`} aria-hidden={ready}>
          <div className="loader" aria-hidden />
          <p className="room-enter__text">{owner.displayName}의 방에 들어가는 중…</p>
        </div>
      )}
      {!view.room && (
        <div className="room-locked">
          <Guide who="monnyang">{VISIBILITY_NOTE[view.roomVisibility] || '이 방은 지금 볼 수 없어요.'}</Guide>
        </div>
      )}

      <header className="room-top" data-hud="top">
        <div className="owner-card">
          <span className="owner-card__dot" style={{ background: tokens.avatar[owner.avatar.color] }} aria-hidden />
          <div className="owner-card__text">
            <strong>{owner.displayName}의 방</strong>
            <span>{others > 0 ? `지금 ${others + 1}명이 함께 있어요` : owner.bio || `@${owner.handle}`}</span>
          </div>
          <span className="district-chip">{DISTRICT[district].name}</span>
        </div>
        <div className="room-top__actions">
          <button className={`icon-btn${overview ? ' icon-btn--accent' : ''}`} aria-label={overview ? '눈높이로 보기' : '방 전체 보기'} aria-pressed={overview} onClick={() => setOverview((o) => !o)}>
            <Icon name="map" size={20} />
          </button>
          {/* 문을 나서면 이 집이 있는 마을로 돌아간다 */}
          <Link className="icon-btn" href={`/village?at=${district}`} aria-label="마을로 나가기">
            <Icon name="exit" size={20} />
          </Link>
          {view.friend === 'none' && (
            <button className="pill-btn" onClick={() => friend('request')}>
              <Icon name="plus" size={16} /> 친구 신청
            </button>
          )}
          {view.friend === 'sent' && <span className="pill-btn pill-btn--muted">신청함</span>}
          {view.friend === 'received' && (
            <button className="pill-btn" onClick={() => friend('accept')}>
              <Icon name="check" size={16} /> 친구 수락
            </button>
          )}
          {view.friend === 'friends' && <span className="pill-btn pill-btn--muted"><Icon name="friends" size={16} /> 친구</span>}
          <button className="icon-btn" aria-label="더 보기" onClick={() => setSheet('more')}>
            <Icon name="flag" size={18} />
          </button>
        </div>
      </header>

      <div className="room-bottom" data-hud="bottom">
        {presence && (
          <GesturePicker variant="button" onAction={(k) => presence.sendAction(k)} onEmote={(k) => presence.sendEmote(k)} />
        )}
        {view.room && <BgmPlayer ref={player} trackKey={view.room.bgm} onPlayingChange={setPlaying} />}
        <div className="quick-actions">
          <button className="quick" onClick={() => setSheet('guestbook')} disabled={!view.room}>
            <Icon name="mail" size={20} />
            방명록 {view.guestbook.length ? view.guestbook.length : ''}
          </button>
          <button className="quick" onClick={() => setSheet('records')} disabled={!view.room}>
            <Icon name="archive" size={20} />
            기록
          </button>
          <button
            className="quick"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                setToast('방 주소를 복사했어요');
              } catch {}
            }}
          >
            <Icon name="share" size={20} />
            주소 복사
          </button>
        </div>
      </div>
      <TabBar stay />

      {sheet === 'guestbook' && (
        <Sheet title={`${owner.displayName}의 방명록`} onClose={() => setSheet(null)}>
          {!view.canWriteGuestbook && (
            <p className="muted">
              방명록은 로그인하고 나의 방을 만든 뒤에 쓸 수 있어요. <Link href={`/login?next=/r/${handle}`}>로그인</Link>
            </p>
          )}
          <Guestbook handle={handle} entries={view.guestbook} canWrite={view.canWriteGuestbook} isOwner={false} onChange={load} />
        </Sheet>
      )}
      {sheet === 'records' && (
        <Sheet title={`${owner.displayName}의 기록`} onClose={() => setSheet(null)}>
          {view.records.length ? (
            <div className="records">{view.records.map((r) => <RecordCard key={r.id} record={r} />)}</div>
          ) : (
            <p className="empty">공개된 기록이 없어요.</p>
          )}
        </Sheet>
      )}
      {sheet === 'more' && (
        <Sheet title="더 보기" onClose={() => setSheet(null)}>
          <div className="menu">
            {view.friend === 'friends' && (
              <button className="menu__item" onClick={() => friend('remove')}><Icon name="friends" size={18} /> 친구 끊기</button>
            )}
            {view.friend === 'sent' && (
              <button className="menu__item" onClick={() => friend('remove')}><Icon name="close" size={18} /> 친구 신청 취소</button>
            )}
            <button className="menu__item" onClick={report}><Icon name="flag" size={18} /> 신고하기</button>
            <button className="menu__item menu__item--danger" onClick={block}><Icon name="block" size={18} /> 차단하기</button>
          </div>
        </Sheet>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
