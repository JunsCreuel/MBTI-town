'use client';

// EXPLORE: 마을 (PROJECT_GUIDE.md 3, 4장). 다섯 거주 지역과 중앙광장을 지도에서 고른다.
// 지도는 마을에서 전체 지도를 켰을 때와 같은 3D 화면(ExploreMap). 3D를 못 쓰면 그림 지도(VillageMap)를 보인다.
// 중앙광장: 새로 온 주민과 오늘의 토론 이벤트. 지역: 그 지역의 공개 방.
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { tokens } from '@/design/tokens';
import { call } from '@/lib/api';
import type { DebateView } from '@/server/debate/service';
import type { RoomCard } from '@/server/scene/service';
import { DISTRICT, DISTRICTS, type District, THEME } from '@/shared/districts';
import { Guide } from '../app/Guide';
import { Icon } from '../app/Icon';
import { TabBar } from '../app/TabBar';

const ExploreMap = dynamic(() => import('./ExploreMap'), {
  ssr: false,
  loading: () => (
    <div className="explore-map">
      <div className="explore-map__loading" aria-hidden>
        <div className="loader" />
      </div>
    </div>
  ),
});

/** WebGL(3D)을 쓸 수 있는지 */
function canUse3d(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

interface ExploreData {
  rooms: RoomCard[];
  newcomers: RoomCard[];
  counts: Partial<Record<District, number>>;
}

interface Friends {
  friends: RoomCard[];
  received: RoomCard[];
  sent: RoomCard[];
}

// 지도: 가운데 광장, 둘레에 다섯 지역 (북쪽부터 시계 방향 목·화·토·금·수)
const CX = 180;
const CY = 150;
const POS = Object.fromEntries(
  DISTRICTS.map((d, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / DISTRICTS.length;
    return [d, { x: CX + Math.cos(a) * 108, y: CY + Math.sin(a) * 98 }];
  }),
) as Record<District, { x: number; y: number }>;

function VillageMap({ selected, counts, onSelect }: {
  selected: District | 'plaza';
  counts: Partial<Record<District, number>>;
  onSelect: (d: District | 'plaza') => void;
}) {
  return (
    <svg className="village-map" viewBox="0 0 360 300" role="group" aria-label="마을 지도">
      <defs>
        <radialGradient id="sea" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={tokens.color.skySoft} />
          <stop offset="100%" stopColor={tokens.color.bgAlt} />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="360" height="300" rx="24" fill="url(#sea)" />
      {DISTRICTS.map((d) => (
        <line key={d} x1={CX} y1={CY} x2={POS[d].x} y2={POS[d].y} stroke={tokens.color.border} strokeWidth="6" strokeLinecap="round" strokeDasharray="2 10" />
      ))}
      {DISTRICTS.map((d) => {
        const p = POS[d];
        const on = selected === d;
        return (
          <g
            key={d}
            className="village-map__district"
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={`${DISTRICT[d].name}, 주민 ${counts[d] ?? 0}명`}
            onClick={() => onSelect(d)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(d)}
          >
            <ellipse cx={p.x} cy={p.y} rx={on ? 64 : 58} ry={on ? 46 : 42} fill={tokens.district[d]} opacity={on ? 0.9 : 0.55} />
            {[-22, 0, 22].map((dx, k) => (
              <g key={k} transform={`translate(${p.x + dx - 7}, ${p.y - 22 + (k % 2) * 6})`}>
                <rect x="0" y="6" width="14" height="10" rx="2" fill={tokens.color.surface} />
                <path d="M-2 7 L7 0 L16 7 Z" fill={tokens.color.surface} opacity="0.9" />
              </g>
            ))}
            <text x={p.x} y={p.y + 12} textAnchor="middle" className="village-map__name">{DISTRICT[d].short}</text>
            <text x={p.x} y={p.y + 27} textAnchor="middle" className="village-map__count">주민 {counts[d] ?? 0}</text>
          </g>
        );
      })}
      <g
        className="village-map__district"
        role="button"
        tabIndex={0}
        aria-pressed={selected === 'plaza'}
        aria-label="중앙광장"
        onClick={() => onSelect('plaza')}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect('plaza')}
      >
        <circle cx={CX} cy={CY} r={selected === 'plaza' ? 40 : 36} fill={tokens.color.surface} stroke={tokens.color.accent} strokeWidth={selected === 'plaza' ? 4 : 2} />
        <circle cx={CX} cy={CY - 6} r="9" fill={tokens.color.skySoft} stroke={tokens.color.sky} strokeWidth="2" />
        <text x={CX} y={CY + 18} textAnchor="middle" className="village-map__name">중앙광장</text>
      </g>
    </svg>
  );
}

