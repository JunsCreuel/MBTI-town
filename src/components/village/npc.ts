// 광장 안내 NPC 몬냥이: 서 있는 자리와 하는 말. 처음 온 사람이 헷갈리지 않게 마을·사주상담소·놀거리·클럽·코인·가방·조작·집을 알려 준다.
// 복채·값은 설정(src/config/game.ts)에서 읽어 말한다 (값을 바꿔도 말이 맞게).
import { coinConfig, marketConfig, sajuConfig, townConfig } from '@/config/game';
import { FISH } from '@/shared/play';
import type { TownMap } from '@/shared/townMap';

export const NPC_NAME = '몬냥이';

/** 클럽 NPC(DJ·바텐더)가 있는 맵: DJ 부스와 바가 있는 클럽 */
export const hasClubNpcs = (map: TownMap) => map.props.some((p) => p.key === 'prop.club.booth') && map.props.some((p) => p.key === 'prop.club.bar');

/**
 * 클럽 NPC 자리: DJ는 부스 뒤, 바텐더는 바 카운터 안쪽(선반과 카운터 사이). 둘 다 소품이 보는 쪽(손님 쪽)을 본다.
 * 소품 정면 = (sin yaw, cos yaw)
 */
export function clubNpcSpots(map: TownMap): { dj: NpcSpot; bartender: NpcSpot } | null {
  const booth = map.props.find((p) => p.key === 'prop.club.booth');
  const bar = map.props.find((p) => p.key === 'prop.club.bar');
  if (!booth || !bar) return null;
  const behind = (p: { x: number; z: number; yaw: number }, d: number): NpcSpot => ({ x: p.x - Math.sin(p.yaw) * d, z: p.z - Math.cos(p.yaw) * d, yaw: p.yaw });
  // 바텐더는 뒤 선반과 카운터 사이 가운데 (카운터에 가려지지 않게 앞쪽)
  return { dj: behind(booth, 0.8), bartender: behind(bar, 0.2) };
}

export interface NpcSpot {
  x: number;
  z: number;
  yaw: number;
}

/** 안내 NPC가 있는 맵 (본섬: 운세 나무가 있는 중앙광장) */
export const hasGuideNpc = (map: TownMap) => map.props.some((p) => p.key === 'prop.plaza.fortune_tree');

/** 서 있는 자리: 광장 스폰(처음 서는 곳) 오른쪽 옆, 스폰 쪽을 본다 */
export function guideNpcSpot(map: TownMap): { x: number; z: number; yaw: number } | null {
  if (!hasGuideNpc(map)) return null;
  const s = map.spawn;
  const x = s.x + s.w + 1.2;
  const z = s.z - 0.2;
  const cx = s.x + s.w / 2;
  const cz = s.z + s.h / 2;
  return { x, z, yaw: Math.atan2(cx - x, cz - z) };
}

/** 이 거리(칸) 안이면 말 걸기 버튼이 뜬다 */
export const NPC_TALK_REACH = 2.6;

export interface NpcTopic {
  id: string;
  /** 고르는 말 */
  ask: string;
  /** 몬냥이가 하는 말 (한 줄씩 넘긴다) */
  lines: (guest: boolean) => string[];
}

export const NPC_GREETING = [
  '안녕하세요! 저는 이 마을 안내를 맡은 몬냥이에요.',
  '이 마을의 자랑은 광장 가장자리의 사주상담소예요. 부엉 도사가 사주와 타로를 봐 줘요!',
  '처음 왔다면 뭐든 물어보세요. 언제든 저한테 다시 말 걸면 돼요!',
];
export const NPC_AGAIN = ['또 왔네요! 궁금한 게 있어요?'];
export const NPC_BYE = '언제든 또 불러 주세요. 즐거운 시간 보내요!';

const won = (n: number) => n.toLocaleString('ko-KR');
const sf = sajuConfig.fee;
const tf = sajuConfig.tarotFee;

