'use client';

// 사주상담소 타로 (부엉 도사): 오늘의 카드 한 장, 과거·현재·미래 세 장(종합·연애·일·재물).
// 뒤집힌 카드를 늘어놓고 마음 가는 카드를 고르면, 서버가 섞은 덱에서 그 자리의 카드를 뽑아 뒤집어 보여 준다.
// 같은 날 같은 점은 다시 봐도 복채를 또 내지 않고 같은 카드가 나온다.
import { useEffect, useState, type CSSProperties } from 'react';
import { assetUrl } from '@/assets/manifest';
import { call, errorMessage } from '@/lib/api';
import type { SajuOffice } from '@/server/scene/service';
import {
  SPREAD_ROLES, TAROT_DECK, TAROT_ROLE_NAME, TAROT_SPREAD_NAME, TAROT_SPREAD_SIZE, TAROT_TOPICS, TAROT_TOPIC_NAME,
  type TarotResult, type TarotSpread, type TarotTopic,
} from '@/shared/tarot';
import { SAJU_NAME } from './npc';

type ReadResponse = { reading: TarotResult; office: SajuOffice; paid: number };
type Stage = { kind: 'menu' } | { kind: 'pick'; spread: TarotSpread; topic: TarotTopic; picked: number[] } | { kind: 'result'; reading: TarotResult };

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** 카드 그림 (거꾸로면 돌려 그린다) */
function CardImage({ cardKey, reversed = false, size }: { cardKey: string; reversed?: boolean; size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 작은 SVG
    <img
      className={`tarot-card__img${reversed ? ' tarot-card__img--rev' : ''}`}
      src={assetUrl(`item.tarot.${cardKey}`)}
      width={size}
      height={Math.round(size * 1.5)}
      alt=""
      draggable={false}
    />
  );
}

export function TarotPanel({
  office, onOffice, onTitle, onNote,
}: {
  office: SajuOffice | null;
  onOffice: (o: SajuOffice) => void;
  /** 시트 제목 (점을 보는 동안 바뀐다, null이면 기본) */
  onTitle: (t: string | null) => void;
  onNote: (n: string | null) => void;
}) {
  const [stage, setStage] = useState<Stage>({ kind: 'menu' });
  const [topic, setTopic] = useState<TarotTopic>('general');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    onTitle(stage.kind === 'result' ? stage.reading.title : stage.kind === 'pick' ? TAROT_SPREAD_NAME[stage.spread] : null);
  }, [stage, onTitle]);

  async function read(spread: TarotSpread, t: TarotTopic, picks?: number[]) {
    setBusy(true);
    onNote(null);
    try {
      const r = await call<ReadResponse>('POST', '/api/saju/tarot', { spread, topic: t, picks });
      onOffice(r.office);
      setStage({ kind: 'result', reading: r.reading });
      if (r.paid) onNote(`복채 ${r.paid}코인을 냈어요.`);
    } catch (e) {
      onNote(errorMessage(e));
      setStage({ kind: 'menu' });
    } finally {
      setBusy(false);
    }
  }

  function start(spread: TarotSpread) {
    const t = spread === 'one' ? 'general' : topic;
    const seen = spread === 'one' ? office?.tarotSeen.one : office?.tarotSeen.three[t];
    // 오늘 이미 본 점은 고르지 않고 바로 같은 카드를 보여 준다
    if (seen) void read(spread, t);
    else {
      onNote(null);
      setStage({ kind: 'pick', spread, topic: t, picked: [] });
    }
  }

  function pick(i: number) {
    if (stage.kind !== 'pick' || busy || stage.picked.includes(i)) return;
    const picked = [...stage.picked, i];
    setStage({ ...stage, picked });
    if (picked.length === SPREAD_ROLES[stage.spread].length) {
      // 고른 카드가 떠오르는 걸 잠깐 보여 주고 뒤집는다
      setTimeout(() => void read(stage.spread, stage.topic, picked), reduced() ? 0 : 450);
    }
  }

  if (stage.kind === 'pick') return <PickStage stage={stage} busy={busy} onPick={pick} onBack={() => setStage({ kind: 'menu' })} />;
  if (stage.kind === 'result') return <ResultView reading={stage.reading} onBack={() => setStage({ kind: 'menu' })} />;

  const fee = office?.tarotFee;
  return (
    <div className="tarot">
      <p className="bar-line">
        <b>{SAJU_NAME}</b> 카드는 마음을 비추는 거울이라네. 궁금한 걸 떠올리며 골라 보게.
      </p>
      <button className="tarot__spread" disabled={busy || !office} onClick={() => start('one')}>
        <span className="tarot__spread-cards" aria-hidden>
          <CardImage cardKey="back" size={34} />
        </span>
        <span className="tarot__spread-name">{TAROT_SPREAD_NAME.one}</span>
        <span className="saju__fee">{office?.tarotSeen.one ? '다시 보기' : `${fee?.one ?? ''}코인`}</span>
      </button>
      <div className="tarot__three">
        <p className="tarot__three-title">과거·현재·미래 세 장</p>
        <div className="tarot__topics" role="radiogroup" aria-label="궁금한 주제">
          {TAROT_TOPICS.map((t) => (
            <button key={t} role="radio" aria-checked={topic === t} className={`chip${topic === t ? ' chip--on' : ''}`} onClick={() => setTopic(t)}>
              {TAROT_TOPIC_NAME[t]}
              {office?.tarotSeen.three[t] && <span className="tarot__seen" aria-label="오늘 봤어요" />}
            </button>
          ))}
        </div>
        <button className="tarot__spread" disabled={busy || !office} onClick={() => start('three')}>
          <span className="tarot__spread-cards" aria-hidden>
            <CardImage cardKey="back" size={28} />
            <CardImage cardKey="back" size={28} />
            <CardImage cardKey="back" size={28} />
          </span>
          <span className="tarot__spread-name">{TAROT_TOPIC_NAME[topic]} 세 장 뽑기</span>
          <span className="saju__fee">{office?.tarotSeen.three[topic] ? '다시 보기' : `${fee?.three ?? ''}코인`}</span>
        </button>
      </div>
    </div>
  );
}

