'use client';

// 사주상담소 (부엉 도사): 복채(코인)를 내고 오늘·내일·이번 주·이번 달 풀이를 본다. 같은 기간은 다시 봐도 무료.
// 상세 풀이는 사주 이용권으로 본다 (유료 결제는 준비 중). 풀이는 서버가 내 사주로 만든다 (src/shared/sajuReading.ts).
import { useEffect, useState } from 'react';
import { call, errorMessage } from '@/lib/api';
import type { SajuOffice } from '@/server/scene/service';
import { SAJU_KINDS, SAJU_KIND_NAME, type SajuKind, type SajuResult } from '@/shared/sajuReading';
import { Sheet } from '../app/Sheet';
import { ItemIcon } from '../app/Inventory';
import { SAJU_NAME } from './npc';
import { sajuNpcState } from './SajuNpc';

type ReadResponse = { reading: SajuResult; office: SajuOffice; paid: number; usedTicket: boolean };

export function SajuSheet({ onClose }: { onClose: () => void }) {
  const [office, setOffice] = useState<SajuOffice | null>(null);
  const [reading, setReading] = useState<SajuResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    sajuNpcState.talking = true;
    call<SajuOffice>('GET', '/api/saju')
      .then(setOffice)
      .catch((e) => setNote(errorMessage(e)));
    return () => {
      sajuNpcState.talking = false;
    };
  }, []);

  async function read(kind: SajuKind | 'premium', useTicket = false) {
    setBusy(true);
    setNote(null);
    try {
      const r = await call<ReadResponse>('POST', '/api/saju', { kind, useTicket });
      setOffice(r.office);
      setReading(r.reading);
      if (r.paid) setNote(`복채 ${r.paid}코인을 냈어요.`);
      else if (r.usedTicket) setNote('사주 이용권 한 장을 썼어요.');
    } catch (e) {
      setNote(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={reading ? SAJU_KIND_NAME[reading.kind] : `${SAJU_NAME}의 사주상담소`} onClose={onClose}>
      <div className="saju">
        {reading ? (
          <ReadingView reading={reading} onBack={() => setReading(null)} />
        ) : (
          <>
            <p className="bar-line">
              <b>{SAJU_NAME}</b> 어서 오시게. 복채를 내면 자네 사주로 앞날을 풀어 주지.
            </p>
            {office && (
              <p className="saju__wallet">
                코인 <b>{office.coins.toLocaleString('ko-KR')}</b> · 사주 이용권 <b>{office.tickets}</b>장
              </p>
            )}
            <div className="saju__menu">
              {SAJU_KINDS.map((k) => (
                <button key={k} className="saju__pick" disabled={busy || !office} onClick={() => void read(k)}>
                  {SAJU_KIND_NAME[k]} <span className="saju__fee">{office?.seen[k] ? '다시 보기' : `${office?.fee[k] ?? ''}코인`}</span>
                </button>
              ))}
            </div>
            <div className="saju__premium">
              <p className="saju__premium-title">
                <ItemIcon kind="ticket" id="saju" size={28} /> 상세 사주풀이
              </p>
              <p className="muted">타고난 기운·오행 균형·올해 흐름·연애·재물·일까지 자세히 풀어 줘요.</p>
              {office?.seen.premium ? (
                <button className="btn-primary" disabled={busy} onClick={() => void read('premium')}>
                  상세 풀이 다시 보기
                </button>
              ) : (
                <>
                  <button className="btn-primary" disabled={busy || !office || office.tickets < 1} onClick={() => void read('premium', true)}>
                    이용권으로 보기 ({office?.tickets ?? 0}장)
                  </button>
                  <button className="btn-secondary" disabled>
                    {office?.premiumPriceLabel ?? ''} 결제하고 보기 (준비 중)
                  </button>
                </>
              )}
            </div>
          </>
        )}
        {note && (
          <p className="notice" role="status">
            {note}
          </p>
        )}
      </div>
    </Sheet>
  );
}

function ReadingView({ reading, onBack }: { reading: SajuResult; onBack: () => void }) {
  return (
    <article className="saju-reading">
      <p className="muted saju-reading__period">{reading.period}</p>
      <h3 className="saju-reading__title">{reading.title}</h3>
      {reading.stars > 0 && (
        <p className="saju-reading__stars" aria-label={`별 다섯 개 중 ${reading.stars}개`}>
          {'★'.repeat(reading.stars)}
          <span>{'★'.repeat(5 - reading.stars)}</span>
        </p>
      )}
      <p className="saju-reading__summary">{reading.summary}</p>
      {reading.sections.map((s) => (
        <section key={s.title} className="saju-reading__section">
          <h4>{s.title}</h4>
          <p>{s.text}</p>
        </section>
      ))}
      <dl className="saju-reading__lucky">
        <div>
          <dt>행운의 색</dt>
          <dd>{reading.lucky.color}</dd>
        </div>
        <div>
          <dt>숫자</dt>
          <dd>{reading.lucky.number}</dd>
        </div>
        <div>
          <dt>방향</dt>
          <dd>{reading.lucky.direction}</dd>
        </div>
        <div>
          <dt>소품</dt>
          <dd>{reading.lucky.item}</dd>
        </div>
      </dl>
      <p className="muted saju-reading__note">재미로 보는 풀이예요. 좋은 말만 챙겨 가세요.</p>
      <button className="btn-secondary" onClick={onBack}>
        다른 풀이 보기
      </button>
    </article>
  );
}
