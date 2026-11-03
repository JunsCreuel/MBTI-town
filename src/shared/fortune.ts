// 오늘의 일진: 오늘 날짜의 일주(일진)와 내 일간을 견주어 "재미로 보는" 한 줄 편지를 만든다 (PROJECT_GUIDE.md 6장).
// 성격·운명을 정하는 말은 쓰지 않는다. 하루 동안 해 볼 만한 것(서비스 안 기능)을 하나 권한다.
import type { District } from './districts';
import type { Pillar } from './saju';

const STEMS = '甲乙丙丁戊己庚辛壬癸';
const STEM_ELEMENT: District[] = ['wood', 'wood', 'fire', 'fire', 'earth', 'earth', 'metal', 'metal', 'water', 'water'];
/** 상생: 목 → 화 → 토 → 금 → 수 → 목 */
const GENERATES: Record<District, District> = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
/** 상극: 목 → 토 → 수 → 화 → 금 → 목 */
const CONTROLS: Record<District, District> = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };

export const TEN_GODS = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'] as const;
export type TenGod = (typeof TEN_GODS)[number];

/** 내 일간(me)에서 본 다른 천간(other)의 십성. 천간은 한자 한 글자 */
export function tenGod(me: string, other: string): TenGod {
  const a = STEMS.indexOf(me);
  const b = STEMS.indexOf(other);
  if (a < 0 || b < 0) throw new Error(`천간이 아닙니다: ${me}, ${other}`);
  const ea = STEM_ELEMENT[a];
  const eb = STEM_ELEMENT[b];
  // 짝수 = 양, 홀수 = 음. 음양이 같으면 편(비견·식신·편재·편관·편인), 다르면 정
  const same = a % 2 === b % 2;
  if (ea === eb) return same ? '비견' : '겁재';
  if (GENERATES[ea] === eb) return same ? '식신' : '상관';
  if (CONTROLS[ea] === eb) return same ? '편재' : '정재';
  if (CONTROLS[eb] === ea) return same ? '편관' : '정관';
  return same ? '편인' : '정인';
}

/** 나를 낳아 주는(도와주는) 오행 */
export function helperOf(e: District): District {
  return (Object.keys(GENERATES) as District[]).find((k) => GENERATES[k] === e)!;
}

/** 오행별 행운 색과 소품 (소품은 방 가구 키) */
export const LUCKY: Record<District, { color: string; item: string; itemName: string }> = {
  wood: { color: '초록', item: 'furn.plant', itemName: '화분' },
  fire: { color: '빨강', item: 'furn.lamp', itemName: '스탠드 조명' },
  earth: { color: '노랑', item: 'furn.rug', itemName: '러그' },
  metal: { color: '하양', item: 'furn.clock', itemName: '시계' },
  water: { color: '남색', item: 'furn.bookshelf', itemName: '책장' },
};

interface GodText {
  /** 그날의 이름 (예: 반가운 만남의 날) */
  title: string;
  lines: string[];
  todo: { label: string; href: string };
}

