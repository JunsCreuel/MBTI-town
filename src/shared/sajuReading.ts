// 사주상담소 풀이 (부엉 도사). 내 사주(일간·여덟 글자)와 그 기간의 간지(일진·월건·세운)를 견주어
// "재미로 보는" 풀이를 만든다. 성격·운명을 정하거나 건강·돈·법률 결정을 단정하는 말은 쓰지 않는다.
// 기간 풀이: 오늘·내일(그날 일진) · 이번 주(이레의 일진) · 이번 달(월건). 상세 풀이: 타고난 기운·오행 균형·십성·올해 흐름.
import type { District } from './districts';
import { ELEMENT_INFO, type Pillar, type SajuReading } from './saju';
import { LUCKY, helperOf, tenGod, type TenGod } from './fortune';
import { withRo } from './josa';

export const SAJU_KINDS = ['today', 'tomorrow', 'week', 'month'] as const;
export type SajuKind = (typeof SAJU_KINDS)[number];
export const SAJU_KIND_NAME: Record<SajuKind | 'premium', string> = {
  today: '오늘의 사주',
  tomorrow: '내일의 사주',
  week: '이번 주 사주',
  month: '이번 달 사주',
  premium: '상세 사주풀이',
};

export interface SajuSection {
  title: string;
  text: string;
}

export interface SajuResult {
  kind: SajuKind | 'premium';
  /** 기간 (예: "11월 4일 수요일", "11월 2일 ~ 11월 8일", "2026년 11월") */
  period: string;
  title: string;
  /** 한두 문장 요약 */
  summary: string;
  /** 1~5 (별점, 상세 풀이는 0) */
  stars: number;
  sections: SajuSection[];
  lucky: { color: string; number: string; direction: string; item: string };
}

// ───────────────────────── 바탕 자료 ─────────────────────────

/** 지지 속 대표 천간 (본기) */
const HIDDEN_MAIN: Record<string, string> = { 子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙', 午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬' };
/** 육합 · 충 짝 */
const HAP = ['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未'];
const CHUNG = ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'];
const pair = (a: string, b: string, list: string[]) => list.some((p) => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));

const NUMBER: Record<District, string> = { wood: '3, 8', fire: '2, 7', earth: '5, 10', metal: '4, 9', water: '1, 6' };
const DIRECTION: Record<District, string> = { wood: '동쪽', fire: '남쪽', earth: '가운데(집 근처)', metal: '서쪽', water: '북쪽' };

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const pick = <T,>(list: readonly T[], seed: string) => list[hash(seed) % list.length];

/** 십성 다섯 갈래 */
type Group = '비겁' | '식상' | '재성' | '관성' | '인성';
const GROUP: Record<TenGod, Group> = {
  비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상', 편재: '재성', 정재: '재성', 편관: '관성', 정관: '관성', 편인: '인성', 정인: '인성',
};

