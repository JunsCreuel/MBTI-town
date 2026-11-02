'use client';

// MY: 설정 (PROJECT_GUIDE.md 4, 9, 11장). 프로필, 이사, 공개 범위, 친구·차단, 기록 내보내기·삭제.
import Link from 'next/link';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { socialConfig } from '@/config/game';
import { MBTI_TYPES } from '@/design/mbti';
import { tokens } from '@/design/tokens';
import { call, errorMessage } from '@/lib/api';
import type { MyProfile, RoomCard } from '@/server/scene/service';
import { DISTRICT, DISTRICTS, type District } from '@/shared/districts';
import { VISIBILITY_LABEL, type Visibility } from '@/shared/records';
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
  const [handle, setHandle] = useState('');
  const [friends, setFriends] = useState<Friends | null>(null);
  const [blocked, setBlocked] = useState<{ handle: string; displayName: string }[]>([]);
  const [friendHandle, setFriendHandle] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!me?.profile) return;
    setProfile(me.profile);
    setName(me.profile.displayName);
    setBio(me.profile.bio);
    setHandle(me.profile.handle);
  }, [me]);

  const loadSocial = useCallback(() => {
    call<Friends>('GET', '/api/friends').then(setFriends).catch(() => {});
    call<{ blocked: { handle: string; displayName: string }[] }>('GET', '/api/blocks').then((r) => setBlocked(r.blocked)).catch(() => {});
  }, []);

  useEffect(() => {
    if (me) loadSocial();
  }, [me, loadSocial]);

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
          <span>방 주소</span>
          <div className="field__prefix">
            <span>/r/</span>
            <input value={handle} maxLength={20} onChange={(e) => setHandle(e.target.value.toLowerCase())} />
          </div>
          <small className="muted">영문 소문자·숫자·밑줄 3~20자</small>
        </label>
        <button className="btn-primary" onClick={() => patch({ displayName: name, bio, handle })}>프로필 저장</button>
      </section>

      <section className="section card">
        <h2 className="section-title">나의 동네</h2>
        <p className="muted">이사해도 방과 기록은 그대로예요. 창밖 풍경과 마을 지도 위치만 바뀌어요.</p>
        <div className="district-chips">
          {DISTRICTS.map((d) => (
            <button
              key={d}
              className={`chip${profile.district === d ? ' chip--on' : ''}`}
              style={{ '--district': tokens.district[d] } as CSSProperties}
              onClick={() => profile.district !== d && patch({ district: d as District }, `${DISTRICT[d].name}로 이사했어요`)}
            >
              <span className="chip__swatch" style={{ background: tokens.district[d] }} aria-hidden />
              {DISTRICT[d].name}
            </button>
          ))}
        </div>
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
        <label className="field">
          <span>생년월일 (선택, 재미로 보는 추천에만 써요)</span>
          <div className="field__row">
            <input type="date" value={profile.birthDate ?? ''} max={new Date().toISOString().slice(0, 10)} onChange={(e) => patch({ birthDate: e.target.value || null })} />
            {profile.birthDate && <button className="link-btn" onClick={() => patch({ birthDate: null }, '생년월일을 지웠어요')}>지우기</button>}
          </div>
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
