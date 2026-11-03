'use client';

// 몬냥이와 이야기하기: 아래쪽 말풍선 창. 한 글자씩 나오고(누르면 바로 다 보임), 다 읽으면 궁금한 것을 고른다.
import { useEffect, useState } from 'react';
import { assetUrl } from '@/assets/manifest';
import { NPC_AGAIN, NPC_BYE, NPC_GREETING, NPC_NAME, NPC_TOPICS } from './npc';

type Mode = { kind: 'lines'; lines: string[]; i: number; then: 'menu' | 'close' } | { kind: 'menu' };

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** 한 글자씩 보여 준다 */
function useTypewriter(text: string) {
  const [n, setN] = useState(() => (reduced() ? text.length : 0));
  useEffect(() => {
    if (reduced()) {
      setN(text.length);
      return;
    }
    setN(0);
    const t = setInterval(() => setN((k) => (k >= text.length ? k : k + 1)), 28);
    return () => clearInterval(t);
  }, [text]);
  return { shown: text.slice(0, n), done: n >= text.length, finish: () => setN(text.length) };
}

export function NpcDialog({ guest, first, onClose }: { guest: boolean; first: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>({ kind: 'lines', lines: first ? NPC_GREETING : NPC_AGAIN, i: 0, then: 'menu' });
  const line = mode.kind === 'lines' ? mode.lines[mode.i] : '무엇이 궁금해요?';
  const { shown, done, finish } = useTypewriter(line);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function next() {
    if (!done) return finish();
    if (mode.kind !== 'lines') return;
    if (mode.i + 1 < mode.lines.length) setMode({ ...mode, i: mode.i + 1 });
    else if (mode.then === 'menu') setMode({ kind: 'menu' });
    else onClose();
  }

  return (
    <div className="npc-dialog" role="dialog" aria-label={`${NPC_NAME}와 이야기`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- 작은 SVG */}
      <img className="npc-dialog__face" src={assetUrl('char.guide.monnyang')} alt="" width={72} height={72} />
      <div className="npc-dialog__box" onClick={mode.kind === 'lines' ? next : undefined}>
        <span className="npc-dialog__name">{NPC_NAME}</span>
        <p className="npc-dialog__text" aria-live="polite">
          {shown}
          {!done && <span className="npc-dialog__caret" aria-hidden />}
        </p>
        {mode.kind === 'lines' ? (
          <button className="npc-dialog__next" onClick={(e) => (e.stopPropagation(), next())}>
            {done ? (mode.i + 1 < mode.lines.length || mode.then === 'menu' ? '다음 ▸' : '알겠어요') : '건너뛰기'}
          </button>
        ) : (
          done && (
            <div className="npc-dialog__choices">
              {NPC_TOPICS.map((t) => (
                <button key={t.id} className="npc-dialog__choice" onClick={() => setMode({ kind: 'lines', lines: t.lines(guest), i: 0, then: 'menu' })}>
                  {t.ask}
                </button>
              ))}
              <button className="npc-dialog__choice npc-dialog__choice--bye" onClick={() => setMode({ kind: 'lines', lines: [NPC_BYE], i: 0, then: 'close' })}>
                고마워요!
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
