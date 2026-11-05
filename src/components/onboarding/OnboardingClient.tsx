'use client';

// 첫 가입 2~7단계 (1단계 "세계에 입장"은 첫 화면). PROJECT_GUIDE.md 5장.
// 목표: 긴 설명보다 짧은 시간에 "내 공간이 생겼다"는 만족감.
// 사는 마을 = 내 MBTI 유형 마을. 알면 16개 중에서 고르고, 모르면 12문항 간단 테스트로 정한다.
// 예전에 MBTI 없이 가입한 주민도 여기서 MBTI만 정하고 그 마을로 이사한다.
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { socialConfig } from '@/config/game';
import type { MbtiType } from '@/design/mbti';
import { tokens } from '@/design/tokens';
import { ACCESSORIES, AVATAR_COLORS, DEFAULT_AVATAR, type Avatar } from '@/shared/avatar';
import { BGM_TRACKS, bgmForDistrict } from '@/shared/bgm';
import { DEFAULT_DISTRICT, DISTRICT } from '@/shared/districts';
import { FLOORS, STARTER_ROOMS, WALLPAPERS, starterLayout, type FloorId, type WallpaperId } from '@/shared/room';
import { call, errorMessage } from '@/lib/api';
import { BgmPlayer } from '../app/BgmPlayer';
import { Guide } from '../app/Guide';
import { ResidentCard } from '../app/ResidentCard';
import { Icon } from '../app/Icon';
import type { MyProfile } from '@/server/scene/service';
import { useMe } from '../app/useMe';
import { loadRoomAssets, type RoomAssets } from '../room/assets';
import { MbtiPicker, VillageCard } from './MbtiPicker';

const RoomScene = dynamic(() => import('../room/RoomScene'), { ssr: false });
const AvatarPreview = dynamic(() => import('../room/AvatarPreview'), { ssr: false });

const STEPS = ['나의 MBTI', '나의 마을', '캐릭터', '첫 집', 'BGM', '완성'] as const;