/** 십성별 편지 문구. 같은 십성이라도 날마다 다른 줄이 나온다 */
const TEXT: Record<TenGod, GodText> = {
  비견: {
    title: '나와 닮은 기운의 날',
    lines: ['비슷한 결의 사람과 있으면 힘이 나는 날이에요. 친구 방에 놀러 가 볼까요?', '혼자보다 함께가 즐거운 하루. 이웃에게 먼저 인사를 건네 봐요.'],
    todo: { label: '이웃 방 놀러 가기', href: '/explore' },
  },
  겁재: {
    title: '의욕이 넘치는 날',
    lines: ['하고 싶은 게 많아지는 날이에요. 욕심은 반만 내고 나머지는 내일로!', '말하고 싶은 게 많은 날. 오늘의 토론에서 한마디 해 봐요.'],
    todo: { label: '오늘의 토론 보기', href: '/debate' },
  },
  식신: {
    title: '맛있고 여유로운 날',
    lines: ['먹고 쉬고 즐기기 좋은 날이에요. 오늘 맛있게 먹은 걸 기록해 둘까요?', '마음이 느긋해지는 날. 좋아하는 음악을 틀어 두고 쉬어 가요.'],
    todo: { label: '오늘의 기록 쓰기', href: '/archive?new=1' },
  },
  상관: {
    title: '말솜씨가 반짝이는 날',
    lines: ['생각이 톡톡 튀어나오는 날이에요. 오늘의 토론에 논거를 남겨 봐요.', '표현하고 싶은 게 많은 날. 방을 새로 꾸며 기분을 바꿔 봐요.'],
    todo: { label: '오늘의 토론 참여하기', href: '/debate' },
  },
  편재: {
    title: '뜻밖의 발견이 있는 날',
    lines: ['안 가 본 곳에서 재미를 찾기 좋은 날이에요. 다른 지역을 산책해 봐요.', '우연이 반가운 하루. 광장에서 처음 보는 이웃을 만나 봐요.'],
    todo: { label: '마을 산책하기', href: '/village?at=plaza' },
  },
  정재: {
    title: '차곡차곡 정리하는 날',
    lines: ['하나씩 정리하면 마음까지 개운해지는 날이에요. 방을 정돈해 볼까요?', '작은 것부터 챙기기 좋은 하루. 미뤄 둔 기록을 마저 써 봐요.'],
    todo: { label: '나의 방 꾸미기', href: '/home' },
  },
  편관: {
    title: '용기가 필요한 날',
    lines: ['평소에 안 하던 걸 해 보기 좋은 날이에요. 새 이웃에게 꾸벅 인사해 봐요.', '조금 긴장되는 일도 해낼 수 있는 하루. 오늘은 한 걸음 더!'],
    todo: { label: '광장에서 인사하기', href: '/village?at=plaza' },
  },
  정관: {
    title: '약속이 빛나는 날',
    lines: ['약속을 지키면 기분 좋아지는 날이에요. 친구 방명록에 답을 남겨 봐요.', '차분하게 해야 할 일을 하기 좋은 하루. 하나만 끝내도 충분해요.'],
    todo: { label: '이웃 방 놀러 가기', href: '/explore' },
  },
  편인: {
    title: '엉뚱한 생각이 떠오르는 날',
    lines: ['남들이 안 하는 생각이 반짝이는 날이에요. 떠오른 걸 기록해 둬요.', '혼자만의 시간이 좋은 하루. 방에서 음악을 바꿔 들어 봐요.'],
    todo: { label: '떠오른 생각 기록하기', href: '/archive?new=1' },
  },
  정인: {
    title: '마음을 채우는 날',
    lines: ['배우고 돌아보기 좋은 날이에요. 오늘의 감정을 한 줄로 남겨 봐요.', '나를 돌보는 하루. 좋아하는 것들로 방을 채워 봐요.'],
    todo: { label: '오늘의 감정 남기기', href: '/archive?new=1' },
  },
};

export interface DailyFortune {
  /** 한국 날짜 (YYYY-MM-DD) */
  date: string;
  /** 오늘의 일진 (예: 병오) */
  dayPillar: { ko: string; hanja: string; element: District };
  /** 내 일간 (예: 갑) */
  me: { ko: string; element: District };
  tenGod: TenGod;
  title: string;
  message: string;
  todo: { label: string; href: string };
  /** 나를 도와주는 오행의 색과 소품 */
  lucky: { element: District; color: string; item: string; itemName: string };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** 오늘의 편지. me = 내 일간 (한자, 예: 甲), today = 오늘의 일주 */
export function dailyFortune(me: { stem: string; ko: string; element: District }, today: Pillar, date: string): DailyFortune {
  const god = tenGod(me.stem, today.stem);
  const text = TEXT[god];
  const helper = helperOf(me.element);
  return {
    date,
    dayPillar: { ko: today.ko, hanja: today.stem + today.branch, element: today.stemElement },
    me: { ko: me.ko, element: me.element },
    tenGod: god,
    title: text.title,
    message: text.lines[hash(`${date}:${me.stem}`) % text.lines.length],
    todo: text.todo,
    lucky: { element: helper, ...LUCKY[helper] },
  };
}
