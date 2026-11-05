'use client';

// 주민증: MBTI 마을에 집이 생기면 나온다. 닉네임 · 사는 마을 · 가입한 날짜 · 성향(네 글자 뜻) · 취미.
// 1080×1350 그림으로 만들어 인스타·스레드에 공유한다 (휴대폰 공유 창, 안 되면 저장).
import { useEffect, useState } from 'react';
import { MBTI, withMaxLightness } from '@/design/mbti';
import { tokens } from '@/design/tokens';
import type { AvatarColor } from '@/shared/avatar';
import { DISTRICT, type District, THEME, themeOf } from '@/shared/districts';
import { CARD_H, CARD_W, blankCard, canvasToBlob, cardFont, shareImage, threadsIntent } from '@/lib/shareCard';

export interface ResidentInfo {
  name: string;
  district: District;
  /** 동네 번호 (1 = 본섬) */
  hood: number;
  /** 가입한 날 YYYY-MM-DD */
  joinedAt: string;
  mbti: string | null;
  hobby: string;
  avatarColor: AvatarColor;
  /** 방 주소 (공유 글에 붙인다) */
  handle?: string;
}

const placeLabel = (r: ResidentInfo) => `${DISTRICT[r.district].name}${r.hood > 1 ? ` ${r.hood}동` : ''}`;
const dateLabel = (d: string) => `${d.slice(0, 4)}. ${Number(d.slice(5, 7))}. ${Number(d.slice(8, 10))}.`;

