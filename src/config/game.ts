// 운영 중 바꿀 수 있어야 하는 값은 코드에 박지 않고 여기에 둔다 (PROJECT_GUIDE.md 3부 2번).

// 마을 (PROJECT_GUIDE.md 3장): 걸어 다니는 3D 마을. 가운데 중앙광장 + 둘레 다섯 지역(오행), 지역마다 주민의 집.
export const townConfig = {
  /** Colyseus 방 이름 */
  roomName: 'town',
  /** 방(채널)당 정원. 실시간 서버에서는 TOWN_ROOM_CAPACITY 환경변수가 있으면 그 값을 쓴다. */
  roomCapacity: 100,
  /** 클라이언트가 위치를 보내는 최대 빈도 (초당) */
  moveSendHz: 10,
  /** 서버가 상태를 내려보내는 주기 (ms) */
  patchRateMs: 100,
  /** 걷는 속도 (칸/초) */
  walkSpeed: 3.5,
  /** 서버 속도 검사 여유 배수. 네트워크 지연으로 몰려 도착하는 경우를 감안한다. */
  speedTolerance: 1.6,
  /**
   * 서버가 한 번에 받아 주는 이동 거리 (칸). 휴대폰 네트워크가 잠깐 멈췄다가 위치 메시지가 몰려 와도
   * 캐릭터를 뒤로 되돌리지 않게, 1초 남짓 걸은 거리만큼 둔다. 오래 빨리 가는 것은 speedTolerance가 막는다.
   */
  moveBurstTiles: 3.5,
  /** 클라이언트 한 명이 1초에 보낼 수 있는 메시지 수. 넘으면 연결을 끊는다 (네트워크가 몇 초 멈췄다 몰려 와도 넘지 않게). */
  maxMessagesPerSecond: 60,
  /** 다른 사람 캐릭터를 이만큼 늦게 그려서, 띄엄띄엄 도착하는 위치 사이를 고르게 잇는다 (초) */
  remoteDelaySec: 0.15,
  /** 화면이 이 초당 프레임보다 느리면 해상도를 한 단계씩 낮춘다 (휴대폰 끊김 줄이기) */
  minFps: 45,
  /** 응원·박수 동작 길이 (ms) */
  actionDurationMs: 2000,
  /** 폴짝(점프) 한 번 길이 (ms, 점프 동작 길이와 같다). 걸으면서도 뛸 수 있다 */
  jumpMs: 700,
  /** 점프할 때 몸이 솟는 높이 (칸). 동작의 웅크렸다 뛰는 움직임에 더한다 */
  jumpHeight: 0.28,
  /** 클럽 바: 이만큼 마셔도 멀쩡하다 (잔). 그 위로 한 잔마다 조금씩 더 취한다 */
  drinksBeforeTipsy: 2,
  /** 한 잔이 깨는 데 걸리는 시간 (ms). 시간이 지나면 저절로 깬다 (가장 많이 취해도 2분이면 다 깬다) */
  soberMsPerDrink: 30000,
  /** 더 마셔도 이 이상 취하지 않는다 (잔) */
  maxDrinks: 6,
  /** 클럽: 한 사람이 신청하고 다음 신청까지 쉬는 시간 (ms) */
  musicRequestCooldownMs: 5000,
  /** 클럽: 신청곡 대기열에 기다릴 수 있는 곡 수 (채널마다) */
  musicQueueMax: 10,
  /** 클럽: 한 사람이 대기열에 올려 둘 수 있는 곡 수 */
  musicQueuePerPerson: 2,
  /** 낚시 동작 길이 (ms): 던지고 기다렸다가 낚아 올릴 때까지 낚싯대를 들고 있다 (걸으면 끝난다) */
  fishActionMs: 9000,
  /** 동작·이모티콘 재사용 대기 (ms) */
  emoteCooldownMs: 1200,
  /** 머리 위 이모티콘 표시 시간 (ms) */
  emoteDurationMs: 1800,
  /** 한 화면에 그리는 다른 사람 수 상한 (가까운 순). 저가폰 성능을 위한 값이다. */
  maxVisiblePlayers: 40,
  /** 지도에서 고른 곳으로 바로 가기 재사용 대기 (ms) */
  warpCooldownMs: 1500,
  /** 지역 1동(본섬) 집터 수. 마을 맵 생성기와 집터 배정이 같이 쓴다. */
  lotsPerDistrict: 20,
  /** 2동·3동… 동네 하나의 집터 수 (동네 틀 맵 map.hood). 앞 동네가 다 차면 다음 동네가 열린다. */
  hoodLots: 24,
  /** 한 지역에서 열 수 있는 동네 번호 상한 (실시간 서버가 받는 방 이름 검사용) */
  maxHoods: 99,
  /** 실시간 서버 입장 토큰 유효 시간 (초) */
  tokenTtlSeconds: 600,
  /** 집 이름표가 보이는 거리 (칸) */
  nameplateDistance: 10,
  /** 지역 잔디에 지역 색을 섞는 정도 (0~1) */
  groundTint: 0.16,
  /** 마을 집 목록(이름표)을 다시 받는 주기 (ms) */
  refreshMs: 60_000,
  /** 집 문 앞에서 "들어가기"가 뜨는 거리 (칸) */
  doorDistance: 1.6,
} as const;

