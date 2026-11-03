'use client';

// 마을 놀거리 화면: 나무 자리 찾기, 운세 열매 카드(공유), 바구니(도감).
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { tokens } from '@/design/tokens';
import type { FishResult, PickResult, PlayState } from '@/server/scene/service';
import { DISTRICTS, isDistrict, type District } from '@/shared/districts';
import { FISH, FORTUNE_FRUIT, FRUITS, type FishDef, type FortuneFruit } from '@/shared/play';
import { parseSpot, type Spot } from '@/shared/protocol';
import type { TownMap } from '@/shared/townMap';
import { CARD_H, CARD_W, blankCard, canvasToBlob, cardFont, shareImage, wrapText } from '@/lib/shareCard';
import { Sheet } from '../app/Sheet';

export interface TreeInfo {
  /** 서버에 보내는 자리 이름 ("fruit.wood.0", "fortune") */
  spot: string;
  kind: 'fruit' | 'fortune';
  district: District | null;
  x: number;
  z: number;
}

/** 맵에 놓인 열매 나무(지역마다 놓인 순서대로 번호)와 운세 나무 */
export function treesOf(map: TownMap): TreeInfo[] {
  const seen: Partial<Record<District, number>> = {};
  const out: TreeInfo[] = [];
  for (const p of map.props) {
    if (p.key === 'prop.plaza.fortune_tree') out.push({ spot: 'fortune', kind: 'fortune', district: null, x: p.x, z: p.z });
    const m = /^prop\.fruit\.([a-z]+)$/.exec(p.key);
    if (m && isDistrict(m[1])) {
      const n = seen[m[1]] ?? 0;
      seen[m[1]] = n + 1;
      out.push({ spot: `fruit.${m[1]}.${n}`, kind: 'fruit', district: m[1], x: p.x, z: p.z });
    }
  }
  return out;
}

export type { FishResult, PickResult, PlayState };

/** 클럽 무대 반지름 (칸): 이 안에 서면 저절로 춤춘다 */
export const CLUB_FLOOR_RADIUS = 4.4;

/** 비콘: 본섬 광장에서는 놀이터로 가는 곳, 놀이터에서는 광장으로 돌아가는 곳 */
export function beaconsOf(map: TownMap): { kind: Spot; x: number; z: number }[] {
  return map.props.flatMap((p) => {
    const kind = parseSpot(p.key.replace('prop.plaza.beacon_', ''));
    return p.key.startsWith('prop.plaza.beacon_') && kind ? [{ kind, x: p.x, z: p.z }] : [];
  });
}

const RARITY: Record<FishDef['rarity'], { label: string; color: string }> = {
  common: { label: '흔해요', color: tokens.color.textSub },
  rare: { label: '드물어요', color: tokens.color.sky },
  legend: { label: '전설', color: tokens.emotion.joy },
  junk: { label: '꽝', color: tokens.color.lose },
};

/**
 * 낚시: 찌를 던지고 → 기다리다 → 입질! → 잡은 것을 보여 준다. 결과는 던지는 순간 서버가 정하고, 화면은 기다리는 연출만 한다.
 */
