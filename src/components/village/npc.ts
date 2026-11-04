// 광장 안내 NPC 몬냥이: 서 있는 자리와 하는 말. 처음 온 사람이 헷갈리지 않게 마을·조작·놀거리·집을 알려 준다.
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
  return { dj: behind(booth, 0.8), bartender: behind(bar, 0.35) };
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

export const NPC_GREETING = ['안녕하세요! 저는 이 마을 안내를 맡은 몬냥이에요.', '처음 왔다면 뭐든 물어보세요. 언제든 저한테 다시 말 걸면 돼요!'];
export const NPC_AGAIN = ['또 왔네요! 궁금한 게 있어요?'];
export const NPC_BYE = '언제든 또 불러 주세요. 즐거운 시간 보내요!';

export const NPC_TOPICS: NpcTopic[] = [
  {
    id: 'town',
    ask: '여기는 어떤 마을이에요?',
    lines: () => [
      '여기는 사주로 사는 동네가 정해지는 마을이에요. 태어난 날의 오행에 따라 숲·노을·언덕·은빛·호수, 다섯 지역 중 한 곳에 내 집이 생겨요.',
      '지금 서 있는 곳은 가운데 중앙광장이에요. 둘레 길을 따라가면 다섯 지역으로 갈 수 있고, 위쪽 지도 버튼으로 마을 전체를 볼 수 있어요.',
    ],
  },
  {
    id: 'move',
    ask: '어떻게 움직여요?',
    lines: () => [
      '가고 싶은 곳을 누르면 걸어가요. 컴퓨터에서는 방향키나 WASD로도 걸을 수 있어요.',
      '화면을 꾹 누른 채 끌면 둘러볼 수 있어요. 오른쪽 위 버튼(Q·E 키)으로 돌리고, 시점 버튼(V 키)으로 가까이·멀리 볼 수 있어요.',
      '아래 몸짓 버튼으로 응원·박수·하트를 보내 이웃과 인사해 보세요!',
    ],
  },
  {
    id: 'play',
    ask: '뭐 하고 놀 수 있어요?',
    lines: () => [
      '광장의 분홍 운세 나무에서 하루 한 번 운세 열매를 딸 수 있어요. 지역마다 있는 열매 나무에서는 사과·복숭아·감·배·포도를 따요.',
      "'낚시터' 간판 옆 비콘으로 가면 낚시를, 'CLUB' 간판 옆 비콘으로 가면 음악에 맞춰 춤을 출 수 있어요.",
      '모은 열매와 물고기는 위쪽 가방 버튼에서 볼 수 있어요. 물고기 도감을 다 채워 보세요!',
    ],
  },
  {
    id: 'home',
    ask: '내 집은 어디예요?',
    lines: (guest) =>
      guest
        ? ["아직 집이 없네요! 아래 '나도 집 짓기'를 누르면 생일로 사는 지역을 정하고 집을 지어 드려요.", '집이 생기면 방을 꾸미고, 이웃 집에도 놀러 갈 수 있어요.']
        : ['위쪽 집 버튼을 누르면 내 집 앞으로 바로 가요. 문 앞에서 들어가기를 누르면 내 방이에요.', '이웃 집 문 앞에서는 놀러 갈 수 있어요. 광장 게시판에서는 오늘의 토론에 참여해 보세요.'],
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
