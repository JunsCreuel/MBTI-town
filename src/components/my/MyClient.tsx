'use client';

// MY: 설정 (PROJECT_GUIDE.md 4, 9, 11장). 프로필, 나의 MBTI(바꾸면 그 마을로 이사), 공개 범위, 친구·차단, 기록 내보내기·삭제.
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { socialConfig } from '@/config/game';
import { MBTI, MBTI_TYPES, isMbtiType } from '@/design/mbti';
import { tokens } from '@/design/tokens';
import { call, errorMessage } from '@/lib/api';
import type { MyProfile, PlayState, RoomCard } from '@/server/scene/service';
import { DISTRICT } from '@/shared/districts';
import { VISIBILITY_LABEL, type Visibility } from '@/shared/records';
import { ResidentCard } from '../app/ResidentCard';
import { InventorySheet, ItemIcon } from '../app/Inventory';
import { ALL_FRUITS, FISH } from '@/shared/play';
import { Icon } from '../app/Icon';
import { TabBar } from '../app/TabBar';
import { useMe } from '../app/useMe';

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
    if (!isMbtiType(mbti) || mbti === me?.mbti) return;
    if (!confirm(`${mbti} 마을로 이사해요. 집이 그 마을의 빈 집터로 옮겨지고, 방과 기록은 그대로예요. 바꾼 뒤 일주일 동안은 다시 바꿀 수 없어요. 바꿀까요?`)) return;
    try {
      await call('POST', '/api/me', { mbti });
      await reload();
      setToast(`${mbti} 마을로 이사했어요`);
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

      {profile.admin && (
        <section className="section card">
          <h2 className="section-title">
            운영자 <span className="admin-badge">모든 권한</span>
          </h2>
          <p className="muted">모든 방·기록을 공개 범위와 상관없이 보고, 신고를 처리하고, 방명록·토론 논거·계정을 지울 수 있어요.</p>
          <Link className="btn-primary" href="/admin">
            운영 화면 열기
          </Link>
        </section>
      )}

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
        <h2 className="section-title">나의 MBTI와 마을</h2>
        {profile.district && profile.houseLot !== null && (
          <p>
            내 집: <b>{DISTRICT[profile.district].name} {profile.houseHood > 1 ? `${profile.houseHood}동` : '1동'} {profile.houseLot + 1}번지</b>
          </p>
        )}
        <label className="field">
          <span>MBTI (= 사는 마을, 오늘의 토론에서 내 편)</span>
          <select value={me.mbti ?? ''} disabled={!!changeable} onChange={(e) => e.target.value && setMbti(e.target.value)}>
            {!me.mbti && <option value="">MBTI를 골라 주세요</option>}
            {MBTI_TYPES.map((t) => (
              <option key={t} value={t}>{t} · {MBTI[t].label}</option>
            ))}
          </select>
          {changeable && <small className="muted">{changeable.toLocaleDateString('ko-KR')} 이후에 바꿀 수 있어요 (일주일에 한 번)</small>}
        </label>
        <p className="muted">MBTI를 바꾸면 그 유형 마을로 이사해요. 집이 새 마을 빈 집터로 옮겨지고, 방과 기록은 그대로예요.</p>
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
    ...ALL_FRUITS.map((f) => ({ kind: 'fruit' as const, id: f.id, name: f.name, n: play.fruits[f.id] ?? 0 })),
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