/** 십성별 기간 풀이 문구 (기간을 가리지 않는 말로 쓴다). 줄마다 두 가지 중 하나가 나온다 */
const GOD: Record<TenGod, { title: string; stars: number; summary: string[]; love: string[]; work: string[]; money: string[]; health: string[]; tip: string[] }> = {
  비견: {
    title: '든든한 내 편이 생기는 흐름',
    stars: 3,
    summary: ['나와 결이 비슷한 사람들과 힘을 모으기 좋은 흐름이에요.', '혼자보다 함께일 때 일이 술술 풀리는 때예요.'],
    love: ['친구 같은 편안함이 큰 매력이 돼요. 함께 할 수 있는 작은 약속을 잡아 보세요.', '내 이야기를 들어 줄 사람이 가까이 있어요. 먼저 안부를 물어보면 좋아요.'],
    work: ['같이 하는 일에서 좋은 결과가 나요. 역할을 나누면 더 빨라져요.', '내 방식만 고집하기보다 동료의 방법을 하나 빌려 보세요.'],
    money: ['나눠 쓰는 지출이 늘 수 있어요. 함께 쓰는 돈은 미리 정해 두면 편해요.', '큰 지출보다는 꾸준히 모으는 쪽이 잘 맞아요.'],
    health: ['같이 걷거나 운동하면 오래 즐겁게 할 수 있어요.', '무리하게 맞추다 지치지 않게, 쉬는 시간도 챙겨요.'],
    tip: ['이웃 방에 놀러 가 방명록을 남겨 보세요.', '광장에서 같은 지역 주민에게 인사해 보세요.'],
  },
  겁재: {
    title: '의욕이 불타오르는 흐름',
    stars: 2,
    summary: ['하고 싶은 게 많아지고 추진력이 생기는 때예요. 욕심은 반만!', '경쟁심이 살아나는 때예요. 나와의 경쟁이라 생각하면 좋아요.'],
    love: ['적극적인 마음이 잘 전해지는 때예요. 다만 상대의 속도도 기다려 주세요.', '질투보다는 칭찬 한마디가 관계를 더 가깝게 해요.'],
    work: ['밀어붙이는 힘이 좋은 때라 미뤄 둔 일을 끝내기 좋아요.', '동시에 여러 일을 벌이기보다 하나를 끝까지 해내 보세요.'],
    money: ['충동구매를 조심할 때예요. 장바구니에 하루 묵혀 두세요.', '돈을 빌려주거나 함께 쓰는 일은 한 번 더 생각해요.'],
    health: ['기운이 넘쳐서 무리하기 쉬워요. 잠은 충분히!', '땀을 흘리는 운동으로 넘치는 기운을 풀어 보세요.'],
    tip: ['오늘의 토론에서 내 지역 편에 한 표!', '낚시터에서 큰 물고기에 도전해 보세요.'],
  },
  식신: {
    title: '여유롭고 맛있는 흐름',
    stars: 4,
    summary: ['먹고 쉬고 즐기는 일에 복이 있는 때예요. 마음이 넉넉해져요.', '하고 싶은 일을 편하게 풀어내기 좋은 때예요.'],
    love: ['함께 맛있는 걸 먹으면 관계가 한 뼘 가까워져요.', '편안한 모습이 가장 큰 매력이에요. 꾸미지 않아도 괜찮아요.'],
    work: ['꾸준히 해 온 일에서 성과가 보여요. 내 솜씨를 보여 줄 기회예요.', '좋아하는 일을 할 때 아이디어가 잘 떠올라요.'],
    money: ['작은 즐거움에 쓰는 돈이 기분을 크게 바꿔 줘요.', '솜씨나 취미가 작은 수입으로 이어질 수 있어요.'],
    health: ['과식만 조심하면 몸도 마음도 가벼워요.', '푹 자고 잘 먹는 것만으로 기운이 차올라요.'],
    tip: ['클럽에서 바텐더 곰돌에게 한 잔(물도 좋아요)!', '오늘 먹은 맛있는 걸 기록으로 남겨 보세요.'],
  },
  상관: {
    title: '말솜씨가 반짝이는 흐름',
    stars: 2,
    summary: ['표현력이 빛나는 때예요. 다만 말이 앞설 수 있으니 한 번 더 다듬어요.', '틀을 깨는 생각이 떠오르는 때예요.'],
    love: ['솔직한 표현이 매력이지만, 농담이 상처가 되지 않게 살펴요.', '새로운 데이트 코스나 대화 주제가 분위기를 바꿔요.'],
    work: ['새 아이디어를 내기 좋은 때예요. 메모해 두면 나중에 빛나요.', '윗사람·규칙과 부딪히기 쉬우니 부드럽게 말해요.'],
    money: ['기분 따라 쓰는 지출이 생길 수 있어요. 한도를 정해 두세요.', '재주를 살린 일이 수입으로 이어질 수 있어요.'],
    health: ['목과 어깨가 굳기 쉬워요. 가볍게 풀어 주세요.', '생각이 많아 잠이 늦어질 수 있어요. 화면은 일찍 끄기!'],
    tip: ['오늘의 토론에 논거를 하나 남겨 보세요.', '방 배치를 바꿔 기분을 새로 해 보세요.'],
  },
  편재: {
    title: '뜻밖의 기회가 오는 흐름',
    stars: 3,
    summary: ['움직이는 만큼 기회가 생기는 때예요. 안 가 본 곳을 가 보세요.', '우연한 만남이나 소식이 반가운 때예요.'],
    love: ['새로운 만남의 기운이 있어요. 모임이나 산책에서 인연이 닿을 수 있어요.', '평소와 다른 장소에서 만나면 설렘이 커져요.'],
    work: ['발이 넓어질수록 일이 잘 풀려요. 연락을 미루지 마세요.', '큰 그림을 그리기 좋은 때예요. 작은 것부터 시작해요.'],
    money: ['들어오는 만큼 나가기도 쉬워요. 들어온 돈은 바로 나눠 담아요.', '뜻밖의 작은 수입이 생길 수 있어요.'],
    health: ['돌아다니다 피곤해지기 쉬워요. 물을 자주 마셔요.', '밖에서 걷는 시간이 기운을 채워 줘요.'],
    tip: ['다른 지역을 산책하며 이웃 집을 구경해 보세요.', '상가에 들러 이웃 점포를 둘러보세요.'],
  },
  정재: {
    title: '차곡차곡 쌓이는 흐름',
    stars: 4,
    summary: ['성실하게 한 만큼 돌아오는 때예요. 정리하고 쌓기 좋아요.', '작은 것부터 챙기면 마음까지 개운해지는 때예요.'],
    love: ['꾸준한 마음이 신뢰가 돼요. 작은 약속을 잘 지켜 보세요.', '안정적인 관계를 다지기 좋은 때예요.'],
    work: ['꼼꼼함이 인정받는 때예요. 마무리를 깔끔하게!', '계획표를 세우면 생각보다 많은 걸 해내요.'],
    money: ['저축·정리에 좋은 때예요. 새는 돈을 하나 찾아 막아 보세요.', '꾸준히 모은 것이 든든한 힘이 돼요.'],
    health: ['규칙적인 생활이 가장 좋은 약이에요.', '정해진 시간에 자고 일어나면 컨디션이 좋아져요.'],
    tip: ['나의 방을 정리하고 가구를 새로 놓아 보세요.', '낚시로 코인을 모아 상가 점포를 노려 보세요.'],
  },
  편관: {
    title: '용기를 내야 하는 흐름',
    stars: 2,
    summary: ['조금 긴장되는 일이 생길 수 있지만, 해내면 크게 자라는 때예요.', '책임이 늘어나는 때예요. 하나씩 차근차근 해요.'],
    love: ['진지한 마음이 전해지는 때예요. 다만 너무 밀어붙이지는 않기!', '어려운 이야기는 부드러운 말투로 꺼내 보세요.'],
    work: ['압박이 있어도 버티면 실력이 늘어요. 도움을 청하는 것도 실력이에요.', '급한 일부터 순서를 정하면 마음이 편해져요.'],
    money: ['갑작스러운 지출에 대비해 조금 남겨 두세요.', '큰 결정은 하루 더 생각하고 해요.'],
    health: ['긴장으로 몸이 굳기 쉬워요. 스트레칭과 깊은 숨!', '무리하지 말고 쉬는 날을 꼭 만들어요.'],
    tip: ['광장에서 처음 보는 이웃에게 먼저 인사해 보세요.', '몬냥이에게 마을 이야기를 들어 보세요.'],
  },
  정관: {
    title: '인정받고 빛나는 흐름',
    stars: 4,
    summary: ['약속과 규칙을 잘 지키면 인정받는 때예요.', '차분하게 해야 할 일을 해내기 좋은 때예요.'],
    love: ['믿음직한 모습이 매력이 돼요. 진지한 대화가 잘 통해요.', '관계를 한 단계 다지기 좋은 때예요.'],
    work: ['평가나 발표에 좋은 기운이 있어요. 준비한 만큼 보여 주세요.', '맡은 일을 끝까지 해내면 다음 기회가 와요.'],
    money: ['계획대로 쓰면 오히려 여유가 생겨요.', '정해진 수입·지출을 점검하기 좋아요.'],
    health: ['생활 리듬을 지키면 몸이 가뿐해요.', '자세를 바르게! 오래 앉아 있다면 자주 일어나요.'],
    tip: ['친구 방명록에 답을 남겨 보세요.', '오늘의 토론 결과를 확인해 보세요.'],
  },
  편인: {
    title: '번뜩이는 생각의 흐름',
    stars: 3,
    summary: ['남들이 안 하는 생각이 반짝이는 때예요. 떠오른 걸 적어 두세요.', '혼자만의 시간이 오히려 힘이 되는 때예요.'],
    love: ['마음을 다 드러내기보다 천천히 알아가는 관계가 좋아요.', '취향이 통하는 사람과 이야기가 깊어져요.'],
    work: ['새로 배우거나 연구하는 일에 집중이 잘 돼요.', '정해진 방법 말고 다른 길을 찾아보면 답이 보여요.'],
    money: ['배움이나 취미에 쓰는 돈은 아깝지 않아요. 다만 계획은 세워요.', '큰돈보다는 작은 투자로 시험해 보세요.'],
    health: ['생각이 많아 잠이 부족해지기 쉬워요. 따뜻한 차 한 잔!', '조용히 걷는 시간이 머리를 맑게 해요.'],
    tip: ['방에서 음악을 바꿔 들으며 쉬어 보세요.', '떠오른 생각을 기록으로 남겨 보세요.'],
  },
  정인: {
    title: '마음이 채워지는 흐름',
    stars: 5,
    summary: ['도와주는 사람이 곁에 있는 때예요. 배우고 돌아보기 좋아요.', '나를 돌보면 좋은 일이 따라오는 때예요.'],
    love: ['따뜻한 말 한마디에 마음이 크게 움직여요. 고마움을 표현해 보세요.', '든든하게 챙겨 주는 사람을 만날 수 있어요.'],
    work: ['배움과 자격, 공부에 좋은 기운이 있어요.', '선배나 어른의 조언이 큰 도움이 돼요.'],
    money: ['안정적인 흐름이에요. 필요한 곳에만 쓰면 넉넉해요.', '선물이나 도움으로 들어오는 것이 있을 수 있어요.'],
    health: ['푹 쉬는 것만으로도 기운이 금세 돌아와요.', '좋아하는 것을 하며 마음을 쉬게 해 주세요.'],
    tip: ['오늘의 감정을 한 줄로 기록해 보세요.', '좋아하는 가구로 방을 채워 보세요.'],
  },
};

