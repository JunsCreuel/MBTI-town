// 공유 카드 그리기와 공유하기 (운세 열매, 주민증). 1080×1350 (인스타 피드·스토리, 스레드에 그대로 올라간다).
// 휴대폰은 공유 창(인스타·스레드·카카오톡…)을 열고, 안 되면 그림을 저장한다.
import { assetUrl } from '@/assets/manifest';
import { tokens } from '@/design/tokens';

export const CARD_W = 1080;
export const CARD_H = 1350;

export const cardFont = (weight: number, size: number) => `${weight} ${size}px ${tokens.font.base}`;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** 너비에 맞춰 줄을 나눈다 (한글은 글자 단위로 끊는다) */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
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
  return lines;
}

/** 배경 그림을 깐 빈 카드 */
export async function blankCard(): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
  await Promise.all([document.fonts?.load(cardFont(800, 40)), document.fonts?.load(cardFont(500, 40))]);
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;
  try {
    ctx.drawImage(await loadImage(assetUrl('card.bg.default')), 0, 0, CARD_W, CARD_H);
  } catch {
    ctx.fillStyle = tokens.color.bg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  }
  return { canvas, ctx };
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지를 만들지 못했어요'))), 'image/png'));
}

/**
 * 공유 창을 연다 (인스타·스레드 등은 휴대폰 공유 창에서 고른다). 공유 창이 없으면 그림을 저장한다.
 * 돌려주는 값: 'shared' | 'saved' | 'cancelled'
 */
export async function shareImage(blob: Blob, fileName: string, title: string, url?: string): Promise<'shared' | 'saved' | 'cancelled'> {
  const file = new File([blob], fileName, { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title, ...(url ? { text: url } : {}) });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return 'cancelled';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return 'saved';
}

/** 스레드 글쓰기 창 (그림은 붙지 않으므로 저장한 그림을 직접 올린다) */
export function threadsIntent(text: string): string {
  return `https://www.threads.net/intent/post?text=${encodeURIComponent(text)}`;
}