export function FishingPanel({
  onCast, onCaught, onClose,
}: {
  onCast: () => Promise<FishResult>;
  onCaught: (r: FishResult) => void;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<'wait' | 'bite' | 'caught' | 'error'>('wait');
  const [result, setResult] = useState<FishResult | null>(null);
  const [error, setError] = useState('');
  const round = useRef(0);

  async function cast() {
    const my = ++round.current;
    setStage('wait');
    setResult(null);
    const wait = 1600 + Math.random() * 2200;
    try {
      const [r] = await Promise.all([onCast(), new Promise((res) => setTimeout(res, wait))]);
      if (my !== round.current) return;
      setStage('bite');
      setTimeout(() => {
        if (my !== round.current) return;
        setResult(r);
        setStage('caught');
        onCaught(r);
      }, 700);
    } catch (e) {
      if (my !== round.current) return;
      setError(e instanceof Error ? e.message : '낚시를 못 했어요');
      setStage('error');
    }
  }

  useEffect(() => {
    void cast();
    return () => {
      round.current++;
    };
    // 처음 열 때 한 번 던진다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fishing" role="dialog" aria-label="낚시">
      {stage === 'wait' && (
        <>
          <span className="fishing__bobber" aria-hidden />
          <p className="fishing__text">찌를 던졌어요… 조용히 기다리는 중</p>
        </>
      )}
      {stage === 'bite' && <p className="fishing__text fishing__text--bite">앗! 물었다!</p>}
      {stage === 'caught' && result && (
        <>
          <span className="fishing__fish" style={{ background: result.fish.color }} aria-hidden />
          <p className="fishing__name">
            {result.fish.name}
            {result.size > 0 && <small> {result.size}cm</small>}
          </p>
          <p className="fishing__meta">
            <span style={{ color: RARITY[result.fish.rarity].color }}>{RARITY[result.fish.rarity].label}</span> · 도감 {result.count}마리째 · 오늘 {result.left}번 남음
          </p>
        </>
      )}
      {stage === 'error' && <p className="fishing__text">{error}</p>}
      <div className="fishing__actions">
        {(stage === 'caught' || stage === 'error') && result && result.left > 0 && (
          <button className="btn-primary btn-primary--inline" onClick={() => void cast()}>
            또 던지기
          </button>
        )}
        <button className="btn-secondary" onClick={onClose}>
          그만하기
        </button>
      </div>
    </div>
  );
}

const GRADE_COLOR: Record<FortuneFruit['grade'], string> = {
  대길: tokens.emotion.joy,
  길: tokens.color.accent,
  소길: tokens.color.sky,
  반짝: tokens.emotion.flutter,
  쉼표: tokens.emotion.calm,
};

async function drawFortuneCard(f: FortuneFruit, name: string, district: District | null, date: string, site: string) {
  const { canvas, ctx } = await blankCard();
  const px = 90;
  const pw = CARD_W - px * 2;
  ctx.fillStyle = tokens.color.surface;
  ctx.shadowColor = tokens.color.shadow;
  ctx.shadowBlur = 40;
  ctx.beginPath();
  ctx.roundRect(px, 170, pw, 960, 48);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.textAlign = 'center';
  const cx = CARD_W / 2;
  ctx.fillStyle = tokens.color.textSub;
  ctx.font = cardFont(600, 36);
  ctx.fillText(`${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일 · 오늘의 운세 열매`, cx, 270);
  // 황금 열매
  ctx.fillStyle = FORTUNE_FRUIT.color;
  ctx.beginPath();
  ctx.arc(cx, 430, 95, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgb(255 255 255 / 0.55)';
  ctx.beginPath();
  ctx.arc(cx - 32, 395, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tokens.color.text;
  ctx.font = cardFont(800, 96);
  ctx.fillStyle = GRADE_COLOR[f.grade];
  ctx.fillText(f.grade, cx, 640);
  ctx.fillStyle = tokens.color.text;
  ctx.font = cardFont(700, 48);
  wrapText(ctx, f.line, pw - 140, 3).forEach((l, i) => ctx.fillText(l, cx, 760 + i * 68));
  ctx.fillStyle = district ? tokens.district[district] : tokens.color.accent;
  ctx.font = cardFont(700, 38);
  ctx.fillText(`${name} 주민이 땄어요`, cx, 1050);
  ctx.fillStyle = tokens.color.text;
  ctx.font = cardFont(700, 36);
  ctx.fillText(site, cx, CARD_H - 70);
  return canvas;
}

/** 운세 열매: 결과와 공유 카드 */
export function FortuneFruitSheet({
  fortune, name, district, day, onClose,
}: {
  fortune: FortuneFruit;
  name: string;
  district: District | null;
  day: string;
  onClose: () => void;
}) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => {
    let made: string | null = null;
    drawFortuneCard(fortune, name, district, day, window.location.host)
      .then(canvasToBlob)
      .then((b) => {
        made = URL.createObjectURL(b);
        setBlob(b);
        setUrl(made);
      })
      .catch(() => setNote('카드를 만들지 못했어요.'));
    return () => {
      if (made) URL.revokeObjectURL(made);
    };
  }, [fortune, name, district, day]);

  async function share() {
    if (!blob) return;
    const r = await shareImage(blob, `scene-fortune-${day}.png`, '오늘의 운세 열매', `${window.location.origin}/village`);
    if (r === 'saved') setNote('카드를 저장했어요. 인스타·스레드에 올려 보세요!');
  }

  return (
    <Sheet title="오늘의 운세 열매" onClose={onClose}>
      <div className="fortune-fruit">
        <p className="fortune-fruit__grade" style={{ '--grade': GRADE_COLOR[fortune.grade] } as CSSProperties}>
          {fortune.grade}
        </p>
        <p className="fortune-fruit__line">{fortune.line}</p>
        {url ? <img className="fortune-fruit__card" src={url} alt="운세 열매 카드" width={CARD_W} height={CARD_H} /> : <div className="loader" aria-hidden />}
        <button className="btn-primary" onClick={share} disabled={!blob}>
          공유하기 (인스타·스레드)
        </button>
        {note && <p className="muted" role="status">{note}</p>}
        <p className="muted fortune-fruit__note">재미로 보는 운세예요. 운세 나무는 하루에 한 번 열매를 줘요.</p>
      </div>
    </Sheet>
  );
}

/** 바구니: 모은 열매와 물고기 도감 */
export function BasketSheet({ state, onClose }: { state: PlayState | null; onClose: () => void }) {
  const fruits = [...DISTRICTS.map((d) => FRUITS[d]), FORTUNE_FRUIT];
  const caught = FISH.filter((f) => state?.fish[f.id]).length;
  return (
    <Sheet title="바구니와 도감" onClose={onClose}>
      {!state ? (
        <div className="loader" aria-hidden />
      ) : (
        <div className="basket">
          <h3 className="section-title">열매</h3>
          <ul className="basket__grid">
            {fruits.map((f) => (
              <li key={f.id} className="basket__item">
                <span className="basket__dot" style={{ background: f.color }} aria-hidden />
                <span className="basket__name">{f.name}</span>
                <b>{state.fruits[f.id] ?? 0}</b>
              </li>
            ))}
          </ul>
          <h3 className="section-title">
            물고기 도감 <span className="muted">{caught}/{FISH.length}</span>
          </h3>
          <ul className="basket__grid">
            {FISH.map((f) => {
              const n = state.fish[f.id] ?? 0;
              return (
                <li key={f.id} className={`basket__item${n ? '' : ' basket__item--unknown'}`}>
                  <span className="basket__dot" style={{ background: n ? f.color : tokens.color.border }} aria-hidden />
                  <span className="basket__name">{n ? f.name : '???'}</span>
                  {n > 0 && <b>{n}</b>}
                </li>
              );
            })}
          </ul>
          <p className="muted">낚시는 광장의 낚시터 비콘으로 가서 해요. 오늘 남은 낚시 {state.fishLeft}번.</p>
        </div>
      )}
    </Sheet>
  );
}
