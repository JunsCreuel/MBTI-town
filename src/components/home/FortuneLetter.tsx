'use client';

// 우편함에 온 오늘의 일진 편지. 재미로 보는 사주다 (성격·운명을 정하는 말은 하지 않는다).
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { tokens } from '@/design/tokens';
import { ELEMENT_INFO } from '@/shared/saju';
import type { DailyFortune } from '@/shared/fortune';
import { Sheet } from '../app/Sheet';

const READ_KEY = 'scene:fortune-read';

/** 오늘 편지를 이 기기에서 읽었는지 (기기마다 따로 기억한다) */
export function fortuneRead(date: string): boolean {
  try {
    return localStorage.getItem(READ_KEY) === date;
  } catch {
    return false;
  }
}

export function markFortuneRead(date: string) {
  try {
    localStorage.setItem(READ_KEY, date);
  } catch {
    // 저장하지 못하면 다음에 다시 새 편지로 보인다
  }
}

function dateLabel(date: string) {
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
}

export function FortuneLetter({ fortune, onClose, onGuestbook }: { fortune: DailyFortune; onClose: () => void; onGuestbook: () => void }) {
  const dayColor = tokens.district[fortune.dayPillar.element];
  const luckyColor = tokens.district[fortune.lucky.element];
  return (
    <Sheet title="오늘의 편지" onClose={onClose}>
      <div className="letter">
        <p className="letter__date">
          {dateLabel(fortune.date)} ·{' '}
          <b style={{ '--chip-color': dayColor } as CSSProperties} className="letter__pillar">
            {fortune.dayPillar.ko}일 {fortune.dayPillar.hanja}
          </b>
        </p>
        <h3 className="letter__title">{fortune.title}</h3>
        <p className="letter__body">{fortune.message}</p>
        <p className="muted letter__why">
          내 일간 {fortune.me.ko}({ELEMENT_INFO[fortune.me.element].ko})에게 오늘은 <b>{fortune.tenGod}</b>의 날이에요.
        </p>
        <div className="letter__lucky">
          <span className="letter__swatch" style={{ background: luckyColor }} aria-hidden />
          <span>
            행운의 색 <b>{fortune.lucky.color}</b> · 행운의 소품 <b>{fortune.lucky.itemName}</b>
          </span>
        </div>
        <Link className="btn-primary" href={fortune.todo.href}>
          오늘 해 볼 것: {fortune.todo.label}
        </Link>
        <button className="btn-secondary" onClick={onGuestbook}>방명록 보기</button>
        <p className="muted letter__note">재미로 보는 오늘의 일진이에요. 내일 또 새 편지가 와요.</p>
      </div>
    </Sheet>
  );
}
