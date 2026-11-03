// 결과 카드 1080×1350 (PROJECT_GUIDE.md 14장). 배경만 에셋이고 글자는 코드로 그린다.
import { assetUrl } from '@/assets/manifest';
import { tokens } from '@/design/tokens';
import { clip, type Side } from '@/shared/debate';
import type { DebateView } from './api';
import { teamInk } from './teamColor';

export const CARD_W = 1080;
export const CARD_H = 1350;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** 너비에 맞춰 줄을 나눈다 (한글은 글자 단위로 끊는다) */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of [...text]) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines.push(line);
      line = ch.trimStart();
      if (lines.length === maxLines) break;
    } else {
      line += ch;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && lines.join('').length < text.length) {
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…';
  }
  return lines;
}

export async function drawResultCard(view: DebateView, siteAddress: string): Promise<HTMLCanvasElement> {
  const r = view.result;
  if (!r) throw new Error('결과가 아직 없습니다');
  const font = (weight: number, size: number) => `${weight} ${size}px ${tokens.font.base}`;
  await Promise.all([document.fonts?.load(font(800, 40)), document.fonts?.load(font(500, 40))]);

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(await loadImage(assetUrl('card.bg.default')), 0, 0, CARD_W, CARD_H);

  // 흰 판
  const px = 72;
  const py = 150;
  const pw = CARD_W - px * 2;
  ctx.fillStyle = tokens.color.surface;
  ctx.shadowColor = tokens.color.shadow;
  ctx.shadowBlur = 40;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, 1030, 48);
  ctx.fill();
  ctx.shadowBlur = 0;

  const cx = CARD_W / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const m = view.match;
  const colorOf = (s: Side) => teamInk(s === 'a' ? m.teamA : m.teamB, s);
  const labelOf = (s: Side) => (s === 'a' ? m.teamA.label : m.teamB.label);

  ctx.fillStyle = tokens.color.accent;
  ctx.font = font(700, 34);
  ctx.fillText(`SCENE · 오늘의 토론 · ${m.key.slice(5, 10).replace('-', '/')}`, cx, py + 90);

  // 대진: 두 팀 이름을 각자 색으로
  ctx.font = font(800, 64);
  const vs = '  vs  ';
  const wa = ctx.measureText(labelOf('a')).width;
  const wv = ctx.measureText(vs).width;
  const wb = ctx.measureText(labelOf('b')).width;
  let x = cx - (wa + wv + wb) / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = colorOf('a');
  ctx.fillText(labelOf('a'), x, py + 190);
  x += wa;
  ctx.fillStyle = tokens.color.textSub;
  ctx.fillText(vs, x, py + 190);
  x += wv;
  ctx.fillStyle = colorOf('b');
  ctx.fillText(labelOf('b'), x, py + 190);
  ctx.textAlign = 'center';

  ctx.fillStyle = tokens.color.text;
  ctx.font = font(600, 40);
  wrap(ctx, m.topic.title, pw - 120, 2).forEach((l, i) => ctx.fillText(l, cx, py + 270 + i * 54));

  // 승리 팀과 점수
  ctx.font = font(800, 104);
  if (r.winner === 'draw') {
    ctx.fillStyle = tokens.color.text;
    ctx.fillText('무승부', cx, py + 500);
  } else {
    ctx.fillStyle = colorOf(r.winner);
    ctx.fillText(`${labelOf(r.winner)} 승리!`, cx, py + 500);
  }
  ctx.font = font(700, 52);
  ctx.fillStyle = tokens.color.textSub;
  ctx.fillText(`${Math.round(r.vote.a)}% : ${Math.round(r.vote.b)}%`, cx, py + 580);

  // 결정타 논거
  if (r.decisive) {
    ctx.fillStyle = tokens.color.bg;
    ctx.beginPath();
    ctx.roundRect(px + 60, py + 650, pw - 120, 250, 32);
    ctx.fill();
    ctx.fillStyle = colorOf(r.decisive.side);
    ctx.font = font(700, 32);
    ctx.fillText(`결정타 논거 · ${r.decisive.picks}명이 골랐어요`, cx, py + 715);
    ctx.fillStyle = tokens.color.text;
    ctx.font = font(600, 42);
    wrap(ctx, `“${clip(r.decisive.body)}”`, pw - 200, 2).forEach((l, i) => ctx.fillText(l, cx, py + 790 + i * 58));
  }

  ctx.fillStyle = tokens.color.textSub;
  ctx.font = font(500, 32);
  const judging = r.byDistrict ? `관전 지역 ${Object.keys(r.byDistrict).length}곳` : `관전 유형 ${Object.keys(r.byType ?? {}).length}개`;
  ctx.fillText(`${judging} · ${r.voters}명이 판정했어요`, cx, py + 975);

  // 서비스 주소
  ctx.fillStyle = tokens.color.text;
  ctx.font = font(700, 36);
  ctx.fillText(siteAddress, cx, CARD_H - 70);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지를 만들지 못했어요'))), 'image/png'));
}
