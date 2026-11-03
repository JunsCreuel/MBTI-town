'use client';

// 사주 결과 카드: 네 기둥(시·일·월·년), 오행 개수, 일간으로 정해진 거주 지역.
import type { CSSProperties } from 'react';
import { assetUrl } from '@/assets/manifest';
import { tokens } from '@/design/tokens';
import { DISTRICT, DISTRICTS, type District } from '@/shared/districts';
import { ELEMENT_INFO, type Pillar, type SajuReading } from '@/shared/saju';

const elementStyle = (e: District) => ({ '--el': tokens.district[e] }) as CSSProperties;

function Cell({ char, ko, element, me = false }: { char: string; ko: string; element: District; me?: boolean }) {
  return (
    <span className={`pillar__cell${me ? ' pillar__cell--me' : ''}`} style={elementStyle(element)}>
      <b>{char}</b>
      <small>
        {ko} · {ELEMENT_INFO[element].ko}
      </small>
      {me && <i className="pillar__me">나</i>}
    </span>
  );
}

function PillarColumn({ label, p, me = false }: { label: string; p: Pillar | null; me?: boolean }) {
  return (
    <div className="pillar">
      <span className="pillar__label">{label}</span>
      {p ? (
        <>
          <Cell char={p.stem} ko={p.ko[0]} element={p.stemElement} me={me} />
          <Cell char={p.branch} ko={p.ko[1]} element={p.branchElement} />
        </>
      ) : (
        <>
          <span className="pillar__cell pillar__cell--empty">?</span>
          <span className="pillar__cell pillar__cell--empty">?</span>
        </>
      )}
    </div>
  );
}

export function SajuCard({ reading, name, compact = false }: { reading: SajuReading; name?: string; compact?: boolean }) {
  const d = reading.district;
  const info = ELEMENT_INFO[d];
  const total = Object.values(reading.counts).reduce((a, b) => a + b, 0);
  return (
    <div className="saju-card">
      <div className="saju-card__head">
        <b>{name ? `${name}님의 사주` : '나의 사주'}</b>
        <small className="muted">
          양력 {reading.solarDate} · {reading.animal}띠{reading.timeKnown ? '' : ' · 태어난 시간 모름'}
        </small>
      </div>
      {/* 사주는 오른쪽부터 년·월·일·시 순서로 읽는다 */}
      <div className="pillars">
        <PillarColumn label="시주" p={reading.hour} />
        <PillarColumn label="일주" p={reading.day} me />
        <PillarColumn label="월주" p={reading.month} />
        <PillarColumn label="년주" p={reading.year} />
      </div>
      {!compact && (
        <div className="elements" aria-label="오행 개수">
          {DISTRICTS.map((e) => (
            <div key={e} className="element-row" style={elementStyle(e)}>
              <span>
                {ELEMENT_INFO[e].ko}({ELEMENT_INFO[e].hanja})
              </span>
              <span className="element-row__bar">
                <span style={{ width: `${(reading.counts[e] / Math.max(1, total)) * 100}%` }} />
              </span>
              <b>{reading.counts[e]}</b>
            </div>
          ))}
        </div>
      )}
      <div className="saju-result" style={elementStyle(d)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 작은 풍경 그림 */}
        <img src={assetUrl(`room.view.${d}`)} alt="" width={64} height={64} />
        <div>
          <b>
            일간 {reading.dayMaster.ko}({reading.dayMaster.stem}) · {info.ko}({info.hanja}) 기운 → {DISTRICT[d].short} 지역
          </b>
          <span>
            {info.line}. {DISTRICT[d].mood}
          </span>
        </div>
      </div>
      {!compact && reading.notes.map((n) => (
        <p key={n} className="muted saju-card__note">{n}</p>
      ))}
      <p className="muted saju-card__note">재미로 보는 사주예요. 성격이나 운명을 정하는 근거가 아니에요. 일간(태어난 날의 천간)의 오행으로 사는 지역을 정해요.</p>
    </div>
  );
}