const GROUP_TEXT: Record<Group, { name: string; strong: string; weak: string }> = {
  비겁: { name: '나와 친구 (비겁)', strong: '자기 주관이 뚜렷하고 버티는 힘이 강해요. 내 편을 만드는 재주가 있어요.', weak: '남에게 맞추느라 내 몫을 놓치기 쉬워요. 가끔은 내 의견을 먼저 말해도 괜찮아요.' },
  식상: { name: '표현과 재주 (식상)', strong: '말·글·손재주로 나를 드러내는 힘이 좋아요. 즐기는 일에서 빛나요.', weak: '생각을 밖으로 꺼내는 데 시간이 걸려요. 기록이나 취미로 표현하는 연습이 도움이 돼요.' },
  재성: { name: '재물과 현실 (재성)', strong: '현실 감각과 실행력이 좋아요. 기회를 알아보는 눈이 있어요.', weak: '돈·일정 같은 현실 관리를 미루기 쉬워요. 작은 가계부부터 시작해 보세요.' },
  관성: { name: '일과 책임 (관성)', strong: '책임감이 강하고 조직에서 믿음을 얻어요. 규칙 안에서 힘을 내요.', weak: '틀에 매이지 않는 자유로운 기질이에요. 마감 하나만 정해 두면 훨씬 수월해요.' },
  인성: { name: '배움과 돌봄 (인성)', strong: '배우고 생각하는 힘, 도움을 받는 복이 있어요.', weak: '혼자 다 해내려 하기 쉬워요. 도움을 청하는 것도 실력이에요.' },
};

