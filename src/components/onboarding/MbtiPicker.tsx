'use client';

// MBTI 고르기: 알면 16개 중에서 바로 고르고, 모르면 12문항 간단 테스트로 정한다.
// 고른 유형이 사는 마을이다 (가입 화면과 예전 주민의 MBTI 정하기 화면이 같이 쓴다).
import { useEffect, useState, type CSSProperties } from 'react';
import { MBTI, MBTI_GROUPS, MBTI_TYPES, groupOf, type MbtiType } from '@/design/mbti';
import { tokens } from '@/design/tokens';
import { DISTRICT, THEME } from '@/shared/districts';
import type { AxisLetter } from '@/shared/debate';
import { MBTI_TEST, scoreMbtiTest } from '@/shared/mbtiTest';

export function MbtiPicker({
  value,
  onChange,
  onTesting,
}: {
  value: MbtiType | '';
  onChange: (t: MbtiType) => void;
  /** 테스트를 푸는 중이면 true (끝나기 전에는 '다음'을 막는다) */
  onTesting?: (testing: boolean) => void;
}) {
  const [mode, setMode] = useState<'pick' | 'test'>('pick');
  const [answers, setAnswers] = useState<Record<string, AxisLetter>>({});
  const at = MBTI_TEST.findIndex((q) => !answers[q.id]);
  const done = at === -1;
  const q = done ? null : MBTI_TEST[at];
  const testing = mode === 'test' && !done;
  useEffect(() => onTesting?.(testing), [testing, onTesting]);

  function answer(letter: AxisLetter) {
    if (!q) return;
    const next = { ...answers, [q.id]: letter };
    setAnswers(next);
    const result = scoreMbtiTest(next);
    if (result) onChange(result);
  }

  return (
    <div className="mbti-picker">
      <div className="tabs" role="tablist">
        <button role="tab" className="tab" aria-selected={mode === 'pick'} onClick={() => setMode('pick')}>
          MBTI를 알아요
        </button>
        <button role="tab" className="tab" aria-selected={mode === 'test'} onClick={() => setMode('test')}>
          잘 모르겠어요
        </button>
      </div>

      {mode === 'pick' && (
        <div className="mbti-groups">
          {MBTI_GROUPS.map((g) => (
            <section key={g.id} className="mbti-group" style={{ '--g': tokens.color[g.colorToken] } as CSSProperties}>
              <h3>
                {g.name} <small>{THEME[g.id].place}</small>
              </h3>
              <div className="mbti-group__types">
                {MBTI_TYPES.filter((t) => groupOf(t) === g.id).map((t) => (
                  <button
                    key={t}
                    className={`mbti-type${value === t ? ' mbti-type--on' : ''}`}
                    style={{ '--c': tokens.district[t] } as CSSProperties}
                    aria-pressed={value === t}
                    onClick={() => onChange(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {mode === 'test' && (
        <div className="mbti-test">
          {q ? (
            <>
              <p className="mbti-test__count">
                {at + 1} / {MBTI_TEST.length}
              </p>
              <div className="progress" aria-hidden>
                <span style={{ width: `${(at / MBTI_TEST.length) * 100}%` }} />
              </div>
              <h3 className="mbti-test__q">{q.q}</h3>
              <div className="mbti-test__choices" key={q.id}>
                <button className="choice-card" onClick={() => answer(q.a.letter)}>
                  {q.a.text}
                </button>
                <button className="choice-card" onClick={() => answer(q.b.letter)}>
                  {q.b.text}
                </button>
              </div>
              {at > 0 && (
                <button
                  className="link-btn"
                  onClick={() => {
                    const prev = MBTI_TEST[at - 1];
                    const next = { ...answers };
                    delete next[prev.id];
                    setAnswers(next);
                  }}
                >
                  앞 문항 다시 고르기
                </button>
              )}
            </>
          ) : (
            value && (
              <div className="mbti-test__result" style={{ '--c': tokens.district[value] } as CSSProperties}>
                <p>간단 테스트 결과</p>
                <strong>{value}</strong>
                <span>{MBTI[value].label}</span>
                <button className="link-btn" onClick={() => setAnswers({})}>
                  처음부터 다시 하기
                </button>
              </div>
            )
          )}
          <p className="muted">재미로 보는 12문항 테스트예요. 공식 검사가 아니라서, 결과가 다르다고 느끼면 &lsquo;MBTI를 알아요&rsquo;에서 직접 골라도 돼요.</p>
        </div>
      )}

      {value && mode === 'pick' && (
        <p className="mbti-picker__chosen">
          <b style={{ color: tokens.district[value] }}>{DISTRICT[value].name}</b> · {MBTI[value].label}
        </p>
      )}
    </div>
  );
}

/** 마을 소개 카드: 유형, 네 글자 뜻, 기질과 풍경 */
export function VillageCard({ type }: { type: MbtiType }) {
  const theme = THEME[groupOf(type)];
  return (
    <div className="village-card" style={{ '--c': tokens.district[type] } as CSSProperties}>
      <strong className="village-card__type">{type}</strong>
      <span className="village-card__label">{MBTI[type].label}</span>
      <p>
        <b>{theme.name}</b> 구역 · {theme.place}
      </p>
      <p className="muted">{theme.mood}</p>
    </div>
  );
}
