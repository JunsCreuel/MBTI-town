'use client';

// 생일 입력: 양력·음력(윤달), 생년월일, 태어난 시간(모르면 비워 둠). 가입 화면과 MY에서 함께 쓴다.
import type { BirthInput } from '@/shared/saju';

const pad = (n: number) => String(n).padStart(2, '0');

export interface BirthDraft {
  calendar: 'solar' | 'lunar';
  leap: boolean;
  year: string;
  month: string;
  day: string;
  /** HH:MM */
  time: string;
  timeUnknown: boolean;
}

export const emptyBirthDraft = (): BirthDraft => ({ calendar: 'solar', leap: false, year: '', month: '', day: '', time: '', timeUnknown: false });

export function draftFromBirth(b: BirthInput | null): BirthDraft {
  if (!b) return emptyBirthDraft();
  const [year = '', month = '', day = ''] = b.date.split('-');
  return {
    calendar: b.calendar,
    leap: !!b.leap,
    year,
    month: String(Number(month)),
    day: String(Number(day)),
    time: b.time ?? '',
    timeUnknown: !b.time,
  };
}

/** 다 채웠으면 서버로 보낼 모양, 아니면 null */
export function birthFromDraft(d: BirthDraft): BirthInput | null {
  if (!d.year || !d.month || !d.day) return null;
  if (!d.timeUnknown && !/^\d{2}:\d{2}$/.test(d.time)) return null;
  return {
    calendar: d.calendar,
    date: `${d.year}-${pad(Number(d.month))}-${pad(Number(d.day))}`,
    leap: d.calendar === 'lunar' && d.leap,
    time: d.timeUnknown ? null : d.time,
  };
}

export function BirthForm({ value, onChange }: { value: BirthDraft; onChange: (v: BirthDraft) => void }) {
  const set = (patch: Partial<BirthDraft>) => onChange({ ...value, ...patch });
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear - 1900 + 1 }, (_, i) => String(thisYear - i));
  return (
    <div className="birth-form">
      <div className="seg" role="radiogroup" aria-label="양력·음력">
        {(['solar', 'lunar'] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value.calendar === c}
            className={`seg__btn${value.calendar === c ? ' seg__btn--on' : ''}`}
            onClick={() => set({ calendar: c, leap: c === 'lunar' ? value.leap : false })}
          >
            {c === 'solar' ? '양력' : '음력'}
          </button>
        ))}
      </div>
      <div className="birth-form__date">
        <label className="field">
          <span>년</span>
          <select value={value.year} onChange={(e) => set({ year: e.target.value })}>
            <option value="">년도</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>월</span>
          <select value={value.month} onChange={(e) => set({ month: e.target.value })}>
            <option value="">월</option>
            {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>일</span>
          <select value={value.day} onChange={(e) => set({ day: e.target.value })}>
            <option value="">일</option>
            {Array.from({ length: value.calendar === 'lunar' ? 30 : 31 }, (_, i) => String(i + 1)).map((d) => (
              <option key={d} value={d}>{d}일</option>
            ))}
          </select>
        </label>
      </div>
      {value.calendar === 'lunar' && (
        <label className="check">
          <input type="checkbox" checked={value.leap} onChange={(e) => set({ leap: e.target.checked })} /> 윤달이에요
        </label>
      )}
      <label className="field">
        <span>태어난 시간</span>
        <div className="field__row">
          <input type="time" value={value.time} disabled={value.timeUnknown} onChange={(e) => set({ time: e.target.value })} />
          <label className="check">
            <input type="checkbox" checked={value.timeUnknown} onChange={(e) => set({ timeUnknown: e.target.checked, time: e.target.checked ? '' : value.time })} />
            시간을 몰라요
          </label>
        </div>
      </label>
    </div>
  );
}
