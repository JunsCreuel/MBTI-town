'use client';

// MBTI 마을 대항전: 마을 위쪽 칩(지금 1위)과 순위 시트(16개 마을 순위·내가 올린 점수·점수 얻는 법·지난주 우승).
import { useEffect, useState, type CSSProperties } from 'react';
import { contestConfig } from '@/config/game';
import { tokens } from '@/design/tokens';
import { call, errorMessage } from '@/lib/api';
import type { ContestView } from '@/server/scene/service';
import { CONTEST_KINDS, CONTEST_KIND_NAME, contestLeader, timeLeftLabel } from '@/shared/contest';
import { DISTRICT } from '@/shared/districts';
import { Icon } from '../app/Icon';
import { Sheet } from '../app/Sheet';
import { boardNow, usePlazaBoard } from './plazaBoard';

/** 위쪽 칩: 지금 1위 마을과 남은 시간 */
export function ContestChip({ onOpen }: { onOpen: () => void }) {
  const board = usePlazaBoard();
  const leader = board ? contestLeader(board.standings.districts) : null;
  return (
    <button className="pill contest-chip" onClick={onOpen} style={leader ? ({ '--contest': tokens.district[leader] } as CSSProperties) : undefined}>
      <span className="contest-chip__tag">
        <Icon name="ranking" size={14} /> 대항전
      </span>
      <span className="contest-chip__label">{leader ? `1위 ${DISTRICT[leader].short}` : 'MBTI 마을 대항전'}</span> ›
    </button>
  );
}

const fmt = (n: number) => n.toLocaleString('ko-KR');
const P = contestConfig.points;

/** 점수 얻는 법 (설정 값으로 쓴다) */
const HOW: { title: string; text: string }[] = [
  { title: '낚시', text: `흔해요 ${P.fish.common} · 드물어요 ${P.fish.rare} · 전설 ${P.fish.legend} · 신화 ${P.fish.mythic}점` },
  { title: '열매', text: `열매 나무 ${P.fruit} · 운세 열매 ${P.fortune}점` },
  { title: '토론', text: `논거 ${P.argument} · 우리 편 논거 추천 ${P.recommend} · 판정 ${P.vote}점, 이긴 편(예: E)의 여덟 마을마다 +${P.debateWin}점` },
  { title: '출석', text: `하루 첫 방문 ${P.checkin}점` },
  { title: '상가', text: `점포 사기 ${P.shop}점` },
];

export function ContestSheet({ guest, onClose }: { guest: boolean; onClose: () => void }) {
  const [view, setView] = useState<ContestView | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    call<ContestView>('GET', '/api/contest')
      .then(setView)
      .catch((e) => setError(errorMessage(e)));
  }, []);
  const rows = view?.standings.districts ?? [];
  const top = Math.max(1, rows[0]?.score ?? 0);
  const leader = contestLeader(rows);
  return (
    <Sheet title="MBTI 마을 대항전" onClose={onClose}>
      <div className="contest">
        {!view ? (
          error ? <p className="notice">{error}</p> : <div className="loader" aria-hidden />
        ) : (
          <>
            <p className="contest__when">
              이번 주 · 일요일 밤 9시 발표 <b>{timeLeftLabel(new Date(view.standings.closesAt), boardNow())}</b> 남음
            </p>
            <ol className="contest__rank">
              {rows.map((r, i) => (
                <li
                  key={r.district}
                  className={`contest__row${view.me?.district === r.district ? ' contest__row--mine' : ''}`}
                  style={{ '--d': tokens.district[r.district], '--w': `${(r.score / top) * 100}%` } as CSSProperties}
                >
                  <span className="contest__no">{i + 1}</span>
                  <span className="contest__name">
                    {DISTRICT[r.district].short}
                    {r.district === leader && <Icon name="crown" size={14} />}
                    {view.me?.district === r.district && <span className="contest__mine">우리 마을</span>}
                  </span>
                  <span className="contest__bar" aria-hidden>
                    <i />
                  </span>
                  <span className="contest__score">
                    <span>
                      <b>{fmt(r.score)}</b>점
                    </span>
                    <small>
                      {r.people}명{r.debateWins ? ` · 토론 ${r.debateWins}승` : ''}
                    </small>
                  </span>
                </li>
              ))}
            </ol>
            {view.me ? (
              <section className="contest__me">
                <h3>
                  이번 주 내가 {DISTRICT[view.me.district].name}에 올린 점수 <b>{fmt(view.me.week)}점</b>
                </h3>
                <ul className="contest__today" aria-label="오늘 올린 점수 (종류마다 하루에 올릴 수 있는 만큼)">
                  {CONTEST_KINDS.map((k) => (
                    <li key={k} className={view.me!.today[k] >= contestConfig.dailyCap[k] ? 'contest__today--full' : ''}>
                      {CONTEST_KIND_NAME[k]} <b>{view.me!.today[k]}</b>/{contestConfig.dailyCap[k]}
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <p className="muted">{guest ? '집이 있는 주민만 점수를 올릴 수 있어요. 아래 "나도 집 짓기"부터 해 보세요!' : '가입을 마치면 내 MBTI 마을에 점수를 올릴 수 있어요.'}</p>
            )}
            <section className="contest__how">
              <h3>점수 얻는 법</h3>
              {HOW.map((h) => (
                <p key={h.title}>
                  <b>{h.title}</b> {h.text}
                </p>
              ))}
              <p className="muted">한 사람이 하루에 올릴 수 있는 점수는 종류마다 정해져 있어요. 일요일 밤 9시에 광장 전광판과 공지로 우승 마을을 발표해요.</p>
            </section>
            {view.last.winner && (
              <p className="contest__last">
                지난주 우승 <b style={{ color: tokens.district[view.last.winner] }}>{DISTRICT[view.last.winner].name}</b> (
                {fmt(view.last.districts.find((d) => d.district === view.last.winner)?.score ?? 0)}점)
              </p>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