function PickStage({ stage, busy, onPick, onBack }: { stage: Extract<Stage, { kind: 'pick' }>; busy: boolean; onPick: (i: number) => void; onBack: () => void }) {
  const need = SPREAD_ROLES[stage.spread].length;
  const roles = SPREAD_ROLES[stage.spread];
  return (
    <div className="tarot">
      <p className="bar-line">
        <b>{SAJU_NAME}</b>{' '}
        {stage.spread === 'one'
          ? '오늘 하루를 떠올리며 마음 가는 카드 한 장을 골라 보게.'
          : `${TAROT_TOPIC_NAME[stage.topic]}에 대해 떠올리며 카드 세 장을 차례로 고르게. 과거, 현재, 미래 순서라네.`}
      </p>
      <p className="tarot__count" aria-live="polite">
        {stage.picked.length < need ? (
          <>
            <b>{TAROT_ROLE_NAME[roles[stage.picked.length]]}</b> 카드를 골라 주세요 · {stage.picked.length}/{need}
          </>
        ) : (
          '카드를 뒤집는 중…'
        )}
      </p>
      <ul className="tarot-fan">
        {Array.from({ length: TAROT_SPREAD_SIZE }, (_, i) => {
          const order = stage.picked.indexOf(i);
          return (
            <li key={i} style={{ '--i': i } as CSSProperties}>
              <button
                className={`tarot-fan__card${order >= 0 ? ' tarot-fan__card--on' : ''}`}
                disabled={busy || order >= 0 || stage.picked.length >= need}
                onClick={() => onPick(i)}
                aria-label={order >= 0 ? `${TAROT_ROLE_NAME[roles[order]]} 카드로 골랐어요` : `${i + 1}번째 카드 고르기`}
              >
                <CardImage cardKey="back" size={48} />
                {order >= 0 && <span className="tarot-fan__no">{need > 1 ? TAROT_ROLE_NAME[roles[order]] : '선택'}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <button className="btn-secondary" onClick={onBack} disabled={busy}>
        다른 점 고르기
      </button>
    </div>
  );
}

function ResultView({ reading, onBack }: { reading: TarotResult; onBack: () => void }) {
  // 처음에는 뒷면, 곧 한 장씩 뒤집는다
  const [shown, setShown] = useState(() => (reduced() ? reading.cards.length : 0));
  useEffect(() => {
    if (reduced()) return;
    const timers = reading.cards.map((_, k) => setTimeout(() => setShown((s) => Math.max(s, k + 1)), 250 + k * 450));
    return () => timers.forEach(clearTimeout);
  }, [reading]);
  const big = reading.cards.length === 1;
  const done = shown >= reading.cards.length;
  return (
    <article className="saju-reading tarot-result">
      <p className="muted saju-reading__period">
        {reading.period} · {big ? TAROT_SPREAD_NAME.one : `${TAROT_TOPIC_NAME[reading.topic]} · ${TAROT_SPREAD_NAME.three}`}
      </p>
      <div className={`tarot-result__cards${big ? ' tarot-result__cards--one' : ''}`}>
        {reading.cards.map((c, k) => (
          <figure key={c.role} className="tarot-result__card">
            {!big && <figcaption className="tarot-result__role">{TAROT_ROLE_NAME[c.role]}</figcaption>}
            <div className={`tarot-flip${k < shown ? ' tarot-flip--open' : ''}`}>
              <div className="tarot-flip__back">
                <CardImage cardKey="back" size={big ? 132 : 92} />
              </div>
              <div className="tarot-flip__face">
                <CardImage cardKey={c.key} reversed={c.reversed} size={big ? 132 : 92} />
              </div>
            </div>
            <p className="tarot-result__name">
              <span className="tarot-result__numeral">{TAROT_DECK[c.id].numeral}</span> {c.name}
              {c.reversed && <span className="tarot-result__rev">거꾸로</span>}
            </p>
          </figure>
        ))}
      </div>
      {done && (
        <>
          {big && <p className="tarot-result__keywords tarot-result__keywords--center">{reading.cards[0].keywords.map((w) => `#${w}`).join(' ')}</p>}
          <p className="saju-reading__summary">{reading.summary}</p>
          {!big &&
            reading.cards.map((c) => (
              <section key={c.role} className="saju-reading__section">
                <h4>
                  {TAROT_ROLE_NAME[c.role]} · {c.name}
                  {c.reversed ? ' (거꾸로)' : ''}
                </h4>
                <p className="tarot-result__keywords">{c.keywords.map((w) => `#${w}`).join(' ')}</p>
                <p>{c.text}</p>
              </section>
            ))}
          {reading.sections.map((s) => (
            <section key={s.title} className="saju-reading__section">
              <h4>{s.title}</h4>
              <p>{s.text}</p>
            </section>
          ))}
          <section className="tarot-result__advice">
            <h4>{SAJU_NAME}의 한마디</h4>
            <p>{reading.advice}</p>
          </section>
          <p className="muted saju-reading__note">재미로 보는 점이에요. 좋은 말만 챙겨 가세요.</p>
        </>
      )}
      <button className="btn-secondary" onClick={onBack}>
        다른 점 보기
      </button>
    </article>
  );
}