export const NPC_TOPICS: NpcTopic[] = [
  {
    id: 'town',
    ask: '어떤 마을이에요?',
    lines: () => [
      '여기는 사주로 사는 동네가 정해지는 마을이에요. 태어난 날의 오행에 따라 숲·노을·언덕·은빛·호수, 다섯 지역 중 한 곳에 내 집이 생겨요.',
      '지금 서 있는 곳은 가운데 중앙광장이에요. 둘레 길을 따라가면 다섯 지역으로 갈 수 있고, 위쪽 지도 버튼으로 마을 전체를 볼 수 있어요.',
      '광장 게시판에서는 오늘의 토론이 열려요. 내 지역 편이 되어 겨뤄 보세요!',
    ],
  },
  {
    id: 'saju',
    ask: '사주·타로는 어디서 봐요?',
    lines: (guest) => [
      '광장 가장자리의 보라색 천막이 사주상담소예요. 부엉 도사 앞에 가면 "사주·타로 보기" 버튼이 떠요.',
      `사주 칸에서는 복채를 내고 오늘(${sf.today}코인)·내일(${sf.tomorrow}코인)·이번 주(${sf.week}코인)·이번 달(${sf.month}코인) 사주를 봐요. 태어난 날로 풀어 주니 사람마다 달라요.`,
      '한 번 본 풀이는 그 기간 동안 다시 봐도 복채를 또 내지 않아요.',
      `타로 칸에서는 오늘의 카드 한 장(${tf.one}코인)이나 과거·현재·미래 세 장(${tf.three}코인)을 뽑아요. 세 장은 종합, 연애, 일·공부, 재물 중에서 주제를 골라요.`,
      '뒤집힌 카드 중 마음 가는 카드를 고르면 도사가 뒤집어 풀어 줘요. 같은 날 같은 점은 다시 봐도 같은 카드가 나와요.',
      '더 자세한 상세 사주풀이는 사주 이용권으로 볼 수 있어요. 이용권은 낚시터에서 아주아주 드물게 낚이는데, 낚으면 마을 모두에게 소식이 퍼져요!',
      ...(guest ? ['사주와 타로는 집이 있는 주민만 볼 수 있어요. 아래 "나도 집 짓기"부터 해 보세요!'] : []),
    ],
  },
  {
    id: 'play',
    ask: '뭐 하고 놀아요?',
    lines: () => [
      '광장의 분홍 운세 나무에서 하루 한 번 운세 열매를 따요. 결과는 카드로 만들어 친구에게 자랑할 수 있어요.',
      '지역마다 있는 열매 나무에서는 사과·복숭아·감·배·포도를 따요.',
      `'낚시터' 간판 옆 비콘으로 가면 낚시를 해요. 물고기 도감은 ${FISH.length}칸! 10만 번에 한 번 나오는 황금 고래도 있어요.`,
      "'CLUB' 간판 옆 비콘은 춤추는 클럽, '상가' 간판 옆 비콘은 점포 20칸이 있는 상가로 가요.",
    ],
  },
  {
    id: 'club',
    ask: '클럽에서는 뭐 해요?',
    lines: () => [
      '클럽에서는 모두 같은 노래를 같은 순간에 들어요. 무대 위에 서면 저절로 춤을 추고, 스페이스바(휴대폰은 몸짓의 "폴짝")로 다 같이 뛸 수 있어요.',
      `DJ 너굴에게 가면 신청곡을 골라요. 지금 곡이 끝나면 신청곡이 차례로 나오고, 한 사람이 ${townConfig.musicQueuePerPerson}곡까지 기다릴 수 있어요.`,
      '집이 있는 주민은 유튜브 링크로도 신청할 수 있어요. 음악·엔터테인먼트 영상, 8분 이하 곡이에요. 나오는 동안 화면에 유튜브 플레이어가 떠요.',
      'DJ 부스 뒤 큰 전광판에는 지금 곡, 신청한 사람, 다음 곡이 나와요.',
      '바텐더 곰돌에게는 한 잔 주문할 수 있어요. 세 잔부터는 점점 취하니 물도 챙겨 마셔요! (게임 속 술이에요)',
    ],
  },
  {
    id: 'coins',
    ask: '코인은 어떻게 모아요?',
    lines: () => [
      `코인은 낚시로 가장 많이 모아요. 흔한 물고기는 ${coinConfig.fish.common}코인, 전설은 ${coinConfig.fish.legend}코인이에요. 열매는 ${coinConfig.fruit}코인, 운세 열매는 ${coinConfig.fortune}코인이에요.`,
      `모은 코인으로 사주·타로 복채를 내거나, 상가에서 내 점포(${won(marketConfig.price)}코인)를 살 수 있어요.`,
      '지금 가진 코인은 가방 맨 위에서 볼 수 있어요.',
    ],
  },
  {
    id: 'bag',
    ask: '가방·도감은 어디 있어요?',
    lines: () => [
      '화면 아래 탭에서 가방·도감·내 캐릭터를 바로 열 수 있어요. 마을에서는 위쪽 가방 버튼으로도 열려요.',
      '가방에는 코인과 모은 열매·물고기, 사주 이용권이 있어요. 도감에는 아직 못 잡은 물고기가 ??? 로 보여요.',
      '내 캐릭터에서는 색과 소품을 바꿔 나를 꾸밀 수 있어요. 새 옷과 액세서리도 곧 나와요!',
    ],
  },
  {
    id: 'move',
    ask: '어떻게 움직여요?',
    lines: () => [
      '가고 싶은 곳을 누르면 걸어가요. 컴퓨터에서는 방향키나 WASD로도 걸을 수 있고, 스페이스바를 누르면 폴짝 뛰어요.',
      '화면을 꾹 누른 채 끌면 둘러볼 수 있어요. 오른쪽 위 버튼(Q·E 키)으로 돌리고, 시점 버튼(V 키)으로 가까이·멀리 볼 수 있어요.',
      '아래 몸짓 버튼으로 응원·박수·하트를 보내 이웃과 인사해 보세요!',
    ],
  },
  {
    id: 'home',
    ask: '내 집은 어디예요?',
    lines: (guest) =>
      guest
        ? ["아직 집이 없네요! 아래 '나도 집 짓기'를 누르면 생일로 사는 지역을 정하고 집을 지어 드려요.", '집이 생기면 방을 꾸미고, 이웃 집에도 놀러 갈 수 있어요. 사주와 타로도 볼 수 있어요!']
        : ['위쪽 집 버튼을 누르면 내 집 앞으로 바로 가요. 문 앞에서 들어가기를 누르면 내 방이에요.', '이웃 집 문 앞에서는 놀러 갈 수 있어요. 방명록에 한마디 남겨 보세요.'],
  },
];

/** 처음 왔는지 (이 기기에서 몬냥이와 이야기한 적이 없으면 먼저 인사한다) */
const SEEN_KEY = 'scene:npc-hello';
export function npcSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}
export function markNpcSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // 저장이 안 되면 다음에 또 인사할 뿐
  }
}

/** 사주상담소 천막이 있는 맵 (본섬 광장) */
export const SAJU_TENT_KEY = 'prop.plaza.saju';
export const SAJU_NAME = '부엉 도사';

/** 부엉 도사가 서는 자리: 천막과 상담 탁자 사이, 광장 쪽을 본다 */
export function sajuNpcSpot(map: TownMap): NpcSpot | null {
  const tent = map.props.find((p) => p.key === SAJU_TENT_KEY);
  if (!tent) return null;
  return { x: tent.x + Math.sin(tent.yaw) * 0.8, z: tent.z + Math.cos(tent.yaw) * 0.8, yaw: tent.yaw };
}
