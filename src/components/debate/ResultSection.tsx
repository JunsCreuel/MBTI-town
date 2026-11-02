'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { debateConfig } from '@/config/game';
import type { Side } from '@/shared/debate';
import type { DebateView } from './api';
import { canvasToBlob, drawResultCard } from './resultCard';
import { teamInk, teamVars } from './teamColor';

const CRITERIA: { key: keyof typeof debateConfig.judgeCriteria; label: string }[] = [
  { key: 'logic', label: '논리성' },
  { key: 'factuality', label: '사실성' },
  { key: 'evidence', label: '근거' },
  { key: 'rebuttal', label: '반박' },
  { key: 'relevance', label: '적합성' },
];

export function ResultSection({ view }: { view: DebateView }) {
  const r = view.result!;
  const m = view.match;
  const color = (s: Side) => teamInk(s === 'a' ? m.teamA : m.teamB, s);
  const label = (s: Side) => (s === 'a' ? m.teamA.label : m.teamB.label);
  const w = debateConfig.scoreWeights;

  return (
    <section className="panel result-panel" aria-label="결과 발표">
      <p className="eyebrow">결과 발표</p>
      <h2 className="winner" style={r.winner === 'draw' ? undefined : ({ color: color(r.winner) } as CSSProperties)}>
        {r.winner === 'draw' ? '무승부' : `${label(r.winner)} 승리!`}
      </h2>
      <p className="final-score">
        <span style={{ color: color('a') }}>{r.final.a.toFixed(1)}</span>
        <span className="final-score__sep">:</span>
        <span style={{ color: color('b') }}>{r.final.b.toFixed(1)}</span>
      </p>
      <p className="muted">{r.summary}</p>

      {r.decisive && (
        <blockquote className="decisive" style={teamVars(r.decisive.side === 'a' ? m.teamA : m.teamB, r.decisive.side) as CSSProperties}>
          <span className="decisive__label">결정타 논거 · {label(r.decisive.side)}</span>
          {r.decisive.body}
        </blockquote>
      )}

      <table className="score-table">
        <thead>
          <tr>
            <th scope="col">기준</th>
            <th scope="col" style={{ color: color('a') }}>{m.teamA.label}</th>
            <th scope="col" style={{ color: color('b') }}>{m.teamB.label}</th>
          </tr>
        </thead>
        <tbody>
          {CRITERIA.map((c) => (
            <tr key={c.key}>
              <th scope="row">
                {c.label} <span className="muted">/{debateConfig.judgeCriteria[c.key]}</span>
              </th>
              <td>{r.ai.a[c.key]}</td>
              <td>{r.ai.b[c.key]}</td>
            </tr>
          ))}
          <tr className="score-table__sum">
            <th scope="row">AI 심판 <span className="muted">×{w.ai}</span></th>
            <td>{r.aiTotal.a}</td>
            <td>{r.aiTotal.b}</td>
          </tr>
          <tr className="score-table__sum">
            <th scope="row">관전 투표 <span className="muted">×{w.vote} · {r.voters}표</span></th>
            <td>{r.vote.a}%</td>
            <td>{r.vote.b}%</td>
          </tr>
          <tr className="score-table__final">
            <th scope="row">최종</th>
            <td>{r.final.a.toFixed(1)}</td>
            <td>{r.final.b.toFixed(1)}</td>
          </tr>
        </tbody>
      </table>

      <div className="judge-comments">
        {(['a', 'b'] as const).map((s) => (
          <p key={s}>
            <strong style={{ color: color(s) }}>{label(s)}</strong> {r.ai[s].comment}
          </p>
        ))}
      </div>
      {r.judgedBy.startsWith('dev') && (
        <p className="notice">개발용 가짜 채점 결과예요. Anthropic API 키를 넣으면 AI 심판이 채점해요.</p>
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
