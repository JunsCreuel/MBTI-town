'use client';

// 오행 채우기: 마을 위쪽 작은 게이지 칩(다섯 오행)과 "오늘의 오행 채우기" 시트.
// 타고난 오행이 기준(2칸)보다 모자란 만큼 그 오행의 놀이로 하루에 채운다. 다 채우면 하루 한 번 코인.
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { elementConfig } from '@/config/game';
import { tokens } from '@/design/tokens';
import { call, errorMessage } from '@/lib/api';
import { ELEMENTS, ELEMENT_ACTIVITY, weakestElement, type Element, type ElementFill, type ElementsView } from '@/shared/elements';
import { ELEMENT_INFO } from '@/shared/saju';
import { withIeyo } from '@/shared/josa';
import { Sheet } from '../app/Sheet';

const EVENT = 'scene:elements';

/** 놀이 결과에 붙이는 한 줄 (한 칸 채웠을 때만) */
export function elementLine(fill: ElementFill | null | undefined): string {
  if (!fill?.added) return '';
  const info = ELEMENT_INFO[fill.element];
  const done = fill.filled >= fill.need ? ' 다 채웠어요' : ` ${fill.filled}/${fill.need}`;
  return `${info.ko}(${info.hanja}) 기운 +1${done}${fill.reward ? ` · 오행을 모두 채워 +${fill.reward}코인!` : ''}`;
}

/** 채운 결과를 칩에 알린다 (다시 받아 온다) */
export function noticeElementFill(fill: ElementFill | null | undefined) {
  if (fill?.added) window.dispatchEvent(new Event(EVENT));
}

/** 화면이 알려 주는 놀이 (클럽 춤·신청곡·한 잔, 상가 들르기). 한 칸 채웠으면 그 결과 */
export async function reportElement(element: Element, source: string): Promise<ElementFill | null> {
  try {
    const r = await call<{ fill: ElementFill | null }>('POST', '/api/elements', { element, source });
    noticeElementFill(r.fill);
    return r.fill?.added ? r.fill : null;
  } catch {
    return null;
  }
}

function useElements(enabled: boolean) {
  const [view, setView] = useState<ElementsView | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    call<ElementsView>('GET', '/api/elements').then(
      (v) => {
        setView(v);
        setError('');
      },
      (e) => setError(errorMessage(e)),
    );
  }, []);
  useEffect(() => {
    if (!enabled) return;
    load();
    window.addEventListener(EVENT, load);
    return () => window.removeEventListener(EVENT, load);
  }, [enabled, load]);
  return { view, error, load };
}

/** 위쪽 칩: 다섯 오행 게이지 (오늘 채울 칸이 남은 오행만 비어 보인다) */
export function ElementChip({ onOpen }: { onOpen: () => void }) {
  const { view } = useElements(true);
  if (!view) return null;
  const left = ELEMENTS.reduce((n, e) => n + Math.max(0, view.need[e] - view.filled[e]), 0);
  return (
    <button className="pill element-chip" onClick={onOpen} aria-label={`오늘의 오행 채우기, 남은 칸 ${left}`}>
      <span className="element-chip__bars" aria-hidden>
        {ELEMENTS.map((e) => {
          const ratio = view.need[e] ? Math.min(1, view.filled[e] / view.need[e]) : 1;
          return <i key={e} style={{ '--c': tokens.district[e], '--h': `${Math.round(25 + 75 * ratio)}%` } as CSSProperties} />;
        })}
      </span>
      <span className="element-chip__label">{view.balanced ? '오행 균형' : `오행 ${left}칸`}</span> ›
    </button>
  );
}

export function ElementSheet({ onClose }: { onClose: () => void }) {
  const { view, error } = useElements(true);
  const weakest = view ? weakestElement(view.counts) : null;
  return (
    <Sheet title="오늘의 오행 채우기" onClose={onClose}>
      <div className="elements">
        {!view ? (
          error ? <p className="notice">{error}</p> : <div className="loader" aria-hidden />
        ) : (
          <>
            <p className="elements__intro">
              타고난 사주{view.timeKnown ? ' 여덟 글자' : ' 여섯 글자 (태어난 시간을 몰라서)'}에서 모자란 오행을 그 오행의 놀이로 채워요. 오행마다 {elementConfig.target}칸이 기준이에요.
              {weakest && (
                <>
                  {' '}
                  가장 모자란 기운은{' '}
                  <b style={{ color: tokens.district[weakest] }}>
                    {ELEMENT_INFO[weakest].ko}({ELEMENT_INFO[weakest].hanja})
                  </b>
                  {`${withIeyo(ELEMENT_INFO[weakest].ko).slice(ELEMENT_INFO[weakest].ko.length)}.`}
                </>
              )}
            </p>
            <ul className="elements__list">
              {ELEMENTS.map((e) => {
                const info = ELEMENT_INFO[e];
                const born = view.counts[e];
                const need = view.need[e];
                const got = view.filled[e];
                const slots = Math.max(elementConfig.target, born);
                return (
                  <li key={e} className={`elements__row${need && got >= need ? ' elements__row--done' : ''}`} style={{ '--c': tokens.district[e] } as CSSProperties}>
                    <span className="elements__name">
                      {info.ko}
                      <small>{info.hanja}</small>
                    </span>
                    <span className="elements__slots" aria-label={`타고난 ${born}칸, 오늘 ${got}칸 채움, 채울 칸 ${need}`}>
                      {Array.from({ length: slots }, (_, i) => (
                        <i key={i} className={i < born ? 'elements__slot--born' : i < born + got ? 'elements__slot--today' : ''} />
                      ))}
                    </span>
                    <span className="elements__state">{need === 0 ? '넉넉해요' : got >= need ? '다 채웠어요' : `${need - got}칸 남음`}</span>
                    {need > 0 && got < need && (
                      <span className="elements__how">
                        <b>{ELEMENT_ACTIVITY[e].title}</b> {ELEMENT_ACTIVITY[e].how}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className={`elements__reward${view.balanced ? ' elements__reward--done' : ''}`}>
              {view.balanced
                ? `오늘은 오행을 모두 채웠어요! +${view.reward}코인을 받았어요.`
                : `다섯 오행을 모두 채우면 오늘 한 번 +${elementConfig.reward}코인을 받아요.`}{' '}
              지금까지 균형을 맞춘 날 <b>{view.balanceDays}일</b>
            </p>
            <p className="muted elements__note">재미로 보는 오행이에요. 칸은 매일 밤 12시(한국 시간)에 다시 비어요.</p>
          </>
        )}
      </div>
    </Sheet>
  );
}
