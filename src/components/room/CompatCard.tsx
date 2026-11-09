'use client';

// MBTI 궁합 카드: 친구 방에 놀러 가서 두 사람 유형으로 본다. 이미지로 저장·공유할 수 있다 (스레드·인스타 세로 4:5).
import { useState } from 'react';
import { MBTI, mbtiColor, type MbtiType } from '@/design/mbti';
import { tokens } from '@/design/tokens';
import { compat } from '@/shared/compat';
import { Icon } from '../app/Icon';

export interface CompatPerson {
  name: string;
  mbti: MbtiType;
}

const C = tokens.color;
const FONT = tokens.font.base;

/** 카드 그림 (1080 × 1350) */
function drawCard(me: CompatPerson, them: CompatPerson): HTMLCanvasElement {
  const r = compat(me.mbti, them.mbti);
  const W = 1080;
  const H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  g.fillStyle = C.bg;
  g.fillRect(0, 0, W, H);
  // 카드
  const pad = 70;
  g.fillStyle = C.surface;
  g.beginPath();
  g.roundRect(pad, pad, W - pad * 2, H - pad * 2, 48);
  g.fill();
  g.textAlign = 'center';
  g.fillStyle = C.textSub;
  g.font = `600 40px ${FONT}`;
  g.fillText('MBTI 궁합', W / 2, 210);
  // 두 사람
  const person = (p: CompatPerson, x: number) => {
    g.fillStyle = mbtiColor(p.mbti);
    g.beginPath();
    g.arc(x, 400, 120, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = C.accentText;
    g.font = `800 64px ${FONT}`;
    g.fillText(p.mbti, x, 422);
    g.fillStyle = C.text;
    g.font = `700 44px ${FONT}`;
    g.fillText(p.name.length > 8 ? `${p.name.slice(0, 8)}…` : p.name, x, 590);
    g.fillStyle = C.textSub;
    g.font = `500 34px ${FONT}`;
    g.fillText(MBTI[p.mbti].name, x, 640);
  };
  person(me, 330);
  person(them, 750);
  g.fillStyle = C.danger;
  g.font = `700 72px ${FONT}`;
  g.fillText('♥', W / 2, 425);
  // 하트·제목
  g.font = `400 72px ${FONT}`;
  g.fillText('♥'.repeat(r.hearts) + '♡'.repeat(5 - r.hearts), W / 2, 790);
  g.fillStyle = C.text;
  g.font = `800 64px ${FONT}`;
  g.fillText(r.title, W / 2, 890);
  // 풀이 (줄 바꿈)
  g.font = `500 38px ${FONT}`;
  g.fillStyle = C.text;
  const lines: string[] = [];
  let line = '';
  for (const word of r.text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && g.measureText(next).width > W - pad * 2 - 120) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  lines.slice(0, 4).forEach((l, i) => g.fillText(l, W / 2, 980 + i * 56));
  g.fillStyle = C.accentInk;
  g.font = `700 36px ${FONT}`;
  g.fillText(`같이 해 보기: ${r.tip}`, W / 2, 1200);
  g.fillStyle = C.textSub;
  g.font = `600 30px ${FONT}`;
  g.fillText('MBTI 타운', W / 2, H - pad - 30);
  return cv;
}

export function CompatCard({ me, them }: { me: CompatPerson; them: CompatPerson }) {
  const r = compat(me.mbti, them.mbti);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const blob = await new Promise<Blob | null>((res) => drawCard(me, them).toBlob(res, 'image/png'));
      if (!blob) return;
      const file = new File([blob], `mbti-${me.mbti}-${them.mbti}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'MBTI 궁합' }).catch(() => {});
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="compat">
      <div className="compat__pair">
        {[me, them].map((p, i) => (
          <div key={i} className="compat__person">
            <span className="compat__badge" style={{ background: mbtiColor(p.mbti) }}>{p.mbti}</span>
            <strong>{p.name}</strong>
            <span className="muted">{MBTI[p.mbti].name}</span>
          </div>
        ))}
      </div>
      <p className="compat__hearts" aria-label={`하트 ${r.hearts}개`}>
        {'♥'.repeat(r.hearts)}
        <span className="compat__empty">{'♡'.repeat(5 - r.hearts)}</span>
      </p>
      <h3 className="compat__title">{r.title}</h3>
      <p className="compat__text">{r.text}</p>
      <p className="compat__tip">같이 해 보기: {r.tip}</p>
      <button className="btn-primary" onClick={save} disabled={busy}>
        <Icon name="share" size={18} /> 이미지로 저장
      </button>
    </div>
  );
}