export function RoomCards({ rooms, empty }: { rooms: RoomCard[]; empty: string }) {
  if (!rooms.length) return <p className="empty">{empty}</p>;
  return (
    <ul className="room-cards">
      {rooms.map((r) => (
        <li key={r.handle}>
          <Link className="room-card" href={`/r/${r.handle}`} style={{ '--district': r.district ? tokens.district[r.district] : tokens.color.border } as CSSProperties}>
            <span className="room-card__avatar" style={{ background: tokens.avatar[r.avatar.color] }} aria-hidden />
            <span className="room-card__text">
              <b>{r.displayName}의 방</b>
              <span>{r.bio || (r.district ? DISTRICT[r.district].name : '')}</span>
            </span>
            <Icon name="back" size={16} className="room-card__arrow" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

const PHASE: Record<string, string> = { writing: '논거 쓰는 중', voting: '관전 판정 중', judging: '집계 중', done: '결과 발표' };

export function ExploreClient() {
  const [selected, setSelected] = useState<District | 'plaza'>('plaza');
  const [data, setData] = useState<ExploreData | null>(null);
  const [friends, setFriends] = useState<Friends | null>(null);
  const [debate, setDebate] = useState<DebateView | null>(null);
  // 3D 지도를 못 쓰면 그림 지도
  const [flat, setFlat] = useState(false);
  useEffect(() => setFlat(!canUse3d()), []);
  const onMapFail = useCallback(() => setFlat(true), []);

  useEffect(() => {
    const q = selected === 'plaza' ? '' : `?district=${selected}`;
    call<ExploreData>('GET', `/api/explore${q}`).then(setData).catch(() => {});
  }, [selected]);

  useEffect(() => {
    call<Friends>('GET', '/api/friends').then(setFriends).catch(() => setFriends(null));
    call<DebateView>('GET', '/api/debate').then(setDebate).catch(() => {});
  }, []);

  return (
    <main className="page page--tabs">
      <header className="page__head">
        <h1>둘러보기</h1>
        <p className="muted">마을을 눌러 이웃의 방을 구경해요. <Link href="/village">마을 걷기 ›</Link></p>
      </header>
      {flat ? (
        <VillageMap selected={selected} counts={data?.counts ?? {}} onSelect={setSelected} />
      ) : (
        <ExploreMap selected={selected} counts={data?.counts ?? {}} onSelect={setSelected} onFail={onMapFail} />
      )}

      {selected === 'plaza' ? (
        <>
          {debate && (
            <Link className="event-card" href="/debate">
              <span className="event-card__tag"><Icon name="debate" size={14} /> 이벤트 · 오늘의 토론</span>
              <b>{debate.match.topic.title}</b>
              <span className="muted">
                {debate.match.teamA.label} vs {debate.match.teamB.label} · {PHASE[debate.phase] ?? ''}
              </span>
            </Link>
          )}
          <section className="section">
            <h2 className="section-title">새로 이사 온 주민</h2>
            <RoomCards rooms={data?.newcomers ?? []} empty="아직 이사 온 주민이 없어요." />
          </section>
        </>
      ) : (
        <section className="section" style={{ '--district': tokens.district[selected] } as CSSProperties}>
          <h2 className="section-title">
            {DISTRICT[selected].name} <small>{THEME[DISTRICT[selected].theme].name} · {THEME[DISTRICT[selected].theme].place}</small>
          </h2>
          {data ? <RoomCards rooms={data.rooms} empty="아직 공개된 방이 없어요." /> : <div className="loader" aria-hidden />}
        </section>
      )}

      {friends ? (
        <section className="section">
          <h2 className="section-title">친구 방</h2>
          {friends.received.length > 0 && (
            <Link className="notice notice--link" href="/my#friends">받은 친구 신청 {friends.received.length}개 ›</Link>
          )}
          <RoomCards rooms={friends.friends} empty="아직 친구가 없어요. 마음에 드는 방에서 친구 신청을 해 보세요." />
        </section>
      ) : (
        <Guide who="monnyang">
          로그인하면 친구 방을 모아 볼 수 있어요. <Link href="/login?next=/explore">로그인</Link>
        </Guide>
      )}
      <TabBar />
    </main>
  );
}
