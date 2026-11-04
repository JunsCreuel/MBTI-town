'use client';

// 광장 전광판: 분수 북서쪽의 넓은 화면. 오행 대항전 순위 → 오늘의 토론 → 소식(서버 전체 공지·사주상담소)을 차례로 보여 준다.
// 서버 전체 공지가 오면 바로 소식 칸으로 넘어가 잠깐 띄운다. 글은 바뀔 때와 10초마다만 다시 그린다.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { tokens } from '@/design/tokens';
import type { AnnounceBroadcast } from '@/shared/announce';
import { contestLeader, timeLeftLabel } from '@/shared/contest';
import { DISTRICT } from '@/shared/districts';
import { groundHeightAt } from '@/shared/townMap';
import { cardFont, wrapText } from '@/lib/shareCard';
import { useTown } from './context';
import { boardNow, currentBoard, usePlazaBoard, type PlazaBoard } from './plazaBoard';

const S = tokens.scene;
export const PLAZA_SCREEN_KEY = 'prop.plaza.screen';
/** 화면 판 크기와 자리 (모델 plazaScreenParts의 틀 안쪽) */
const W = 6.9;
const H = 2.7;
const CENTER_Y = 1.7;
const FRONT_Z = 0.13;
const CW = 1280;
const CH = Math.round((CW * H) / W);
/** 한 칸을 보여 주는 시간 (ms), 공지를 띄워 두는 시간 */
const SLIDE_MS = 9000;
const NEWS_MS = 20000;

type Slide = 'contest' | 'debate' | 'news';
const SLIDES: Slide[] = ['contest', 'debate', 'news'];

const ink = tokens.color.surface;
const sub = S.signNeonSub;

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  const chars = [...text];
  while (chars.length && ctx.measureText(`${chars.join('')}…`).width > maxW) chars.pop();
  return `${chars.join('')}…`;
}

function header(ctx: CanvasRenderingContext2D, title: string, right: string, color: string) {
  ctx.fillStyle = S.signDark;
  ctx.fillRect(0, 0, CW, CH);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, CW, 10);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = color;
  ctx.font = cardFont(800, 44);
  ctx.fillText(title, 56, 80);
  ctx.textAlign = 'right';
  ctx.fillStyle = sub;
  ctx.font = cardFont(700, 30);
  ctx.fillText(right, CW - 56, 78);
  ctx.textAlign = 'left';
}

function drawContest(ctx: CanvasRenderingContext2D, b: PlazaBoard) {
  const now = boardNow();
  header(ctx, '오행 지역 대항전', `일요일 밤 9시 발표 · ${timeLeftLabel(new Date(b.standings.closesAt), now)} 남음`, tokens.color.gold);
  const rows = b.standings.districts;
  const top = Math.max(1, rows[0]?.score ?? 0);
  const leader = contestLeader(rows);
  const x0 = 56;
  const barX = 270;
  const barW = CW - barX - 230;
  rows.forEach((r, i) => {
    const y = 118 + i * 64;
    const color = tokens.district[r.district];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + 18, y + 22, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = S.signDark;
    ctx.font = cardFont(800, 22);
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), x0 + 18, y + 30);
    ctx.textAlign = 'left';
    ctx.fillStyle = ink;
    ctx.font = cardFont(800, 34);
    ctx.fillText(DISTRICT[r.district].short, x0 + 48, y + 34);
    if (r.district === leader) {
      const nameW = ctx.measureText(DISTRICT[r.district].short).width;
      ctx.fillStyle = tokens.color.gold;
      ctx.font = cardFont(800, 22);
      ctx.fillText('1위', x0 + 48 + nameW + 12, y + 32);
    }
    // 막대
    ctx.fillStyle = S.clubTileOff;
    ctx.beginPath();
    ctx.roundRect(barX, y + 6, barW, 32, 16);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(barX, y + 6, Math.max(r.score > 0 ? 32 : 0, (barW * r.score) / top), 32, 16);
    ctx.fill();
    ctx.textAlign = 'right';
    ctx.fillStyle = ink;
    ctx.font = cardFont(800, 32);
    ctx.fillText(`${r.score.toLocaleString('ko-KR')}점`, CW - 56, y + 34);
    ctx.textAlign = 'left';
  });
  ctx.fillStyle = sub;
  ctx.font = cardFont(600, 26);
  const lastWinner = b.last.winner ? `지난주 우승 ${DISTRICT[b.last.winner].short}` : '';
  const hint = rows.every((r) => r.score === 0) ? '낚시·열매·토론·출석·상가로 우리 지역 점수를 올려요!' : '낚시·열매·토론·출석·상가로 점수를 올려요';
  ctx.fillText(fit(ctx, [hint, lastWinner].filter(Boolean).join('   ·   '), CW - 112), 56, CH - 28);
}

const PHASE_LINE: Record<string, (b: NonNullable<PlazaBoard['debate']>) => string> = {
  writing: () => '논거 쓰는 중 · 저녁 6시 마감',
  voting: () => '관전 판정 중 · 밤 9시 발표',
  judging: () => '결과를 모으는 중',
  done: (d) => (d.winner === 'draw' ? '오늘은 비겼어요' : d.winner === 'a' ? `${d.a.label} 승!` : d.winner === 'b' ? `${d.b.label} 승!` : '결과 발표'),
};