export function OnboardingClient() {
  const router = useRouter();
  const { me } = useMe({ require: 'login' });
  const [step, setStep] = useState(0);
  const [mbti, setMbti] = useState<MbtiType | ''>('');
  const [testing, setTesting] = useState(false);
  const [avatar, setAvatar] = useState<Avatar>(DEFAULT_AVATAR);
  const [starter, setStarter] = useState<string>(STARTER_ROOMS[0].id);
  const [wallpaper, setWallpaper] = useState<WallpaperId>(STARTER_ROOMS[0].layout.wallpaper);
  const [floor, setFloor] = useState<FloorId>(STARTER_ROOMS[0].layout.floor);
  const [bgm, setBgm] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [hobby, setHobby] = useState('');
  /** 가입을 마치면 나오는 주민증 */
  const [issued, setIssued] = useState<MyProfile | null>(null);
  const [assets, setAssets] = useState<RoomAssets | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const chosenDistrict = mbti || DEFAULT_DISTRICT;
  /** 예전에 MBTI 없이 가입한 주민: MBTI만 정하면 그 마을로 이사한다 */
  const resident = !!me?.profile?.onboarded;

  useEffect(() => {
    if (me?.profile?.onboarded && me.profile.mbti && !issued) router.replace('/village');
  }, [me, router, issued]);

  // 3D 모델은 캐릭터 단계 전에 미리 받아 둔다
  useEffect(() => {
    if (step >= 1) loadRoomAssets().then(setAssets).catch(() => setError('방을 불러오지 못했어요. 새로고침해 주세요.'));
  }, [step]);

  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start' });
    setError(null);
  }, [step]);

  const layout = useMemo(() => starterLayout(starter, wallpaper, floor), [starter, wallpaper, floor]);
  const recommendedBgm = bgmForDistrict(chosenDistrict).key;

  /** 예전 주민: MBTI를 정하고 그 마을의 빈 집터로 이사한 뒤 마을로 */
  async function moveIn() {
    if (!mbti) return;
    setBusy(true);
    setError(null);
    try {
      await call<MyProfile>('POST', '/api/me', { mbti });
      router.replace('/village?welcome=1');
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const done = await call<MyProfile>('POST', '/api/onboarding', {
        mbti,
        avatar,
        starter,
        wallpaper,
        floor,
        bgm: bgm ?? recommendedBgm,
        displayName: name,
        bio,
        hobby,
      });
      // MBTI 마을에 집이 생겼다: 주민증이 나온다. 그다음 마을의 내 집 문 앞으로 간다
      setIssued(done);
      setBusy(false);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  if (!me) return <main className="page page--center"><div className="loader" aria-hidden /></main>;

  return (
    <main className="onboarding" ref={top}>
      <header className="onboarding__head">
        <button className="back-link" onClick={back} disabled={step === 0} aria-label="이전 단계">
          <Icon name="back" size={18} /> 이전
        </button>
        <span className="onboarding__step">{step + 2} / 7 · {STEPS[step]}</span>
        <div className="progress" aria-hidden>
          <span style={{ width: `${((step + 2) / 7) * 100}%` }} />
        </div>
      </header>

      {step === 0 && (
        <section className="onboarding__body">
          <Guide>
            {resident
              ? '마을이 MBTI 16개 마을로 새로 바뀌었어요! 내 MBTI를 고르면 그 마을로 이사해요.'
              : 'MBTI 유형마다 마을이 있어요. 내 MBTI를 고르면 그 마을에 내 집이 생겨요.'}
          </Guide>
          <MbtiPicker value={mbti} onChange={setMbti} onTesting={setTesting} />
          <button className="btn-primary" onClick={next} disabled={!mbti || testing}>
            다음
          </button>
        </section>
      )}

      {step === 1 && mbti && (
        <section className="onboarding__body">
          <Guide>{DISTRICT[mbti].name} 주민이 될 거예요! 그 마을 빈 집터에 {resident ? '집을 옮겨' : '첫 집을 지어'} 줄게요.</Guide>
          <VillageCard type={mbti} />
          <p className="muted">
            가입한 뒤에도 MY에서 MBTI를 바꾸면 그 마을로 이사해요. 처음 한 번은 바로 바꿀 수 있고, 그 뒤로는 일주일에 한 번이에요.
          </p>
          {resident ? (
            <button className="btn-primary" onClick={moveIn} disabled={busy}>
              {busy ? '이사하는 중…' : `${DISTRICT[mbti].name}로 이사하기`}
            </button>
          ) : (
            <button className="btn-primary" onClick={next}>
              {DISTRICT[mbti].name}에 집 짓기
            </button>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="onboarding__body">
          <Guide>나를 닮은 캐릭터를 만들어 봐요. 나중에 옷장에서 언제든 바꿀 수 있어요.</Guide>
          <div className="avatar-stage">{assets ? <AvatarPreview assets={assets} avatar={avatar} /> : <div className="loader" aria-hidden />}</div>
          <h2 className="field-title">색</h2>
          <div className="swatches">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                className={`swatch${avatar.color === c ? ' swatch--on' : ''}`}
                style={{ background: tokens.avatar[c] }}
                aria-label={c}
                aria-pressed={avatar.color === c}
                onClick={() => setAvatar({ ...avatar, color: c })}
              />
            ))}
          </div>
          <h2 className="field-title">소품</h2>
          <div className="chips">
            {ACCESSORIES.map((a) => (
              <button key={a.id} className={`chip${avatar.accessory === a.id ? ' chip--on' : ''}`} aria-pressed={avatar.accessory === a.id} onClick={() => setAvatar({ ...avatar, accessory: a.id })}>
                {a.label}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={next}>다음</button>
        </section>
      )}

      {step === 3 && (
        <section className="onboarding__body">
          <Guide>첫 방이에요! 자세한 배치는 나의 방에서 마음껏 바꿀 수 있어요.</Guide>
          <div className="room-preview">
            {assets ? (
              <RoomScene assets={assets} layout={layout} district={chosenDistrict} avatar={avatar} mode="view" framing="overview" />
            ) : (
              <div className="loader" aria-hidden />
            )}
          </div>
          <div className="starter-list">
            {STARTER_ROOMS.map((s) => (
              <button
                key={s.id}
                className={`starter${starter === s.id ? ' starter--on' : ''}`}
                aria-pressed={starter === s.id}
                onClick={() => {
                  setStarter(s.id);
                  setWallpaper(s.layout.wallpaper);
                  setFloor(s.layout.floor);
                }}
              >
                <b>{s.name}</b>
                <span>{s.description}</span>
              </button>
            ))}
          </div>
          <h2 className="field-title">벽지</h2>
          <div className="swatches">
            {WALLPAPERS.map((w) => (
              <button key={w.id} className={`swatch swatch--square${wallpaper === w.id ? ' swatch--on' : ''}`} style={{ background: tokens.room.wall[w.id] }} aria-label={w.label} title={w.label} aria-pressed={wallpaper === w.id} onClick={() => setWallpaper(w.id)} />
            ))}
          </div>
          <h2 className="field-title">바닥</h2>
          <div className="swatches">
            {FLOORS.map((f) => (
              <button key={f.id} className={`swatch swatch--square${floor === f.id ? ' swatch--on' : ''}`} style={{ background: tokens.room.floor[f.id] }} aria-label={f.label} title={f.label} aria-pressed={floor === f.id} onClick={() => setFloor(f.id)} />
            ))}
          </div>
          <button className="btn-primary" onClick={next}>이 방으로 할게요</button>
        </section>
      )}

      {step === 4 && (
        <section className="onboarding__body">
          <Guide>방에 들어오는 사람이 처음 듣게 될 음악이에요. 눌러서 들어 보고 골라 주세요.</Guide>
          <div className="track-list">
            {BGM_TRACKS.map((t) => {
              const on = (bgm ?? recommendedBgm) === t.key;
              return (
                <div key={t.key} className={`track${on ? ' track--on' : ''}`}>
                  <button className="track__pick" onClick={() => setBgm(t.key)} aria-pressed={on}>
                    <span className="track__radio" aria-hidden />
                    <b>{t.title}</b>
                    {t.key === recommendedBgm && <span className="track__badge">추천</span>}
                  </button>
                  <BgmPlayer trackKey={t.key} compact />
                </div>
              );
            })}
          </div>
          <p className="muted">지금은 권리 걱정 없는 오리지널 임시 곡이에요. 자동으로 재생되지 않아요.</p>
          <button className="btn-primary" onClick={next}>다음</button>
        </section>
      )}

      {issued?.district && issued.joinedAt && (
        <section className="onboarding__body">
          <Guide>주민증이 나왔어요! 이제 {DISTRICT[issued.district].name} 주민이에요. 친구에게 자랑하고 마을로 가 볼까요?</Guide>
          <ResidentCard
            info={{
              name: issued.displayName,
              district: issued.district,
              hood: issued.houseHood,
              joinedAt: issued.joinedAt,
              mbti: issued.mbti,
              hobby: issued.hobby,
              avatarColor: issued.avatar.color,
              handle: issued.handle,
            }}
          />
          <button className="btn-primary" onClick={() => router.replace('/village?welcome=1')}>
            마을로 가기
          </button>
        </section>
      )}
      {!issued && step === 5 && (
        <section className="onboarding__body">
          <Guide>마지막이에요! 마을에서 보일 이름과 한 줄 소개를 적으면 내 집이 생겨요.</Guide>
          <label className="field">
            <span>마을에서 보일 이름</span>
            <input value={name} maxLength={socialConfig.displayNameMax} onChange={(e) => setName(e.target.value)} placeholder="방과 이름표에 보일 이름" />
            <small className="muted">다른 주민에게 보여요. 실명이 싫으면 별명으로 바꿔도 돼요.</small>
          </label>
          <label className="field">
            <span>취미 (선택, 주민증에 보여요)</span>
            <input value={hobby} maxLength={socialConfig.hobbyMax} onChange={(e) => setHobby(e.target.value)} placeholder="예: 비 오는 날 산책, 필름 카메라" />
          </label>
          <label className="field">
            <span>프로필 문구 (선택)</span>
            <input value={bio} maxLength={socialConfig.bioMax} onChange={(e) => setBio(e.target.value)} placeholder="예: 비 오는 날 듣는 노래를 모아요" />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="btn-primary" onClick={finish} disabled={busy || !name.trim()}>
            {busy ? '방을 여는 중…' : '나의 방에 들어가기'}
          </button>
        </section>
      )}
      {error && step !== 5 && <p className="form-error">{error}</p>}
    </main>
  );
}