/** 일간 열 가지: 타고난 기운 (상세 풀이) */
const STEM_TEXT: Record<string, { image: string; nature: string; care: string }> = {
  甲: { image: '곧게 뻗은 큰 나무', nature: '앞장서서 길을 여는 힘이 있어요. 한번 정하면 끝까지 밀고 가는 뚝심이 매력이에요.', care: '굽히지 않는 성격이 고집으로 보일 수 있어요. 가끔은 바람에 흔들리는 가지처럼 유연하게!' },
  乙: { image: '덩굴과 꽃', nature: '부드럽게 어디든 스며드는 적응력이 있어요. 사람 사이를 잇는 재주가 좋아요.', care: '남의 눈치를 보느라 지치기 쉬워요. 내 마음을 먼저 들어 주세요.' },
  丙: { image: '한낮의 태양', nature: '밝고 따뜻해서 사람을 모으는 힘이 있어요. 숨김없이 솔직해요.', care: '쉽게 타오르고 쉽게 식을 수 있어요. 시작한 일에 마침표를 찍어 보세요.' },
  丁: { image: '촛불과 별빛', nature: '섬세하고 따뜻한 마음으로 주변을 비춰요. 집중력이 좋아요.', care: '혼자 속을 태우기 쉬워요. 걱정은 말로 꺼내면 반으로 줄어요.' },
  戊: { image: '넓은 산과 들', nature: '묵직하게 중심을 잡아 주는 사람이에요. 믿음직하고 포용력이 커요.', care: '변화를 늦게 받아들이는 편이에요. 새로운 것도 하나씩 맛보세요.' },
  己: { image: '기름진 밭', nature: '사람과 일을 길러 내는 따뜻한 힘이 있어요. 실속을 잘 챙겨요.', care: '생각이 많아 결정을 미루기 쉬워요. 작은 일은 빠르게 정해 봐요.' },
  庚: { image: '단단한 바위와 쇠', nature: '결단력과 의리가 강해요. 옳다고 믿는 일에 거침이 없어요.', care: '말이 날카롭게 들릴 수 있어요. 한 박자 쉬고 말하면 더 멋져요.' },
  辛: { image: '반짝이는 보석', nature: '감각이 예리하고 깔끔해요. 아름다운 것을 알아보는 눈이 있어요.', care: '완벽하게 하려다 지치기 쉬워요. 80점이면 충분할 때도 있어요.' },
  壬: { image: '넓은 바다와 큰 강', nature: '생각이 크고 자유로워요. 어디든 흘러가며 길을 찾는 지혜가 있어요.', care: '하고 싶은 게 많아 흩어지기 쉬워요. 큰 그림 속 오늘 할 일 하나를 정해요.' },
  癸: { image: '봄비와 이슬', nature: '조용히 스며들어 주변을 살리는 사람이에요. 직감과 상상력이 좋아요.', care: '마음이 쉽게 출렁여요. 나를 편하게 해 주는 자리를 하나 만들어 두세요.' },
};

