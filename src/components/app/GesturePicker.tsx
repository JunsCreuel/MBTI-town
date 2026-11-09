'use client';

// 몸짓·이모티콘 고르기 (마을과 방이 같이 쓴다).
// bar: 자주 쓰는 몸짓 몇 개 + "더보기" / button: "몸짓" 버튼 하나 (방처럼 화면이 좁은 곳)
// onPet을 주면 "쓰다듬기" 버튼이 몸짓 버튼 옆에 붙는다 (방 강아지)
// selfPop: 내 캐릭터가 화면에 안 보일 때(방 1인칭) 내가 보낸 몸짓·이모티콘을 화면 가운데에 크게 띄운다
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { assetUrl } from '@/assets/manifest';
import { townConfig } from '@/config/game';
import { type ActionKind, type EmoteKind } from '@/shared/protocol';
import { ACTION_INFO, EMOTE_INFO, PICKABLE_ACTIONS, PICKABLE_EMOTES, type GestureInfo } from './gestures';

const QUICK_ACTIONS: ActionKind[] = ['cheer', 'clap'];
const QUICK_EMOTES: EmoteKind[] = ['heart', 'joy', 'wow'];

function GestureIcon({ info, size = 22 }: { info: GestureInfo; size?: number }) {
  return (
    <span
      className="icon"
      style={{ '--icon': `url(${assetUrl(info.icon)})`, width: size, height: size, color: info.color } as CSSProperties}
      aria-hidden
    />
  );
}

export function GesturePicker({
  onAction, onEmote, variant = 'bar', onPet, selfPop = false,
}: {
  onAction: (kind: ActionKind) => void;
  onEmote: (kind: EmoteKind) => void;
  variant?: 'bar' | 'button';
  /** 강아지 쓰다듬기 (방): 내 캐릭터가 강아지 곁으로 가서 쓰다듬는다 */
  onPet?: () => void;
  /** 내가 보낸 것을 화면 가운데에 크게 띄운다 (내 캐릭터가 안 보이는 1인칭) */
  selfPop?: boolean;
}) {
  const [pop, setPop] = useState<{ info: GestureInfo; at: number } | null>(null);
  useEffect(() => {
    if (!pop) return;
    const t = setTimeout(() => setPop(null), townConfig.emoteDurationMs);
    return () => clearTimeout(t);
  }, [pop]);
  const [open, setOpen] = useState(false);
  const [cooling, setCooling] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // 바깥을 누르거나 Esc를 누르면 닫는다
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  function fire(send: () => void, info: GestureInfo) {
    if (cooling) return;
    send();
    if (selfPop) setPop({ info, at: Date.now() });
    setOpen(false);
    setCooling(true);
    setTimeout(() => setCooling(false), townConfig.emoteCooldownMs);
  }

  const actionBtn = (k: ActionKind) => (
    <button key={`a-${k}`} className="action-btn" disabled={cooling} onClick={() => fire(() => onAction(k), ACTION_INFO[k])}>
      <GestureIcon info={ACTION_INFO[k]} />
      {ACTION_INFO[k].label}
    </button>
  );
  const emoteBtn = (k: EmoteKind) => (
    <button key={`e-${k}`} className="action-btn" disabled={cooling} onClick={() => fire(() => onEmote(k), EMOTE_INFO[k])}>
      <GestureIcon info={EMOTE_INFO[k]} />
      {EMOTE_INFO[k].label}
    </button>
  );

  return (
    <div ref={root} className={`gesture gesture--${variant}`}>
      {/* 아래 메뉴는 위치를 옮겨 두어(transform) 화면 기준으로 띄우려면 body에 붙인다 */}
      {pop &&
        createPortal(
          <div key={pop.at} className="self-pop" role="status" aria-label={`내 몸짓: ${pop.info.label}`}>
            <GestureIcon info={pop.info} size={56} />
          </div>,
          document.body,
        )}
      {open && (
        <div className="gesture-panel" role="dialog" aria-label="몸짓 고르기">
          <p className="gesture-panel__title">몸짓</p>
          <div className="gesture-grid">{PICKABLE_ACTIONS.map(actionBtn)}</div>
          <p className="gesture-panel__title">이모티콘</p>
          <div className="gesture-grid">{PICKABLE_EMOTES.map(emoteBtn)}</div>
        </div>
      )}
      <div className="actionbar" role="toolbar" aria-label="몸짓">
        {variant === 'bar' && (
          <>
            {QUICK_ACTIONS.map(actionBtn)}
            <span className="actionbar__sep" aria-hidden />
            {QUICK_EMOTES.map(emoteBtn)}
          </>
        )}
        {onPet && (
          <button className="action-btn" onClick={onPet}>
            <GestureIcon info={ACTION_INFO.pet} />
            {ACTION_INFO.pet.label}
          </button>
        )}
        <button className="action-btn" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}>
          <GestureIcon info={{ label: '', icon: open ? 'ui.icon.close' : 'ui.icon.plus', color: 'currentColor' }} />
          {variant === 'bar' ? (open ? '닫기' : '더보기') : open ? '닫기' : '몸짓'}
        </button>
      </div>
    </div>
  );
}
