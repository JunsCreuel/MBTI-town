'use client';

// MY: 설정 (PROJECT_GUIDE.md 4, 9, 11장). 프로필, 나의 사주(생일 고치기 → 사는 동네 다시 정하기), 공개 범위, 친구·차단, 기록 내보내기·삭제.
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { socialConfig } from '@/config/game';
import { MBTI_TYPES } from '@/design/mbti';
import { tokens } from '@/design/tokens';
import { call, errorMessage } from '@/lib/api';
import type { MyProfile, PlayState, RoomCard } from '@/server/scene/service';
import { DISTRICT } from '@/shared/districts';
import type { SajuReading } from '@/shared/saju';
import { VISIBILITY_LABEL, type Visibility } from '@/shared/records';
import { ResidentCard } from '../app/ResidentCard';
import { InventorySheet, ItemIcon } from '../app/Inventory';
import { FISH, FORTUNE_FRUIT, FRUITS } from '@/shared/play';
import { DISTRICTS } from '@/shared/districts';
import { Icon } from '../app/Icon';
import { TabBar } from '../app/TabBar';
import { useMe } from '../app/useMe';
import { BirthForm, birthFromDraft, draftFromBirth, type BirthDraft } from '../saju/BirthForm';
import { SajuCard } from '../saju/SajuCard';

interface Friends {
  friends: RoomCard[];
  received: RoomCard[];
  sent: RoomCard[];
}

function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub: string }) {
  return (
    <label className="toggle">
      <span className="toggle__text">
        <b>{label}</b>
        <small>{sub}</small>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__ui" aria-hidden />
    </label>
  );
}

