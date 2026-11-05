'use client';

// 내 캐릭터 (아래 탭): 피부색·머리 색·티셔츠 색과 소품을 무료로 고른다. 성별은 가입할 때 정해서 바꿀 수 없다
// (성별을 정하지 않은 예전 계정만 여기서 한 번 정한다).
// 옷·머리 소품·등·효과는 꾸미기 상점에서 팔 예정 (준비 중).
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { tokens } from '@/design/tokens';
import { call, errorMessage } from '@/lib/api';
import { ACCESSORIES, AVATAR_BODIES, AVATAR_COLORS, type Avatar } from '@/shared/avatar';
import { COSMETIC_SLOTS, UPCOMING_COSMETICS, type CosmeticSlot } from '@/shared/cosmetics';
import { Icon } from '../app/Icon';
import { LookPickers } from '../app/LookPickers';
import { TabBar } from '../app/TabBar';
import { useMe } from '../app/useMe';
import { loadRoomAssets, type RoomAssets } from '../room/assets';

const AvatarPreview = dynamic(() => import('../room/AvatarPreview'), { ssr: false });

/** embedded: 마을·방 위에 창으로 열 때 (아래 탭은 그 화면의 것을 쓴다) */
export function CharacterClient({ embedded = false }: { embedded?: boolean } = {}) {
  const { me, setMe } = useMe({ require: 'onboarded' });
  const [assets, setAssets] = useState<RoomAssets | null>(null);
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    loadRoomAssets().then(setAssets).catch(() => setNote('캐릭터를 불러오지 못했어요.'));
  }, []);
  useEffect(() => {
    if (me?.profile && !avatar) setAvatar(me.profile.avatar);
  }, [me, avatar]);

  const saved = me?.profile?.avatar;
  /** 성별을 아직 정하지 않은 예전 계정: 저장할 때 고른 성별로 정한다 (한 번만) */
  const pickBody = !!saved && !saved.bodyFixed;
  const changed = !!(avatar && saved && (pickBody || (['color', 'skin', 'hair', 'accessory'] as const).some((k) => avatar[k] !== saved[k])));
  async function save() {
    if (!avatar || !me?.profile) return;
    setBusy(true);
    try {
      const profile = await call<NonNullable<typeof me.profile>>('PATCH', '/api/me', { avatar, ...(pickBody ? { body: avatar.body } : {}) });
      setAvatar(profile.avatar);
      setMe({ ...me, profile });
      setNote('저장했어요. 마을에서도 이 모습으로 보여요.');
    } catch (e) {
      setNote(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page page--tabs character">
      <header className="page__head">
        <h1>내 캐릭터</h1>
      </header>
      <div className="avatar-stage">{assets && avatar ? <AvatarPreview assets={assets} avatar={avatar} /> : <div className="loader" aria-hidden />}</div>
      {avatar && (
        <section className="section card">
          {pickBody && (
            <>
              <h2 className="section-title">
                성별 <small>한 번만 정할 수 있어요</small>
              </h2>
              <div className="chips">
                {AVATAR_BODIES.map((b) => (
                  <button key={b.id} className={`chip${avatar.body === b.id ? ' chip--on' : ''}`} aria-pressed={avatar.body === b.id} onClick={() => setAvatar({ ...avatar, body: b.id })}>
                    {b.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <LookPickers avatar={avatar} onChange={setAvatar} titleClassName="section-title" />
          <h2 className="section-title">티셔츠 색</h2>
          <div className="swatches">
            {AVATAR_COLORS.map((c) => (
              <button key={c} className={`swatch${avatar.color === c ? ' swatch--on' : ''}`} style={{ background: tokens.avatar[c] }} aria-label={c} aria-pressed={avatar.color === c} onClick={() => setAvatar({ ...avatar, color: c })} />
            ))}
          </div>
          <h2 className="section-title">소품</h2>
          <div className="chips">
            {ACCESSORIES.map((a) => (
              <button key={a.id} className={`chip${avatar.accessory === a.id ? ' chip--on' : ''}`} aria-pressed={avatar.accessory === a.id} onClick={() => setAvatar({ ...avatar, accessory: a.id })}>
                {a.label}
              </button>
            ))}
          </div>
          <button className="btn-primary" disabled={busy || !changed} onClick={() => void save()}>
            이렇게 입을래요
          </button>
          {note && (
            <p className="notice" role="status">
              {note}
            </p>
          )}
        </section>
      )}
      <section className="section card">
        <h2 className="section-title">
          꾸미기 상점 <small>곧 열려요</small>
        </h2>
        {(Object.keys(COSMETIC_SLOTS) as CosmeticSlot[]).map((slot) => (
          <div key={slot} className="cosmetics">
            <h3 className="sub-title">{COSMETIC_SLOTS[slot]}</h3>
            <ul className="cosmetics__grid">
              {UPCOMING_COSMETICS.filter((c) => c.slot === slot).map((c) => (
                <li key={c.id} className="cosmetics__item">
                  <Icon name="lock" size={18} />
                  <span>{c.name}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      {!embedded && <TabBar />}
    </main>
  );
}