/** 모자란 오행을 채우는 마을 활동 (오행 채우기) */
const FILL: Record<District, string> = {
  wood: '열매 나무에서 열매를 따고, 방에 화분을 놓아 보세요.',
  fire: '클럽에서 춤추고, 밝은 색 옷이나 조명을 가까이 해 보세요.',
  earth: '방 꾸미기와 상가 점포 가꾸기가 땅의 기운을 채워 줘요.',
  metal: '오늘의 토론에 참여하고, 물건을 정리정돈해 보세요.',
  water: '낚시터에서 물가에 머물고, 잔잔한 음악을 들어 보세요.',
};

function luckyFor(me: District): SajuResult['lucky'] {
  const e = helperOf(me);
  return { color: LUCKY[e].color, number: NUMBER[e], direction: DIRECTION[e], item: LUCKY[e].itemName };
}

function relationLine(myBranch: string, target: Pillar): { line: string | null; delta: number } {
  if (pair(myBranch, target.branch, HAP)) return { line: '내 일지와 잘 어울리는 기운(합)이 들어와 사람·일이 잘 맞물려요.', delta: 1 };
  if (pair(myBranch, target.branch, CHUNG)) return { line: '내 일지와 부딪히는 기운(충)이 있어 변화·이동이 많을 수 있어요. 서두르지 말고 한 번 더 확인해요.', delta: -1 };
  return { line: null, delta: 0 };
}

const clampStars = (n: number) => Math.max(1, Math.min(5, n));

// ───────────────────────── 기간 풀이 ─────────────────────────

/** 하루·한 달처럼 간지 하나로 보는 풀이 */
export function periodReading(saju: SajuReading, kind: SajuKind, target: Pillar, period: string, seed: string): SajuResult {
  const god = tenGod(saju.dayMaster.stem, target.stem);
  const t = GOD[god];
  const rel = relationLine(saju.day.branch, target);
  const s = (k: string) => `${seed}:${k}`;
  const scope = kind === 'month' ? '이번 달' : kind === 'tomorrow' ? '내일' : '오늘';
  // 요약과 총운은 서로 다른 줄로
  const i = hash(s('sum')) % t.summary.length;
  return {
    kind,
    period,
    title: `${scope}은 ${t.title}`,
    summary: `${target.ko}(${target.stem}${target.branch})의 ${ELEMENT_INFO[target.stemElement].ko} 기운이 나에게 ${withRo(god)} 와요. ${t.summary[i]}`,
    stars: clampStars(t.stars + rel.delta),
    sections: [
      { title: '총운', text: [t.summary[(i + 1) % t.summary.length], rel.line].filter(Boolean).join(' ') },
      { title: '연애·인연', text: pick(t.love, s('love')) },
      { title: '일·공부', text: pick(t.work, s('work')) },
      { title: '재물', text: pick(t.money, s('money')) },
      { title: '건강', text: pick(t.health, s('health')) },
      { title: '부엉 도사의 한 수', text: pick(t.tip, s('tip')) },
    ],
    lucky: luckyFor(saju.dayMaster.element),
  };
}

