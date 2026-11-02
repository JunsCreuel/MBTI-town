'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { MBTI_TYPES, mbtiColor } from '@/design/mbti';
import type { Side } from '@/shared/debate';
import type { DebateView } from './api';
import { canvasToBlob, drawResultCard } from './resultCard';
import { teamInk, teamVars } from './teamColor';

export function ResultSection({ view }: { view: DebateView }) {
  const r = view.result!;
  const m = view.match;
  const team = (s: Side) => (s === 'a' ? m.teamA : m.teamB);
  const color = (s: Side) => teamInk(team(s), s);
  const label = (s: Side) => team(s).label;
  const types = MBTI_TYPES.filter((t) => r.byType[t]);

  return (
    <section className="panel result-panel" aria-label="결과 발표">
      <p className="eyebrow">결과 발표 · 관전 판정</p>
      <h2 className="winner" style={r.winner === 'draw' ? undefined : ({ color: color(r.winner) } as CSSProperties)}>
        {r.winner === 'draw' ? '무승부' : `${label(r.winner)} 승리!`}
      </h2>
      <div className="share-bar" aria-label={`판정 점수 ${label('a')} ${r.vote.a}%, ${label('b')} ${r.vote.b}%`}>
        <span style={{ ...teamVars(m.teamA, 'a'), width: `${r.vote.a}%` } as CSSProperties} />
        <span style={{ ...teamVars(m.teamB, 'b'), width: `${r.vote.b}%` } as CSSProperties} />
      </div>
      <p className="final-score">
        <span style={{ color: color('a') }}>{label('a')} {Math.round(r.vote.a)}%</span>
        <span className="final-score__sep">:</span>
        <span style={{ color: color('b') }}>{Math.round(r.vote.b)}% {label('b')}</span>
      </p>
      <p className="muted">{r.summary}</p>

      {r.land && r.winner !== 'draw' && (
        <p className="land-change">
          <span className="land-change__tag">땅따먹기</span>
          {label(r.winner)}이 {label(r.winner === 'a' ? 'b' : 'a')} 땅 {Math.round(r.land.rate * 100)}%를 가져왔어요.{' '}
          <Link href="/plaza">마을 지도에서 보기 ›</Link>
        </p>
      )}

      {r.decisive && (
        <blockquote className="decisive" style={teamVars(team(r.decisive.side), r.decisive.side) as CSSProperties}>
          <span className="decisive__label">
            결정타 논거 · {label(r.decisive.side)} · {r.decisive.picks}명이 골랐어요
          </span>
          {r.decisive.body}
        </blockquote>
      )}

      {types.length > 0 && (
        <div className="verdicts">
          <h3 className="section-title">관전 유형별 판정</h3>
          <p className="muted">유형마다 같은 무게로 셌어요. 사람이 많은 유형이 결과를 좌우하지 않아요.</p>
          <ul className="verdict-grid">
            {types.map((t) => {
              const v = r.byType[t]!;
              const lean: Side | null = v.a === v.b ? null : v.a > v.b ? 'a' : 'b';
              return (
                <li
                  key={t}
                  className="verdict"
                  style={(lean ? teamVars(team(lean), lean) : {}) as CSSProperties}
                  title={`${label('a')} ${v.a}표 · ${label('b')} ${v.b}표`}
                >
                  <span className="verdict__type">
                    <span className="pill__dot" style={{ '--chip-color': mbtiColor(t) } as CSSProperties} />
                    {t}
                  </span>
                  <span className="verdict__lean">{lean ? label(lean) : '반반'}</span>
                  <span className="verdict__count">
                    {v.a}:{v.b}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ShareCard view={view} />
    </section>
  );
}

function ShareCard({ view }: { view: DebateView }) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let revoked: string | null = null;
    (async () => {
      const canvas = await drawResultCard(view, window.location.host);
      const b = await canvasToBlob(canvas);
      revoked = URL.createObjectURL(b);
      setBlob(b);
      setUrl(revoked);
    })().catch(() => setMessage('결과 카드를 만들지 못했어요.'));
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [view]);

  const fileName = `mbti-town-${view.match.key.replace('#', '-')}.png`;

  async function share() {
    if (!blob) return;
    const file = new File([blob], fileName, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'MBTI 마을 오늘의 토론', url: window.location.href });
        return;
      }
      await navigator.clipboard.writeText(window.location.href);
      setMessage('링크를 복사했어요.');
    } catch {
      // 공유 창을 닫은 경우
    }
  }

  return (
    <div className="share-card">
      {url ? <img src={url} alt="결과 카드" width={1080} height={1350} /> : <div className="share-card__placeholder" />}
      <div className="share-card__actions">
        <a className="btn-secondary" href={url ?? undefined} download={fileName} aria-disabled={!url}>
          이미지 저장
        </a>
        <button className="btn-primary btn-primary--inline" onClick={share} disabled={!blob}>
          공유하기
        </button>
      </div>
      {message && <p className="muted" role="status">{message}</p>}
    </div>
  );
}
