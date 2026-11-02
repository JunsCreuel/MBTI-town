'use client';

// 첫 가입 2~7단계 (1단계 "세계에 입장"은 첫 화면). PROJECT_GUIDE.md 5장.
// 목표: 긴 설명보다 짧은 시간에 "내 공간이 생겼다"는 만족감.
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { assetUrl } from '@/assets/manifest';
import { socialConfig } from '@/config/game';
import { MBTI_TYPES, type MbtiType } from '@/design/mbti';
import { tokens } from '@/design/tokens';
import { ACCESSORIES, AVATAR_COLORS, DEFAULT_AVATAR, type Avatar } from '@/shared/avatar';
import { BGM_TRACKS, bgmForDistrict } from '@/shared/bgm';
import {
  DISTRICT, DISTRICTS, TASTE_COLORS, TASTE_MOODS, TASTE_MUSIC, recommendDistrict,
  type District, type Taste, type TasteOption,
} from '@/shared/districts';
import { FLOORS, STARTER_ROOMS, WALLPAPERS, starterLayout, type FloorId, type WallpaperId } from '@/shared/room';
import { call, errorMessage } from '@/lib/api';
import { BgmPlayer } from '../app/BgmPlayer';
import { Guide } from '../app/Guide';
import { Icon } from '../app/Icon';
import { useMe } from '../app/useMe';
import { loadRoomAssets, type RoomAssets } from '../room/assets';

const RoomScene = dynamic(() => import('../room/RoomScene'), { ssr: false });
const AvatarPreview = dynamic(() => import('../room/AvatarPreview'), { ssr: false });

const STEPS = ['취향', '거주지', '캐릭터', '첫 집', 'BGM', '완성'] as const;

function Chips({ options, value, onChange, swatch }: {
  options: readonly TasteOption[];
  value: string[];
  onChange: (v: string[]) => void;
  swatch?: boolean;
}) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            key={o.id}
            className={`chip${on ? ' chip--on' : ''}`}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}
          >
            {swatch && <span className="chip__swatch" style={{ background: (tokens.taste as Record<string, string>)[o.id] }} aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function OnboardingClient() {
  const router = useRouter();
  const { me } = useMe({ require: 'login' });
  const [step, setStep] = useState(0);
  const [taste, setTaste] = useState<Taste>({ colors: [], moods: [], music: [] });
  const [mbti, setMbti] = useState<MbtiType | ''>('');
  const [birthDate, setBirthDate] = useState('');
  const [district, setDistrict] = useState<District | null>(null);
  const [avatar, setAvatar] = useState<Avatar>(DEFAULT_AVATAR);
  const [starter, setStarter] = useState<string>(STARTER_ROOMS[0].id);
  const [wallpaper, setWallpaper] = useState<WallpaperId>(STARTER_ROOMS[0].layout.wallpaper);
  const [floor, setFloor] = useState<FloorId>(STARTER_ROOMS[0].layout.floor);
  const [bgm, setBgm] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [assets, setAssets] = useState<RoomAssets | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const rec = useMemo(() => recommendDistrict(taste, birthDate || null), [taste, birthDate]);
  const chosenDistrict = district ?? rec.district;

  useEffect(() => {
    if (me?.profile?.onboarded) router.replace('/village');
  }, [me, router]);

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

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      await call('POST', '/api/onboarding', {
        taste,
        mbti: mbti || undefined,
        birthDate: birthDate || undefined,
        district: chosenDistrict,
        avatar,
        starter,
        wallpaper,
        floor,
        bgm: bgm ?? recommendedBgm,
        displayName: name,
        bio,
      });
      // 첫 화면은 마을의 내 집 문 앞이다
      router.replace('/village?welcome=1');
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
          <Guide>어떤 분위기를 좋아해요? 고른 취향으로 첫 동네를 추천해 줄게요.</Guide>
          <h2 className="field-title">좋아하는 색</h2>
          <Chips options={TASTE_COLORS} value={taste.colors} onChange={(colors) => setTaste({ ...taste, colors })} swatch />
          <h2 className="field-title">좋아하는 분위기</h2>
          <Chips options={TASTE_MOODS} value={taste.moods} onChange={(moods) => setTaste({ ...taste, moods })} />
          <h2 className="field-title">자주 듣는 음악</h2>
          <Chips options={TASTE_MUSIC} value={taste.music} onChange={(music) => setTaste({ ...taste, music })} />
          <details className="optional">
            <summary>MBTI · 생년월일 (선택)</summary>
            <p className="muted">재미로 보는 추천에만 써요. 성격이나 운명을 정하는 근거가 아니에요. 출생시간은 묻지 않아요.</p>
            <label className="field">
              <span>MBTI</span>
              <select value={mbti} onChange={(e) => setMbti(e.target.value as MbtiType | '')}>
                <option value="">입력하지 않기</option>
                {MBTI_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>생년월일</span>
              <input type="date" value={birthDate} max={new Date().toISOString().slice(0, 10)} min="1900-01-01" onChange={(e) => setBirthDate(e.target.value)} />
            </label>
            {mbti && <p className="muted">MBTI를 넣으면 중앙광장의 &lsquo;오늘의 토론&rsquo; 이벤트에도 참여할 수 있어요.</p>}
          </details>
          <button className="btn-primary" onClick={next}>다음</button>
        </section>
      )}

      {step === 1 && (
        <section className="onboarding__body">
          <Guide>
            {DISTRICT[rec.district].name}가 잘 어울릴 것 같아요! 다른 곳이 좋으면 골라도 돼요. 언제든 이사할 수 있어요.
          </Guide>
          <div className="district-list">
            {DISTRICTS.map((d) => {
              const meta = DISTRICT[d];
              const on = chosenDistrict === d;
              return (
                <button
                  key={d}
                  className={`district-card${on ? ' district-card--on' : ''}`}
                  style={{ '--district': tokens.district[d] } as CSSProperties}
                  aria-pressed={on}
                  onClick={() => setDistrict(d)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- 작은 풍경 그림 */}
                  <img src={assetUrl(`room.view.${d}`)} alt="" width={64} height={64} />
                  <span className="district-card__text">
                    <span className="district-card__name">
                      {meta.name} <small>{meta.element}</small>
                    </span>
                    <span className="district-card__mood">{meta.mood}</span>
                  </span>
                  {d === rec.district && <span className="badge-rec">추천</span>}
                </button>
              );
            })}
          </div>
          {rec.reasons.length > 0 && <p className="muted">추천 이유: {rec.reasons.slice(0, 4).join(', ')}</p>}
          <p className="muted">재미로 보는 추천이에요. 지역은 창밖 풍경과 마을 지도에만 쓰고, 생활을 제한하지 않아요.</p>
          <button className="btn-primary" onClick={next}>{DISTRICT[chosenDistrict].name}에 살래요</button>
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
              <RoomScene assets={assets} layout={layout} district={chosenDistrict} avatar={avatar} mode="view" />
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
                    <span>
                      <b>{t.title}</b>
                      <small>{t.mood}{t.key === recommendedBgm ? ' · 추천' : ''}</small>
                    </span>
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

      {step === 5 && (
        <section className="onboarding__body">
          <Guide>마지막이에요! 이름과 한 줄 소개를 적으면 나의 방이 열려요.</Guide>
          <label className="field">
            <span>이름</span>
            <input value={name} maxLength={socialConfig.displayNameMax} onChange={(e) => setName(e.target.value)} placeholder="방에 보일 이름" />
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