/** 이번 주: 이레의 일진을 모두 보고 좋은 날과 조심할 날을 고른다. days = [{date 라벨, 일진}] 월~일 */
export function weekReading(saju: SajuReading, days: { label: string; pillar: Pillar }[], period: string, seed: string): SajuResult {
  const scored = days.map((d) => {
    const god = tenGod(saju.dayMaster.stem, d.pillar.stem);
    const rel = relationLine(saju.day.branch, d.pillar);
    return { ...d, god, stars: clampStars(GOD[god].stars + rel.delta) };
  });
  const best = [...scored].sort((a, b) => b.stars - a.stars)[0];
  const care = [...scored].sort((a, b) => a.stars - b.stars)[0];
  // 이번 주에 가장 많이 오는 갈래
  const counts = new Map<Group, number>();
  for (const d of scored) counts.set(GROUP[d.god], (counts.get(GROUP[d.god]) ?? 0) + 1);
  const main = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const mainGod = scored.find((d) => GROUP[d.god] === main)!.god;
  const t = GOD[mainGod];
  const avg = Math.round(scored.reduce((s, d) => s + d.stars, 0) / scored.length);
  const s = (k: string) => `${seed}:${k}`;
  return {
    kind: 'week',
    period,
    title: `이번 주는 ${t.title}`,
    summary: `이번 주에는 ${GROUP_TEXT[main].name.split(' (')[0]}의 기운이 가장 자주 들어와요. ${pick(t.summary, s('sum'))}`,
    stars: clampStars(avg),
    sections: [
      { title: '좋은 날', text: `${best.label} (${best.pillar.ko}일) — ${GOD[best.god].title}. ${pick(GOD[best.god].summary, s('best'))}` },
      { title: '조심할 날', text: `${care.label} (${care.pillar.ko}일) — ${pick(GOD[care.god].health, s('care'))}` },
      { title: '연애·인연', text: pick(t.love, s('love')) },
      { title: '일·공부', text: pick(t.work, s('work')) },
      { title: '재물', text: pick(t.money, s('money')) },
      { title: '부엉 도사의 한 수', text: pick(t.tip, s('tip')) },
    ],
    lucky: luckyFor(saju.dayMaster.element),
  };
}

// ───────────────────────── 상세 풀이 ─────────────────────────

const ELEMENTS: District[] = ['wood', 'fire', 'earth', 'metal', 'water'];

