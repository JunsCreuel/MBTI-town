'use client';

// 클럽 화면: DJ 너굴에게 신청곡, 바텐더 곰돌에게 한 잔, 취했을 때 화면 효과(흐려짐·분홍빛·딸꾹질).
import { useEffect, useRef, useState } from 'react';
import { asset } from '@/assets/manifest';
import { CLUB_TRACKS } from '@/shared/clubMusic';
import { Sheet } from '../app/Sheet';
import { clubSchedule } from './club';
import { BARTENDER_NAME, DJ_NAME } from './ClubNpcs';
import { DRINKS, bartenderLine, drink, drinksNow, drunkLevel, type Drink } from './drunk';

/** DJ에게 신청곡: 지금 나오는 곡 표시, 누르면 채널 모두에게 그 곡이 나온다 */
export function DjSheet({ onRequest, onClose }: { onRequest: (index: number) => boolean; onClose: () => void }) {
  const [playing, setPlaying] = useState(() => clubSchedule()?.index ?? -1);
  const [note, setNote] = useState('');
  useEffect(() => {
    const t = setInterval(() => setPlaying(clubSchedule()?.index ?? -1), 1000);
    return () => clearInterval(t);
  }, []);
  function pick(i: number) {
    if (!onRequest(i)) return setNote('실시간 서버에 연결된 뒤에 신청할 수 있어요.');
    setNote(`${DJ_NAME}: 「${CLUB_TRACKS[i].title}」 바로 틀어 줄게요!`);
  }
  return (
    <Sheet title={`${DJ_NAME}에게 신청곡`} onClose={onClose}>
      <div className="club-sheet">
        <p className="muted">고른 곡이 이 클럽 채널에 있는 사람 모두에게 나와요. 신청은 채널마다 15초에 한 번이에요.</p>
        <ul className="club-tracks">
          {CLUB_TRACKS.map((t, i) => (
            <li key={t.id}>
              <button className={`club-track${i === playing ? ' club-track--on' : ''}`} onClick={() => pick(i)}>
                <span className="club-track__title">
                  {t.title}
                  {i === playing && <span className="club-track__now">지금 나오는 곡</span>}
                </span>
                <span className="muted club-track__meta">
                  {t.artist} · {t.mood} · {asset(t.key).bpm ?? t.tempo} BPM
                </span>
              </button>
            </li>
          ))}
        </ul>
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
