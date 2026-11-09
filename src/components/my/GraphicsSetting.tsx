'use client';

// MY → 그래픽: 자동 / 가볍게 / 선명하게 (이 기기에만 저장). 바꾸면 화면을 다시 불러와 적용한다.
import { useEffect, useState } from 'react';
import { GRAPHICS_PREFS, graphicsPref, lowQuality, setGraphicsPref, type GraphicsPref } from '@/lib/quality';

const LABEL: Record<GraphicsPref, string> = { auto: '자동', low: '가볍게', high: '선명하게' };

export function GraphicsSetting() {
  const [pref, setPref] = useState<GraphicsPref | null>(null);
  const [low, setLow] = useState(false);
  useEffect(() => {
    setPref(graphicsPref());
    setLow(lowQuality());
  }, []);
  if (!pref) return null;
  return (
    <section className="section card">
      <h2 className="section-title">그래픽</h2>
      <p className="muted">
        휴대폰에서 버벅이면 가볍게로 바꿔 보세요. 그림자·해상도를 줄여 부드럽게 움직여요. 이 기기에만 저장돼요.
        {pref === 'auto' && ` 지금은 ${low ? '가볍게' : '선명하게'}로 보고 있어요.`}
      </p>
      <div className="chips" role="radiogroup" aria-label="그래픽">
        {GRAPHICS_PREFS.map((p) => (
          <button
            key={p}
            role="radio"
            aria-checked={pref === p}
            className={`chip${pref === p ? ' chip--on' : ''}`}
            onClick={() => {
              if (p === pref) return;
              setGraphicsPref(p);
              window.location.reload();
            }}
          >
            {LABEL[p]}
          </button>
        ))}
      </div>
    </section>
  );
}
