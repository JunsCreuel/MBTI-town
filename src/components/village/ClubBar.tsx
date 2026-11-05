'use client';

// 클럽 화면: DJ 너굴에게 신청곡, 바텐더 곰돌에게 한 잔, 취했을 때 화면 효과(흐려짐·분홍빛·딸꾹질).
import { useEffect, useRef, useState } from 'react';
import { townConfig } from '@/config/game';
import { CLUB_TRACKS, YOUTUBE_MAX_SECONDS, queueKey, youtubeIdOf, type YoutubeSong } from '@/shared/clubMusic';
import { call, errorMessage } from '@/lib/api';
import type { MusicAdmin, MusicResult } from '@/shared/protocol';
import { Sheet } from '../app/Sheet';
import { clubQueue, clubSchedule, onClubDj, onClubResult, songTitle } from './club';
import { BARTENDER_NAME, DJ_NAME } from './ClubNpcs';
import { DRINKS, bartenderLine, drink, drinksNow, drunkLevel, type Drink } from './drunk';

const REFUSED: Record<Extract<MusicResult, { ok: false }>['reason'], string> = {
  full: '신청곡 목록이 꽉 찼어요. 몇 곡 끝난 뒤에 신청해 주세요.',
  mine: `한 사람은 ${townConfig.musicQueuePerPerson}곡까지 기다릴 수 있어요.`,
  cooldown: '조금만 있다가 다시 신청해 주세요.',
  closed: '지금은 신청할 수 없어요.',
};

export type YoutubeTicket = { song: YoutubeSong; exp: number; sig: string };