/** 상세 풀이: 타고난 기운, 오행 균형, 다섯 갈래(십성), 올해·이번 달 흐름, 연애·재물·일, 한마디 */
export function premiumReading(saju: SajuReading, year: Pillar, month: Pillar, period: string): SajuResult {
  const me = saju.dayMaster;
  const stem = STEM_TEXT[me.stem];
  // 오행 균형
  const counts = ELEMENTS.map((e) => ({ e, n: saju.counts[e] }));
  const max = Math.max(...counts.map((c) => c.n));
  const strong = counts.filter((c) => c.n === max).map((c) => c.e);
  const missing = counts.filter((c) => c.n === 0).map((c) => c.e);
  const low = missing.length ? missing : counts.filter((c) => c.n === Math.min(...counts.map((x) => x.n))).map((c) => c.e);
  const name = (e: District) => `${ELEMENT_INFO[e].ko}(${ELEMENT_INFO[e].hanja})`;
  const balance = [
    `여덟 글자 속 오행은 ${counts.map((c) => `${ELEMENT_INFO[c.e].ko} ${c.n}`).join(' · ')}이에요.`,
    `${strong.map(name).join('·')} 기운이 가장 강해서 ${ELEMENT_INFO[strong[0]].line}이 두드러져요.`,
    missing.length
      ? `${missing.map(name).join('·')} 기운이 비어 있어요. ${missing.map((e) => FILL[e]).join(' ')}`
      : `비어 있는 오행이 없어 고르게 갖춘 편이에요. 가장 적은 ${low.map(name).join('·')} 기운은 이렇게 채워 보세요: ${FILL[low[0]]}`,
  ].join(' ');

  // 다섯 갈래: 일간을 뺀 천간과 지지 속 대표 천간
  const others = [saju.year.stem, saju.month.stem, saju.hour?.stem, HIDDEN_MAIN[saju.year.branch], HIDDEN_MAIN[saju.month.branch], HIDDEN_MAIN[saju.day.branch], saju.hour ? HIDDEN_MAIN[saju.hour.branch] : undefined]
    .filter((x): x is string => !!x);
  const groups = new Map<Group, number>((['비겁', '식상', '재성', '관성', '인성'] as Group[]).map((g) => [g, 0]));
  for (const o of others) groups.set(GROUP[tenGod(me.stem, o)], groups.get(GROUP[tenGod(me.stem, o)])! + 1);
  const sorted = [...groups].sort((a, b) => b[1] - a[1]);
  const top = sorted[0][0];
  const zero = sorted.filter(([, n]) => n === 0).map(([g]) => g);
  const gods = [
    `${GROUP_TEXT[top].name} 기운이 가장 많아요. ${GROUP_TEXT[top].strong}`,
    zero.length ? `${zero.map((g) => GROUP_TEXT[g].name).join(', ')}은 적은 편이라 ${GROUP_TEXT[zero[0]].weak}` : '다섯 갈래를 두루 갖춰 균형이 좋은 편이에요.',
  ].join(' ');

  // 올해·이번 달
  const yGod = tenGod(me.stem, year.stem);
  const mGod = tenGod(me.stem, month.stem);
  const flow = `올해(${year.ko}년)는 ${GOD[yGod].title}이에요. ${GOD[yGod].summary[0]} 이번 달(${month.ko}월)은 ${GOD[mGod].title}이라 ${GOD[mGod].work[0]}`;

  const has = (g: Group) => (groups.get(g) ?? 0) > 0;
  const love = has('재성') || has('관성')
    ? `인연의 기운(${has('재성') ? '재성' : ''}${has('재성') && has('관성') ? '·' : ''}${has('관성') ? '관성' : ''})이 사주 안에 있어 마음이 통하는 사람을 알아보는 눈이 있어요. ${GOD[yGod].love[0]}`
    : `인연의 기운이 사주에 적은 편이라 천천히 깊어지는 관계가 잘 맞아요. 모임·산책처럼 자연스럽게 만나는 자리를 늘려 보세요. ${GOD[yGod].love[1]}`;
  const money = has('재성')
    ? `재성이 있어 현실 감각이 좋아요. ${GOD[yGod].money[0]}`
    : `재성이 적어 돈 관리를 미루기 쉬워요. 들어오면 바로 나눠 담는 습관이 큰 힘이 돼요. ${GOD[yGod].money[1]}`;
  const work = has('관성') || has('식상')
    ? `${has('식상') ? '재주를 드러내는 식상' : '책임을 맡는 관성'}이 있어 ${has('식상') ? '나만의 솜씨로 길을 여는 일' : '믿음을 쌓아 올라가는 일'}이 잘 맞아요. ${GOD[mGod].work[1]}`
    : `틀에 매이지 않는 자유로운 기질이에요. 정해진 길보다 내가 고른 길에서 힘이 나요. ${GOD[mGod].work[0]}`;

  return {
    kind: 'premium',
    period,
    title: `${stem.image}의 사주`,
    summary: `${saju.day.ko}일주, ${me.ko}(${me.stem}) 일간이에요. ${stem.nature}`,
    stars: 0,
    sections: [
      { title: '타고난 기운', text: `${stem.image}처럼 ${stem.nature} ${stem.care}` },
      { title: '오행 균형', text: balance },
      { title: '나를 이루는 다섯 갈래', text: gods },
      { title: '올해와 이번 달', text: flow },
      { title: '연애·인연', text: love },
      { title: '재물', text: money },
      { title: '일·진로', text: work },
      { title: '부엉 도사의 한마디', text: `${missing.length ? `비어 있는 ${missing.map(name).join('·')} 기운을 마을에서 채워 가면 흐름이 한결 부드러워져요.` : '지금처럼 고르게 가꾸면 좋은 흐름이 오래가요.'} 사주는 정해진 답이 아니라 나를 돌아보는 거울이에요. 재미로 보고, 좋은 말만 챙겨 가세요!` },
    ],
    lucky: luckyFor(me.element),
  };
}
