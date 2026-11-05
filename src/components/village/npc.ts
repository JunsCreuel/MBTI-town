// 광장 안내 NPC 몬냥이: 서 있는 자리와 하는 말. 처음 온 사람이 헷갈리지 않게 MBTI 마을·오늘의 토론·대항전·놀거리·클럽·코인·가방·조작·집을 알려 준다.
// 복채·값은 설정(src/config/game.ts)에서 읽어 말한다 (값을 바꿔도 말이 맞게).
import { coinConfig, contestConfig, debateConfig, marketConfig, townConfig } from '@/config/game';
import { withIGa } from '@/shared/josa';
import { FISH } from '@/shared/play';
import { RESIDENTS } from '@/shared/residents';
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
  '여기는 MBTI 16개 유형이 저마다 마을을 이루고 사는 섬이에요. 내 MBTI 마을에 내 집이 있어요!',
  '광장 게시판에서는 매일 오늘의 토론이 열려요. E·I, S·N, T·F, J·P 중 하나로 편을 나눠 겨뤄요.',
  '처음 왔다면 뭐든 물어보세요. 언제든 저한테 다시 말 걸면 돼요!',
]
export const NPC_AGAIN = ['또 왔네요! 궁금한 게 있어요?'];
export const NPC_BYE = '언제든 또 불러 주세요. 즐거운 시간 보내요!';

const won = (n: number) => n.toLocaleString('ko-KR');

export const NPC_TOPICS: NpcTopic[] = [
  {
    id: 'town',
    ask: '어떤 마을이에요?',
    lines: () => [
      'MBTI 16개 유형마다 마을이 하나씩 있어요. 가운데 중앙광장을 둘러싸고, 같은 기질끼리 한 구역에 모여 있어요.',
      '북쪽은 분석가(NT) 은빛 언덕, 동쪽은 외교관(NF) 초록 숲, 남쪽은 관리자(SJ) 푸른 호숫가, 서쪽은 탐험가(SP) 노을 거리예요.',
      `내 MBTI 마을에 내 집이 서요. MBTI를 바꾸면 그 마을로 이사하는데, 한 번 바꾸면 ${debateConfig.mbtiChangeCooldownDays}일 동안은 다시 못 바꿔요.`,
      '위쪽 지도 버튼으로 섬 전체를 보고, 가고 싶은 마을을 누르면 바로 가요.',
      `마을 네 곳에는 동물 주민 ${withIGa(RESIDENTS.map((r) => r.name).join('·'))} 살아요. 집에서 나와 산책하다 다시 들어가니, 가까이 가서 인사해 보세요!`,
    ],
  },
  {
    id: 'debate',
    ask: '오늘의 토론은 뭐예요?',
    lines: (guest) => [
      '광장 게시판에서 매일 열리는 토론이에요. 날마다 E·I, S·N, T·F, J·P 중 한 축으로 편을 나눠요.',
      '내 MBTI 글자가 곧 내 편이에요. 예를 들어 T·F 대결 날이면 T 주민은 T 편, F 주민은 F 편이에요.',
      '저녁 6시까지 논거를 쓰고 우리 편 논거를 추천해요. 그다음 밤 9시까지 모두가 가장 설득력 있는 대표 논거 하나를 골라요.',
      '유형마다 같은 무게로 세서, 상대편 마음을 더 많이 돌린 편이 이겨요!',
      ...(guest ? ['토론은 집이 있는 주민만 참여할 수 있어요. 아래 "나도 집 짓기"부터 해 보세요!'] : []),
    ],
  },
  {
    id: 'contest',
    ask: '대항전이 뭐예요?',
    lines: (guest) => [
      'MBTI 16개 마을이 한 주 동안 점수를 겨루는 마을 대항전이에요. 분수 옆 큰 전광판과 위쪽 "대항전" 버튼에서 순위를 볼 수 있어요.',
      `낚시·열매·오늘의 토론·하루 첫 방문·점포 사기로 우리 마을 점수가 올라가요. 오늘의 토론에서 이긴 편의 여덟 마을은 ${contestConfig.points.debateWin}점씩 더 받아요.`,
      '한 사람이 하루에 올릴 수 있는 점수는 종류마다 정해져 있어요. 그래서 여러 주민이 함께할수록 유리해요.',
      '매주 일요일 밤 9시에 우승 마을을 발표하고, 마을 모두에게 소식이 퍼져요!',
      ...(guest ? ['대항전 점수는 집이 있는 주민만 올릴 수 있어요. 아래 "나도 집 짓기"부터 해 보세요!'] : []),
    ],
  },
  {
    id: 'play',
    ask: '뭐 하고 놀아요?',
    lines: () => [
      '광장의 분홍 운세 나무에서 하루 한 번 운세 열매를 따요. 결과는 카드로 만들어 친구에게 자랑할 수 있어요.',
      '마을마다 입구에 열매 나무가 있어요. 은빛 언덕은 배, 초록 숲은 사과, 푸른 호숫가는 포도, 노을 거리는 복숭아예요.',
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
      `모은 코인으로 상가에서 내 점포(${won(marketConfig.price)}코인)를 살 수 있어요.`,
      '지금 가진 코인은 가방 맨 위에서 볼 수 있어요.',
    ],
  },
  {
    id: 'bag',
    ask: '가방·도감은 어디 있어요?',
    lines: () => [
      '화면 아래 탭에서 가방·도감·내 캐릭터를 바로 열 수 있어요. 마을에서는 위쪽 가방 버튼으로도 열려요.',
      '가방에는 코인과 모은 열매·물고기가 있어요. 도감에는 아직 못 잡은 물고기가 ??? 로 보여요.',
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
        ? ["아직 집이 없네요! 아래 '나도 집 짓기'를 누르면 MBTI를 고르고 그 마을에 집을 지어 드려요.", 'MBTI를 모르면 간단 테스트로 정할 수 있어요. 집이 생기면 방을 꾸미고, 토론에도 참여할 수 있어요!']
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