function drawDebate(ctx: CanvasRenderingContext2D, b: PlazaBoard) {
  const d = b.debate;
  header(ctx, '오늘의 토론', '이긴 지역 +30점', tokens.color.sky);
  if (!d) {
    ctx.fillStyle = ink;
    ctx.font = cardFont(800, 48);
    ctx.fillText('광장 게시판에서 오늘의 토론에 참여해요', 56, 240);
    return;
  }
  // 두 지역
  const half = CW / 2;
  for (const [t, x] of [[d.a, half - 60], [d.b, half + 60]] as const) {
    ctx.textAlign = x < half ? 'right' : 'left';
    ctx.fillStyle = t.district ? tokens.district[t.district] : ink;
    ctx.font = cardFont(800, 58);
    ctx.fillText(t.label, x, 178);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = sub;
  ctx.font = cardFont(800, 40);
  ctx.fillText('vs', half, 174);
  ctx.fillStyle = ink;
  ctx.font = cardFont(700, 38);
  wrapText(ctx, d.topic, CW - 160, 2).forEach((l, i) => ctx.fillText(l, half, 262 + i * 52));
  ctx.fillStyle = tokens.color.gold;
  ctx.font = cardFont(800, 34);
  ctx.fillText((PHASE_LINE[d.phase] ?? PHASE_LINE.writing)(d), half, CH - 40);
  ctx.textAlign = 'left';
}

function drawNews(ctx: CanvasRenderingContext2D, news: AnnounceBroadcast | null) {
  header(ctx, news ? '방금 들어온 소식' : '광장 소식', '', news ? tokens.color.goldBright : tokens.district.water);
  ctx.textAlign = 'center';
  if (news) {
    ctx.fillStyle = ink;
    ctx.font = cardFont(800, 54);
    wrapText(ctx, news.text.replace(/^\(공지\)\s*/, ''), CW - 140, 3).forEach((l, i) => ctx.fillText(l, CW / 2, 210 + i * 72));
  } else {
    ctx.fillStyle = ink;
    ctx.font = cardFont(800, 52);
    ctx.fillText('부엉 도사의 사주·타로', CW / 2, 210);
    ctx.fillStyle = sub;
    ctx.font = cardFont(700, 34);
    ctx.fillText('광장 서쪽 보라색 천막 · 오늘의 카드 한 장 10코인', CW / 2, 280);
    ctx.fillText('낚시터에서 10만 번에 한 번, 황금 고래를 낚아 보세요', CW / 2, 340);
  }
  ctx.textAlign = 'left';
}

export function PlazaScreen() {
  const { map } = useTown();
  const place = useMemo(() => {
    const p = map.props.find((x) => x.key === PLAZA_SCREEN_KEY);
    return p ? { x: p.x, z: p.z, yaw: p.yaw, y: groundHeightAt(map, p.x, p.z) } : null;
  }, [map]);
  usePlazaBoard(!!place);
  const canvas = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = CW;
    c.height = CH;
    return c;
  }, []);
  const texture = useMemo(() => {
    if (!canvas) return null;
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  useEffect(() => () => texture?.dispose(), [texture]);
  const state = useRef({ slide: 0, slideAt: 0, news: null as AnnounceBroadcast | null, newsUntil: 0, drawnKey: '', drawnAt: 0 });

  // 서버 전체 공지가 오면 소식 칸에 띄운다
  useEffect(() => {
    const on = (e: Event) => {
      const b = (e as CustomEvent<AnnounceBroadcast>).detail;
      if (!b || typeof b.text !== 'string') return;
      const s = state.current;
      s.news = b;
      s.newsUntil = performance.now() + NEWS_MS;
      s.slide = SLIDES.indexOf('news');
      s.slideAt = performance.now();
    };
    window.addEventListener('scene:announce', on);
    // 글꼴을 읽으면 다시 그린다
    void document.fonts?.ready.then(() => {
      state.current.drawnKey = '';
    });
    return () => window.removeEventListener('scene:announce', on);
  }, []);

  useFrame(() => {
    if (!canvas || !texture) return;
    const t = performance.now();
    const s = state.current;
    const holding = s.news && t < s.newsUntil;
    if (!holding && t - s.slideAt > SLIDE_MS) {
      s.slide = (s.slide + 1) % SLIDES.length;
      s.slideAt = t;
      if (s.news && t >= s.newsUntil) s.news = null;
    }
    const b = currentBoard();
    const slide = SLIDES[s.slide];
    const key = `${slide}|${b?.serverNow ?? ''}|${s.news?.at ?? ''}`;
    if (key === s.drawnKey && t - s.drawnAt < 10_000) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!b && slide !== 'news') {
      header(ctx, 'SCENE 광장', '', tokens.color.gold);
      ctx.fillStyle = ink;
      ctx.font = cardFont(800, 48);
      ctx.fillText('소식을 불러오는 중…', 56, 240);
    } else if (slide === 'contest') drawContest(ctx, b!);
    else if (slide === 'debate') drawDebate(ctx, b!);
    else drawNews(ctx, s.news);
    texture.needsUpdate = true;
    s.drawnKey = key;
    s.drawnAt = t;
  });

  if (!place || !texture) return null;
  return (
    <group position={[place.x, place.y, place.z]} rotation={[0, place.yaw, 0]}>
      <mesh position={[0, CENTER_Y, FRONT_Z]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}