export const cameraConfig = {
  /** 내려다보는 각도 (도). 가까이 당기면 낮아져 하늘이 보이고, 멀리 빼면 높아진다. */
  pitchNearDeg: 16,
  pitchFarDeg: 46,
  /** 화각이 넓으면 화면 가장자리 물체가 기울어 보여서 좁게 둔다 */
  fov: 30,
  distance: 15,
  /** 세로 화면(휴대폰)은 좌우가 좁아서 조금 더 멀리서 본다 */
  portraitDistance: 19,
  minDistance: 8,
  maxDistance: 26,
  /** 전체 지도: 위에서 내려다보는 각도 (도, 90이면 바로 위) */
  mapPitchDeg: 72,
  /**
   * 시점 버튼(단축키 V)이 차례로 고르는 거리. 기본 → 가까이 → 멀리 → 기본…
   * 'normal'의 거리는 화면 방향에 따라 distance / portraitDistance를 쓴다. 가까울수록 낮게 봐서 하늘이 보인다.
   */
  views: [
    { id: 'normal', label: '기본', distance: 0 },
    { id: 'near', label: '가까이', distance: 9 },
    { id: 'far', label: '멀리', distance: 24 },
  ],
  /** 회전 버튼·단축키(Q/E) 한 번에 카메라가 도는 각도 (도) */
  rotateStepDeg: 45,
  /** 화면을 옆으로 끌어서 돌릴 때 1px당 각도 (도). 화면 너비만큼 끌면 반 바퀴 남짓 */
  dragRotateDegPerPx: 0.15,
} as const;

// 마을 놀거리 (PROJECT_GUIDE.md 3장): 열매 따기·운세 열매·낚시
export const playConfig = {
  /** 지역마다 열매 나무 수 (마을 맵 생성기와 서버 검사가 같이 쓴다) */
  fruitTreesPerDistrict: 3,
  /** 나무 하나에서 하루에 따는 열매 수 */
  fruitsPerTree: 3,
  /** 하루 낚시 상한 (화면에 보여 주지 않는다. 자동으로 계속 던지는 것만 막는 넉넉한 값) */
  fishPerDay: 300,
  /** 던졌는데 아무것도 안 걸릴(꽝) 확률 */
  fishMissRate: 0.22,
  /** 황금 고래: 던질 때마다 0.001% (10만 번에 한 번). 낚으면 서버 전체 공지 */
  goldenWhaleChance: 0.00001,
  /** 나무·낚시 자리에서 버튼이 뜨는 거리 (칸) */
  reach: 1.9,
} as const;

/** 게임 코인: 낚시·열매로 모은다 (현금으로 사거나 바꿀 수 없다) */
export const coinConfig = {
  /** 물고기 한 마리 값 (흔해요·드물어요·전설·신화·잡동사니) */
  fish: { common: 10, rare: 40, legend: 300, mythic: 10_000, junk: 2 },
  /** 열매 한 개 값 */
  fruit: 5,
  /** 운세 열매 값 */
  fortune: 10,
} as const;

/** 사주상담소 (부엉 도사, 광장): 복채와 이용권 (PROJECT_GUIDE.md 3장) */
export const sajuConfig = {
  /** 기간 풀이 복채 (코인). 같은 기간은 다시 봐도 무료 */
  fee: { today: 10, tomorrow: 10, week: 30, month: 50 },
  /** 사주 이용권: 낚시에서 던질 때마다 0.001% (잡으면 서버 전체 공지) */
  ticketChance: 0.00001,
  /** 상세 풀이 유료 가격 (아직 결제 없음, 화면에 "준비 중"으로 보인다) [결정 필요] */
  premiumPriceLabel: '3,900원',
  /** 도사 앞 이 거리(칸) 안이면 "사주 보기" 버튼 */
  reach: 2.6,
} as const;

/** 상가: 중앙광장 비콘(언덕 지역 쪽)으로 가는 섬의 점포 20칸 (PROJECT_GUIDE.md 3장) */
export const marketConfig = {
  shops: 20,
  /** 점포 값 (코인). 하루 30번쯤 낚시하면 일주일쯤 모은다 */
  price: 3000,
  nameMax: 12,
  introMax: 40,
  /** 점포를 내놓으면 돌려받는 몫 */
  refundRate: 0.5,
  /** 점포 앞 이 거리(칸) 안이면 "점포 보기" 버튼이 뜬다 */
  reach: 1.9,
} as const;