/** DJ에게 신청곡: 지금 나오는 곡, 신청곡 목록(차례대로), 신청하기(목록 곡 또는 유튜브 링크). 지금 곡은 끝까지 틀고 신청곡이 차례로 나온다 */
export function DjSheet({
  guest, admin = false, onRequest, onYoutube, onAdmin, onClose,
}: {
  guest: boolean;
  /** 운영자면 지금 곡 넘기기·신청곡 빼기·영상 막기 버튼이 보인다 (실시간 서버도 운영자인지 다시 확인한다) */
  admin?: boolean;
  onRequest: (index: number) => boolean;
  onYoutube: (ticket: YoutubeTicket) => boolean;
  onAdmin?: (cmd: MusicAdmin) => boolean;
  onClose: () => void;
}) {
  const read = () => ({ now: clubSchedule(), queue: clubQueue() });
  const [line, setLine] = useState(read);
  const [note, setNote] = useState('');
  useEffect(() => {
    const t = setInterval(() => setLine(read()), 1000);
    const off = onClubDj(() => setLine(read()));
    const offResult = onClubResult((r) =>
      setNote(r.ok ? `${DJ_NAME}: 신청곡 목록 ${r.position}번째에 넣었어요. 앞 곡이 끝나면 차례로 틀어 줄게요!` : REFUSED[r.reason]),
    );
    return () => {
      clearInterval(t);
      off();
      offResult();
    };
  }, []);
  function pick(i: number) {
    if (!onRequest(i)) setNote('실시간 서버에 연결된 뒤에 신청할 수 있어요.');
  }
  const [link, setLink] = useState('');
  const [checking, setChecking] = useState(false);
  async function requestYoutube(e: React.FormEvent) {
    e.preventDefault();
    if (checking) return;
    if (!youtubeIdOf(link)) {
      setNote('유튜브 영상 링크를 넣어 주세요.');
      return;
    }
    setChecking(true);
    setNote('');
    try {
      const res = await fetch(`/api/club/youtube?url=${encodeURIComponent(link.trim())}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(data.message ?? '유튜브 곡을 확인하지 못했어요.');
        return;
      }
      if (onYoutube(data as YoutubeTicket)) setLink('');
      else setNote('실시간 서버에 연결된 뒤에 신청할 수 있어요.');
    } catch {
      setNote('유튜브 곡을 확인하지 못했어요. 잠시 뒤에 다시 해 주세요.');
    } finally {
      setChecking(false);
    }
  }
  const playing = line.now?.index ?? -1;
  function adminCmd(cmd: MusicAdmin, done: string) {
    setNote(onAdmin?.(cmd) ? done : '실시간 서버에 연결된 뒤에 할 수 있어요.');
  }
  /** 운영자: 이 영상을 앞으로 신청할 수 없게 막는다 */
  async function blockVideo(id: string, title: string) {
    try {
      await call('POST', '/api/admin/youtube', { block: { url: id, scope: 'video' } });
      setNote(`"${title}" 영상을 막았어요. 다시 신청할 수 없어요.`);
      return true;
    } catch (e) {
      setNote(errorMessage(e));
      return false;
    }
  }
  return (
    <Sheet title={`${DJ_NAME}에게 신청곡`} onClose={onClose}>
      <div className="club-sheet">
        <p className="muted">지금 곡이 끝나면 신청곡이 차례로 나와요. 이 채널 모두가 같이 들어요.</p>
        {line.now && (
          <div className="club-now">
            <span className="club-now__label">지금 나오는 곡</span>
            <b>{songTitle(line.now)}</b>
            {line.now.by && <span className="muted">{line.now.by}의 신청곡</span>}
            {admin && (
              <span className="club-admin">
                <button className="btn-secondary btn-small" onClick={() => adminCmd({ action: 'skip' }, '지금 곡을 넘겼어요. 채널 모두에게 다음 곡이 나와요.')}>
                  지금 곡 넘기기
                </button>
                {line.now.yt && (
                  <button
                    className="btn-danger btn-small"
                    onClick={async () => {
                      const yt = line.now!.yt!;
                      if (await blockVideo(yt.id, yt.title)) adminCmd({ action: 'skip' }, `"${yt.title}" 영상을 막고 넘겼어요.`);
                    }}
                  >
                    영상 막고 넘기기
                  </button>
                )}
              </span>
            )}
          </div>
        )}
        <h3 className="club-sub">
          신청곡 목록 <b>{line.queue.length}</b>
        </h3>
        {line.queue.length ? (
          <ol className="club-queue">
            {line.queue.map((q, k) => (
              <li key={`${k}:${q.who}:${q.yt?.id ?? q.index}`}>
                <span className="club-queue__no">{k + 1}</span>
                <span className="club-queue__title">
                  {q.yt && <span className="club-queue__yt">유튜브</span>}
                  {songTitle(q)}
                </span>
                <span className="muted club-queue__by">{q.by}</span>
                {admin && (
                  <span className="club-admin">
                    <button className="btn-secondary btn-small" aria-label={`${songTitle(q)} 신청곡 빼기`} onClick={() => adminCmd({ action: 'remove', at: k, key: queueKey(q) }, `"${songTitle(q)}" 신청곡을 뺐어요.`)}>
                      빼기
                    </button>
                    {q.yt && (
                      <button
                        className="btn-danger btn-small"
                        onClick={async () => {
                          if (await blockVideo(q.yt!.id, q.yt!.title)) adminCmd({ action: 'remove', at: k, key: queueKey(q) }, `"${q.yt!.title}" 영상을 막고 뺐어요.`);
                        }}
                      >
                        막기
                      </button>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">아직 신청곡이 없어요.</p>
        )}
        <h3 className="club-sub">신청하기</h3>
        <ul className="club-tracks">
          {CLUB_TRACKS.map((t, i) => (
            <li key={t.id}>
              <button className={`club-track${i === playing ? ' club-track--on' : ''}`} onClick={() => pick(i)}>
                <span className="club-track__title">{t.title}</span>
              </button>
            </li>
          ))}
        </ul>
        <h3 className="club-sub">유튜브 링크로 신청</h3>
        {!guest && <p className="muted club-yt-rule">음악·엔터테인먼트 영상, {YOUTUBE_MAX_SECONDS / 60}분 이하 곡을 신청할 수 있어요. 나오는 동안 화면에 유튜브 플레이어가 보여요.</p>}
        {guest ? (
          <p className="muted">로그인한 주민만 유튜브 곡을 신청할 수 있어요.</p>
        ) : (
          <form className="club-yt-form" onSubmit={requestYoutube}>
            <input
              type="url"
              inputMode="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://youtu.be/..."
              aria-label="유튜브 영상 링크"
              autoComplete="off"
            />
            <button className="btn-primary btn-primary--inline" disabled={checking || !link.trim()}>
              {checking ? '확인 중…' : '신청'}
            </button>
          </form>
        )}
        {note && (
          <p className="notice" role="status">
            {note}
          </p>
        )}
      </div>
    </Sheet>
  );
}

/** 바: 바텐더가 마신 잔 수에 맞춰 말하고, 술(또는 물)을 내준다 */
export function BarSheet({ onDrink, onClose }: { onDrink: (d: Drink, total: number) => void; onClose: () => void }) {
  const [count, setCount] = useState(() => Math.round(drinksNow()));
  const [line, setLine] = useState(() => bartenderLine(Math.round(drinksNow())));
  function order(d: Drink) {
    const total = drink(d);
    setCount(total);
    setLine(`${d.line} ${bartenderLine(total)}`);
    onDrink(d, total);
  }
  return (
    <Sheet title={`${BARTENDER_NAME}의 바`} onClose={onClose}>
      <div className="club-sheet">
        <p className="bar-line">
          <b>{BARTENDER_NAME}</b> {line}
        </p>
        <div className="bar-menu">
          {DRINKS.map((d) => (
            <button key={d.id} className={`bar-drink${d.units < 0 ? ' bar-drink--water' : ''}`} onClick={() => order(d)}>
              {d.name}
            </button>
          ))}
        </div>
        <p className="muted bar-note">
          지금 {count}잔째예요. 두 잔까지는 멀쩡하고, 세 잔부터 점점 취해요. 시간이 지나면 한 잔씩 깨요. (게임 속 술이에요)
        </p>
      </div>
    </Sheet>
  );
}

/**
 * 취했을 때 화면 효과 (세 잔부터): 화면이 흐려지고 분홍빛이 돌고, 가끔 "딸꾹!"
 * 3D 화면 흔들림·비틀거리는 걸음은 VillageScene·Characters가 같은 drunkLevel로 그린다.
 */
export function DrunkFx({ host }: { host: React.RefObject<HTMLElement | null> }) {
  const [level, setLevel] = useState(0);
  const [hic, setHic] = useState(0);
  const nextHic = useRef(0);
  useEffect(() => {
    const t = setInterval(() => {
      const l = drunkLevel();
      setLevel(l);
      const el = host.current;
      if (el) {
        // 멀쩡할 때는 필터를 아예 빼서 그리는 비용을 아낀다
        el.classList.toggle('village--drunk', l > 0);
        el.style.setProperty('--drunk-blur', `${Math.max(0, l - 0.35) * 2.2}px`);
        el.style.setProperty('--drunk-sat', `${1 + l * 0.35}`);
      }
      const now = Date.now();
      if (l > 0.2 && now > nextHic.current) {
        if (nextHic.current) setHic(now);
        nextHic.current = now + (14000 - l * 8000) * (0.6 + Math.random() * 0.8);
      }
    }, 300);
    return () => clearInterval(t);
  }, [host]);
  if (level <= 0) return null;
  return (
    <>
      <div className="drunk-vignette" style={{ opacity: Math.min(0.85, level) }} aria-hidden />
      {hic > 0 && (
        <div key={hic} className="drunk-hic" aria-hidden>
          딸꾹!
        </div>
      )}
    </>
  );
}