async function drawResidentCard(r: ResidentInfo, site: string): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = await blankCard();
  // 밝은 마을 색(탐험가 노랑 등)은 흰 바탕·흰 글자와 대비가 약해 진하게 쓴다
  const dc = withMaxLightness(tokens.district[r.district], 0.5);
  const ink = withMaxLightness(tokens.district[r.district], 0.4);
  // 카드 판
  const x0 = 90;
  const y0 = 220;
  const w = CARD_W - x0 * 2;
  const h = 900;
  ctx.shadowColor = tokens.color.shadow;
  ctx.shadowBlur = 44;
  ctx.fillStyle = tokens.color.surface;
  ctx.beginPath();
  ctx.roundRect(x0, y0, w, h, 44);
  ctx.fill();
  ctx.shadowBlur = 0;
  // 머리띠 (마을 색)
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x0, y0, w, h, 44);
  ctx.clip();
  ctx.fillStyle = dc;
  ctx.fillRect(x0, y0, w, 150);
  ctx.restore();
  ctx.fillStyle = tokens.color.accentText;
  ctx.font = cardFont(800, 52);
  ctx.textAlign = 'left';
  ctx.fillText('SCENE 주민증', x0 + 56, y0 + 95);
  ctx.font = cardFont(600, 30);
  ctx.textAlign = 'right';
  ctx.fillText(`${THEME[themeOf(r.district)].name} · ${THEME[themeOf(r.district)].place}`, x0 + w - 56, y0 + 92);

  // 얼굴 (캐릭터 몸 색)
  const fx = x0 + 190;
  const fy = y0 + 420;
  ctx.fillStyle = tokens.avatar[r.avatarColor] ?? tokens.avatar.mint;
  ctx.beginPath();
  ctx.roundRect(fx - 125, fy - 150, 250, 300, 36);
  ctx.fill();
  ctx.fillStyle = '#FFE1C8';
  ctx.beginPath();
  ctx.arc(fx, fy - 10, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6E4126';
  ctx.beginPath();
  ctx.arc(fx, fy - 30, 96, Math.PI * 1.02, Math.PI * 1.98);
  ctx.fill();
  ctx.fillStyle = '#2A2130';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(fx + s * 32, fy - 4, 9, 13, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#FF9DA6';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(fx + s * 55, fy + 22, 16, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 항목
  const rows: [string, string][] = [
    ['닉네임', r.name],
    ['사는 마을', placeLabel(r)],
    ['가입한 날짜', dateLabel(r.joinedAt)],
    // 사는 마을이 곧 MBTI라 유형을 한 번 더 쓰지 않고 네 글자 뜻을 쓴다
    ['성향', MBTI[r.district].label],
    ['취미', r.hobby || '찾는 중'],
  ];
  const lx = x0 + 380;
  ctx.textAlign = 'left';
  const maxW = w - (lx - x0) - 56;
  rows.forEach(([k, v], i) => {
    const y = y0 + 235 + i * 106;
    ctx.fillStyle = tokens.color.textSub;
    ctx.font = cardFont(600, 28);
    ctx.fillText(k, lx, y);
    ctx.fillStyle = k === '사는 마을' ? ink : tokens.color.text;
    // 길면 글자를 줄이고, 그래도 넘치면 말줄임
    let size = 44;
    ctx.font = cardFont(800, size);
    while (ctx.measureText(v).width > maxW && size > 30) ctx.font = cardFont(800, (size -= 2));
    let text = v;
    while (ctx.measureText(text).width > maxW && text.length > 1) text = text.slice(0, -1);
    ctx.fillText(text === v ? v : `${text}…`, lx, y + 52);
  });
  // 아래 줄
  ctx.strokeStyle = tokens.color.border;
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(x0 + 56, y0 + h - 110);
  ctx.lineTo(x0 + w - 56, y0 + h - 110);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = tokens.color.textSub;
  ctx.font = cardFont(600, 30);
  ctx.textAlign = 'center';
  ctx.fillText('MBTI 16개 마을이 모인 섬', CARD_W / 2, y0 + h - 52);

  ctx.fillStyle = tokens.color.text;
  ctx.font = cardFont(800, 40);
  ctx.fillText('너는 어느 동네 주민이야?', CARD_W / 2, 150);
  ctx.font = cardFont(700, 36);
  ctx.fillText(site, CARD_W / 2, CARD_H - 70);
  return canvas;
}

export function ResidentCard({ info }: { info: ResidentInfo }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const { name, district, hood, joinedAt, mbti, hobby, avatarColor } = info;

  useEffect(() => {
    let made: string | null = null;
    let alive = true;
    drawResidentCard({ name, district, hood, joinedAt, mbti, hobby, avatarColor }, window.location.host)
      .then(canvasToBlob)
      .then((b) => {
        if (!alive) return;
        made = URL.createObjectURL(b);
        setBlob(b);
        setUrl(made);
      })
      .catch(() => setNote('주민증을 그리지 못했어요.'));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [name, district, hood, joinedAt, mbti, hobby, avatarColor]);

  const shareText = `나는 SCENE ${placeLabel(info)} 주민! 너는 어느 동네 주민이야?`;

  async function share() {
    if (!blob) return;
    const r = await shareImage(blob, 'scene-resident-card.png', 'SCENE 주민증', `${shareText} ${window.location.origin}`);
    if (r === 'saved') setNote('주민증을 저장했어요. 인스타 스토리·스레드에 올려 보세요!');
  }

  return (
    <div className="resident">
      {url ? <img className="resident__card" src={url} alt={`${name}의 주민증`} width={CARD_W} height={CARD_H} /> : <div className="resident__placeholder"><div className="loader" aria-hidden /></div>}
      <div className="resident__actions">
        <button className="btn-primary btn-primary--inline" onClick={share} disabled={!blob}>
          인스타·스레드에 공유
        </button>
        {url && (
          <a className="btn-secondary" href={url} download="scene-resident-card.png">
            이미지 저장
          </a>
        )}
        <a className="btn-secondary" href={threadsIntent(`${shareText} ${typeof window !== 'undefined' ? window.location.origin : ''}`)} target="_blank" rel="noreferrer">
          스레드에 글쓰기
        </a>
      </div>
      {note && <p className="muted" role="status">{note}</p>}
    </div>
  );
}