// 나의 방 = 마을 속 내 집의 안 (PROJECT_GUIDE.md 6장)
export const roomConfig = {
  /** 바닥 칸 수 (가로 x, 세로 z). 방 크기 확장은 2차 */
  width: 6,
  depth: 6,
  /** 벽 높이 (칸) */
  wallHeight: 3,
  /** 방 하나에 둘 수 있는 소품 수 */
  maxItems: 60,
  /** 캐릭터 걷는 속도 (칸/초) */
  walkSpeed: 2.2,
  /** 실시간 서버의 방(집 안) 이름. 집마다 따로 열린다 */
  realtimeRoomName: 'house',
  /** 한 집에 같이 있을 수 있는 사람 수 (주인 + 손님) */
  maxPeople: 8,
  /**
   * 카메라 (원근). 집 안에 들어온 것처럼, 방 앞쪽 위에서 캐릭터를 따라가며 비스듬히 내려다본다.
   * 꾸미기와 가입 미리보기는 방 전체가 보이게 더 높이서 본다.
   */
  fovDeg: 38,
  /** 내려다보는 각도 (도): 가로 화면, 세로 화면(휴대폰), 방 전체 보기 */
  pitchDeg: 38,
  portraitPitchDeg: 48,
  overviewPitchDeg: 52,
  /** 방 전체가 화면(HUD 사이)에 들어오게 맞출 때의 여백 배율 */
  framePadding: 1.06,
  /** 보기에서 휠·두 손가락으로 다가갈 수 있는 정도 (방 전체 거리의 비율). 다가가면 캐릭터를 따라간다 */
  minZoom: 0.5,
  /** 방에 들어설 때 카메라가 다가오는 시간 (초) */
  enterSec: 1.2,
} as const;

// 기록과 사진 (8장)
export const recordConfig = {
  /** 기록 글자 수 상한 */
  bodyMax: 2000,
  /** 감정 기록 한 줄 상한 */
  lineMax: 120,
  /** 사진: 화면에서 긴 변을 이 크기로 줄여 올린다 (px) */
  photoMaxSide: 1600,
  /** 사진 파일 크기 상한 (바이트) */
  photoMaxBytes: 800 * 1024,
  /** 한 번에 불러오는 기록 수 */
  pageSize: 30,
} as const;

// 소셜 (9장)
export const socialConfig = {
  displayNameMax: 20,
  bioMax: 80,
  /** 주민증 취미 한 줄 */
  hobbyMax: 30,
  guestbookMax: 300,
  /** 마을 지도에서 지역마다 보여 줄 방 수 */
  exploreLimit: 24,
  /** 방명록을 한 번에 보여 줄 수 */
  guestbookPageSize: 30,
  /** 방문 기록을 보여 줄 기간 (일) */
  visitDays: 30,
} as const;

// 오늘의 토론: 중앙광장 이벤트 (PROJECT_GUIDE.md 10장). 시간과 숫자는 모두 가안이다.
export const debateConfig = {
  /** 하루 경기 시간표 (한국 시간). 칸 하나가 한 경기다. 하루 1~2경기. */
  slots: [{ opensAt: '00:00', writingEndsAt: '18:00', votingEndsAt: '21:00' }],
  /** 시간표 기준 시간대 (UTC 기준 분). 한국은 +9시간, 서머타임 없음. */
  utcOffsetMinutes: 540,
  /** 논거 한 개 최대 글자 수 */
  argumentMaxLength: 300,
  argumentMinLength: 10,
  /** 한 사람이 한 경기에 낼 수 있는 논거 수 */
  argumentsPerUser: 1,
  /** 팀 대표 논거 수 (팀 안 추천 상위 N개) */
  representativeArgs: 3,
  /**
   * 관전 판정 집계 방식. 관전자는 대표 논거 하나를 고르고, 그 논거의 팀에 한 표가 간다.
   * byDistrict: 판정 지역마다 같은 무게로 센다 (주민이 많은 지역이 판정을 좌우하지 않게).
   * none: 표 수 그대로 센다.
   */
  voteNormalization: 'byDistrict' as 'byDistrict' | 'none',
  /** MBTI(프로필 태그)를 바꾼 뒤 다시 바꿀 수 있을 때까지 (일) */
  mbtiChangeCooldownDays: 7,
  /** 결과 집계가 이 시간(분) 넘게 끝나지 않으면 멈춘 것으로 보고 다시 집계한다 */
  judgingStaleMinutes: 10,
} as const;