export function MyClient() {
  const { me, reload } = useMe({ require: 'onboarded' });
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [hobby, setHobby] = useState('');
  const [handle, setHandle] = useState('');
  const [friends, setFriends] = useState<Friends | null>(null);
  const [blocked, setBlocked] = useState<{ handle: string; displayName: string }[]>([]);
  const [friendHandle, setFriendHandle] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [play, setPlay] = useState<PlayState | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  /** 생일 고치기: 고친 값과 미리 본 사주 */
  const [birthEdit, setBirthEdit] = useState<BirthDraft | null>(null);
  const [birthPreview, setBirthPreview] = useState<SajuReading | null>(null);

  useEffect(() => {
    if (!me?.profile) return;
    setProfile(me.profile);
    setName(me.profile.displayName);
    setBio(me.profile.bio);
    setHobby(me.profile.hobby);
    setHandle(me.profile.handle);
  }, [me]);

  const loadSocial = useCallback(() => {
    call<Friends>('GET', '/api/friends').then(setFriends).catch(() => {});
    call<{ blocked: { handle: string; displayName: string }[] }>('GET', '/api/blocks').then((r) => setBlocked(r.blocked)).catch(() => {});
  }, []);

  useEffect(() => {
    if (me) loadSocial();
  }, [me, loadSocial]);

  // 가방: 집이 있는 주민만 (놀거리 기록)
  useEffect(() => {
    if (me?.profile?.district) call<PlayState>('GET', '/api/play').then(setPlay).catch(() => {});
  }, [me]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  async function patch(body: Record<string, unknown>, done = '저장했어요') {
    try {
      setProfile(await call<MyProfile>('PATCH', '/api/me', body));
      setToast(done);
    } catch (e) {
      setToast(errorMessage(e));
    }
  }

  async function previewBirth() {
    const b = birthEdit && birthFromDraft(birthEdit);
    if (!b) return;
    try {
      setBirthPreview(await call<SajuReading>('POST', '/api/saju', b));
    } catch (e) {
      setToast(errorMessage(e));
    }
  }

  async function saveBirth() {
    const b = birthEdit && birthFromDraft(birthEdit);
    if (!b || !birthPreview || !profile) return;
    const moving = birthPreview.district !== profile.district;
    const to = `${DISTRICT[birthPreview.district].short} 지역`;
    if (moving && !confirm(`사주가 바뀌어 ${to}으로 이사해요. 집이 그 지역의 빈 집터로 옮겨져요. 저장할까요?`)) return;
    await patch({ birth: b }, moving ? `${to}으로 이사했어요` : '생일 정보를 고쳤어요');
    setBirthEdit(null);
    setBirthPreview(null);
  }

  async function friendAction(h: string, action: 'request' | 'accept' | 'remove') {
    try {
      await call('POST', '/api/friends', { handle: h, action });
      loadSocial();
      if (action === 'request') {
        setFriendHandle('');
        setToast('친구 신청을 보냈어요');
      }
    } catch (e) {
      setToast(errorMessage(e));
    }
  }

  async function setMbti(mbti: string) {
    try {
      await call('POST', '/api/me', { mbti });
      await reload();
      setToast('MBTI를 저장했어요');
    } catch (e) {
      setToast(errorMessage(e));
    }
  }

  async function deleteArchive() {
    if (!confirm('기록과 사진을 모두 지울까요? 되돌릴 수 없어요.')) return;
    if (!confirm('정말 모두 지울까요?')) return;
    try {
      await call('DELETE', '/api/me/archive');
      setToast('기록과 사진을 모두 지웠어요');
    } catch (e) {
      setToast(errorMessage(e));
    }
  }

  if (!me || !profile) return <main className="page page--center"><div className="loader" aria-hidden /></main>;

  const changeable = me.mbtiChangeableAt && new Date(me.mbtiChangeableAt) > new Date() ? new Date(me.mbtiChangeableAt) : null;

  return (
    <main className="page page--tabs">
      <header className="page__head">
        <h1>MY</h1>
      </header>

      {profile.district && profile.joinedAt && (
        <section className="section card" id="resident">
          <h2 className="section-title">내 주민증</h2>
          <ResidentCard
            info={{
              name: profile.displayName,
              district: profile.district,
              hood: profile.houseHood,
              joinedAt: profile.joinedAt,
              mbti: profile.mbti,
              hobby: profile.hobby,
              avatarColor: profile.avatar.color,
              handle: profile.handle,
            }}
          />
          <p className="muted">닉네임·취미·MBTI를 고치면 주민증도 바뀌어요.</p>
        </section>
      )}

      {profile.district && (
        <section className="section card" id="bag">
          <h2 className="section-title">가방</h2>
          <BagPreview play={play} />
          <button className="btn-secondary" onClick={() => setBagOpen(true)}>
            가방 열기 (열매·물고기 도감)
          </button>
        </section>
      )}
      {bagOpen && <InventorySheet state={play} onClose={() => setBagOpen(false)} />}

      <section className="section card">
        <h2 className="section-title">프로필</h2>
        <label className="field">
          <span>이름</span>
          <input value={name} maxLength={socialConfig.displayNameMax} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>프로필 문구</span>
          <input value={bio} maxLength={socialConfig.bioMax} onChange={(e) => setBio(e.target.value)} />
        </label>
        <label className="field">
          <span>취미 (주민증에 보여요)</span>
          <input value={hobby} maxLength={socialConfig.hobbyMax} onChange={(e) => setHobby(e.target.value)} placeholder="예: 비 오는 날 산책, 필름 카메라" />
        </label>
        <label className="field">
          <span>방 주소</span>
          <div className="field__prefix">
            <span>/r/</span>
            <input value={handle} maxLength={20} onChange={(e) => setHandle(e.target.value.toLowerCase())} />
          </div>
          <small className="muted">영문 소문자·숫자·밑줄 3~20자</small>
        </label>
        <button className="btn-primary" onClick={() => patch({ displayName: name, bio, hobby, handle })}>프로필 저장</button>
      </section>

      <section className="section card">
        <h2 className="section-title">나의 사주와 동네</h2>
        {profile.district && profile.houseLot !== null && (
          <p>
            내 집: <b>{DISTRICT[profile.district].short} {profile.houseHood > 1 ? `${profile.houseHood}동` : '지역 1동'} {profile.houseLot + 1}번지</b>
          </p>
        )}
        {profile.saju ? (
          <SajuCard reading={profile.saju} compact />
        ) : (
          <p className="muted">생일을 넣으면 사주를 풀어 사는 동네를 다시 정해요. (사주로 동네를 정하기 전에 가입한 주민이에요)</p>
        )}
        {!birthEdit ? (
          <button className="btn-secondary" onClick={() => setBirthEdit(draftFromBirth(profile.birth))}>
            {profile.birth ? '생일 정보 고치기' : '생일 넣고 사주 보기'}
          </button>
        ) : (
          <div className="birth-edit">
            <BirthForm value={birthEdit} onChange={(b) => { setBirthEdit(b); setBirthPreview(null); }} />
            {birthPreview && <SajuCard reading={birthPreview} compact />}
            <div className="field__row">
              <button className="btn-ghost" onClick={() => { setBirthEdit(null); setBirthPreview(null); }}>취소</button>
              {birthPreview ? (
                <button className="btn-primary btn-primary--inline" onClick={saveBirth}>저장</button>
              ) : (
                <button className="btn-primary btn-primary--inline" onClick={previewBirth} disabled={!birthFromDraft(birthEdit)}>사주 다시 보기</button>
              )}
            </div>
          </div>
        )}
        <p className="muted">사는 동네는 사주의 일간 오행으로 정해져서 직접 고르지 않아요. 생일을 고쳐 동네가 바뀌면 집이 새 동네 빈 집터로 옮겨지고, 방과 기록은 그대로예요.</p>
        <label className="field">
          <span>MBTI (오늘의 토론 참여용, 선택)</span>
          <select value={me.mbti ?? ''} disabled={!!changeable} onChange={(e) => e.target.value && setMbti(e.target.value)}>
            <option value="">입력하지 않기</option>
            {MBTI_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {changeable && <small className="muted">{changeable.toLocaleDateString('ko-KR')} 이후에 바꿀 수 있어요 (7일에 한 번)</small>}
        </label>
      </section>

      <section className="section card">
        <h2 className="section-title">공개 범위</h2>
        <label className="field">
          <span>내 방을 볼 수 있는 사람</span>
          <select value={profile.roomVisibility} onChange={(e) => patch({ roomVisibility: e.target.value as Visibility })}>
            {(['public', 'friends', 'private'] as const).map((v) => (
              <option key={v} value={v}>{v === 'public' ? '전체' : v === 'friends' ? '친구만' : VISIBILITY_LABEL[v]}</option>
            ))}
          </select>
        </label>
        <Toggle checked={profile.discoverable} onChange={(v) => patch({ discoverable: v })} label="마을에서 내 방 보여 주기" sub="끄면 마을 지도와 중앙광장 목록에 나오지 않아요" />
        <Toggle checked={profile.showVisits} onChange={(v) => patch({ showVisits: v })} label="방문 기록 남기기" sub="내 방에 누가 다녀갔는지 나만 봐요" />
      </section>

      <section className="section card" id="friends">
        <h2 className="section-title">친구</h2>
        <form
          className="field__row"
          onSubmit={(e) => {
            e.preventDefault();
            if (friendHandle.trim()) friendAction(friendHandle.trim().toLowerCase(), 'request');
          }}
        >
          <input value={friendHandle} onChange={(e) => setFriendHandle(e.target.value)} placeholder="친구의 방 주소 (예: hana_room)" aria-label="친구 방 주소" />
          <button className="btn-primary btn-primary--inline">신청</button>
        </form>
        {friends?.received.length ? (
          <>
            <h3 className="sub-title">받은 신청</h3>
            <ul className="people">
              {friends.received.map((f) => (
                <li key={f.handle} className="person">
                  <span className="dot" style={{ background: tokens.avatar[f.avatar.color] }} aria-hidden />
                  <Link className="person__name" href={`/r/${f.handle}`}>{f.displayName}</Link>
                  <button className="btn-primary btn-primary--inline" onClick={() => friendAction(f.handle, 'accept')}>수락</button>
                  <button className="link-btn" onClick={() => friendAction(f.handle, 'remove')}>거절</button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <h3 className="sub-title">친구 {friends?.friends.length ?? 0}명</h3>
        <ul className="people">
          {friends?.friends.map((f) => (
            <li key={f.handle} className="person">
              <span className="dot" style={{ background: tokens.avatar[f.avatar.color] }} aria-hidden />
              <Link className="person__name" href={`/r/${f.handle}`}>{f.displayName}</Link>
              <button className="link-btn" onClick={() => confirm('친구를 끊을까요?') && friendAction(f.handle, 'remove')}>끊기</button>
            </li>
          ))}
        </ul>
        {friends?.sent.length ? (
          <>
            <h3 className="sub-title">보낸 신청</h3>
            <ul className="people">
              {friends.sent.map((f) => (
                <li key={f.handle} className="person">
                  <span className="dot" style={{ background: tokens.avatar[f.avatar.color] }} aria-hidden />
                  <Link className="person__name" href={`/r/${f.handle}`}>{f.displayName}</Link>
                  <button className="link-btn" onClick={() => friendAction(f.handle, 'remove')}>취소</button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <section className="section card">
        <h2 className="section-title">차단</h2>
        {blocked.length ? (
          <ul className="people">
            {blocked.map((b) => (
              <li key={b.handle} className="person">
                <Icon name="block" size={16} />
                <span className="person__name">{b.displayName}</span>
                <button
                  className="link-btn"
                  onClick={async () => {
                    await call('POST', '/api/blocks', { handle: b.handle, action: 'unblock' }).catch(() => {});
                    loadSocial();
                  }}
                >
                  차단 풀기
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">차단한 사람이 없어요.</p>
        )}
      </section>

      <section className="section card">
        <h2 className="section-title">기록 관리</h2>
        <p className="muted">내 기록·사진 목록·방 배치를 파일로 받아 둘 수 있어요.</p>
        <a className="btn-secondary" href="/api/me/export" download>
          기록 내보내기 (JSON)
        </a>
        <button className="btn-danger" onClick={deleteArchive}>기록과 사진 모두 지우기</button>
      </section>

      <section className="section">
        <button
          className="btn-ghost"
          onClick={async () => {
            await call('POST', '/api/auth/logout', {}).catch(() => {});
            window.location.href = '/';
          }}
        >
          로그아웃
        </button>
      </section>
      {toast && <div className="toast" role="status">{toast}</div>}
      <TabBar />
    </main>
  );
}

/** 가방 미리보기: 모은 것 몇 가지를 아이콘으로 */
function BagPreview({ play }: { play: PlayState | null }) {
  if (!play) return <div className="loader" aria-hidden />;
  const items = [
    ...[...DISTRICTS.map((d) => FRUITS[d]), FORTUNE_FRUIT].map((f) => ({ kind: 'fruit' as const, id: f.id, name: f.name, n: play.fruits[f.id] ?? 0 })),
    ...FISH.map((f) => ({ kind: 'fish' as const, id: f.id, name: f.name, n: play.fish[f.id] ?? 0 })),
  ].filter((i) => i.n > 0);
  if (!items.length) return <p className="muted">아직 모은 게 없어요. 마을에서 열매를 따고 낚시를 해 봐요!</p>;
  return (
    <ul className="bag-preview">
      {items.slice(0, 12).map((i) => (
        <li key={`${i.kind}.${i.id}`} title={`${i.name} ${i.n}`}>
          <ItemIcon kind={i.kind} id={i.id} size={36} />
          <b>{i.n}</b>
        </li>
      ))}
    </ul>
  );
}
