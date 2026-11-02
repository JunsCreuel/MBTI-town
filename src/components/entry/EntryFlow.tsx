'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';
import { MBTI, MBTI_GROUPS, MBTI_TYPES, groupOf, mbtiColor, type MbtiType } from '@/design/mbti';
import { tokens } from '@/design/tokens';
import { loadMbti, saveMbti } from '@/lib/session';
import { SURVEY, isSurveyComplete, scoreSurvey, type Choice } from '@/shared/survey';

type Step = 'start' | 'pick' | 'survey' | 'result';

const chipStyle = (code: MbtiType) => ({ '--chip-color': mbtiColor(code) }) as CSSProperties;

export function EntryFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('start');
  const [picked, setPicked] = useState<MbtiType | null>(null);
  const [answers, setAnswers] = useState<Record<string, Choice>>({});
  const [qIndex, setQIndex] = useState(0);

  // 전에 고른 유형이 있으면 미리 선택해 둔다
  useEffect(() => {
    const saved = loadMbti();
    if (saved) setPicked(saved);
  }, []);

  function enter(mbti: MbtiType) {
    saveMbti(mbti);
    router.push(`/plaza?mbti=${mbti}`);
  }

  function answer(choice: Choice) {
    const q = SURVEY[qIndex];
    const next = { ...answers, [q.id]: choice };
    setAnswers(next);
    if (qIndex < SURVEY.length - 1) {
      setQIndex(qIndex + 1);
    } else if (isSurveyComplete(next)) {
      setPicked(scoreSurvey(next));
      setStep('result');
    }
  }

  return (
    <main className="entry">
      <div className="wordmark">
        <span className="wordmark__dots" aria-hidden>
          {MBTI_GROUPS.map((g) => (
            <span key={g.id} style={{ background: tokens.color[g.colorToken] }} />
          ))}
        </span>
        MBTI 마을
      </div>

      {step === 'start' && (
        <>
          <header>
            <h1 className="entry__title">
              오늘은 어느 팀이
              <br />
              이길까요?
            </h1>
            <p className="entry__lead">
              16개 유형이 팀이 되어 매일 토론으로 겨루는 광장이에요. 먼저 내 유형을 알려 주세요.
            </p>
          </header>
          <div className="choice-list">
            <button className="choice-card" onClick={() => setStep('pick')}>
              <span>
                <span className="choice-card__title">내 유형 고르기</span>
                <span className="choice-card__sub">내 MBTI를 알고 있어요</span>
              </span>
              <span className="choice-card__arrow" aria-hidden>›</span>
            </button>
            <button
              className="choice-card"
              onClick={() => {
                setAnswers({});
                setQIndex(0);
                setStep('survey');
              }}
            >
              <span>
                <span className="choice-card__title">간단 설문으로 찾기</span>
                <span className="choice-card__sub">{SURVEY.length}문항 · 1분이면 끝나요</span>
              </span>
              <span className="choice-card__arrow" aria-hidden>›</span>
            </button>
          </div>
          {picked && (
            <div className="sticky-cta">
              <button className="btn-primary" onClick={() => enter(picked)}>
                지난번 유형 {picked}(으)로 바로 입장
              </button>
            </div>
          )}
        </>
      )}

      {step === 'pick' && (
        <>
          <button className="back-link" onClick={() => setStep('start')}>‹ 처음으로</button>
          <h1 className="entry__title">내 유형을 골라 주세요</h1>
          {MBTI_GROUPS.map((g) => (
            <section key={g.id} className="group" aria-label={g.name}>
              <div className="group__head">
                <span className="group__dot" style={{ background: tokens.color[g.colorToken] }} />
                {g.name}
              </div>
              <div className="type-grid">
                {MBTI_TYPES.filter((t) => groupOf(t) === g.id).map((code) => (
                  <button
                    key={code}
                    className="type-chip"
                    style={chipStyle(code)}
                    aria-pressed={picked === code}
                    aria-label={`${code} (${MBTI[code].label})`}
                    onClick={() => setPicked(code)}
                  >
                    <span className="type-chip__swatch" aria-hidden />
                    <span className="type-chip__code">{code}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          <div className="sticky-cta">
            <button className="btn-primary" disabled={!picked} onClick={() => picked && enter(picked)}>
              {picked ? `${picked}(으)로 광장 입장` : '유형을 골라 주세요'}
            </button>
          </div>
        </>
      )}

      {step === 'survey' && (
        <>
          <button
            className="back-link"
            onClick={() => (qIndex === 0 ? setStep('start') : setQIndex(qIndex - 1))}
          >
            ‹ {qIndex === 0 ? '처음으로' : '이전 문항'}
          </button>
          <div className="survey__progress">
            <div
              className="survey__bar"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={SURVEY.length}
              aria-valuenow={qIndex + 1}
            >
              <span style={{ width: `${((qIndex + 1) / SURVEY.length) * 100}%` }} />
            </div>
            {qIndex + 1} / {SURVEY.length}
          </div>
          <h1 className="survey__prompt">{SURVEY[qIndex].prompt}</h1>
          <div className="survey__options">
            {(['a', 'b'] as const).map((c) => (
              <button
                key={c}
                className="survey__option"
                aria-pressed={answers[SURVEY[qIndex].id] === c}
                onClick={() => answer(c)}
              >
                {SURVEY[qIndex][c]}
              </button>
            ))}
          </div>
          <p className="survey__note">정식 검사가 아니라 입장용 간단 설문이에요. 결과는 나중에 바꿀 수 있어요.</p>
        </>
      )}

      {step === 'result' && picked && (
        <>
          <button className="back-link" onClick={() => setStep('start')}>‹ 처음으로</button>
          <div className="result" style={chipStyle(picked)}>
            <span className="result__group">
              {MBTI_GROUPS.find((g) => g.id === MBTI[picked].group)!.name} 그룹
            </span>
            <div className="result__badge">{picked}</div>
            <p className="result__label">{MBTI[picked].label}</p>
            <button className="btn-secondary" onClick={() => setStep('pick')}>다른 유형으로 고르기</button>
          </div>
          <div className="sticky-cta">
            <button className="btn-primary" onClick={() => enter(picked)}>
              {picked}(으)로 광장 입장
            </button>
          </div>
        </>
      )}
    </main>
  );
}
