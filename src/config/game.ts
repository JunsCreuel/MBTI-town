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
  /** 클라이언트 한 명이 1초에 보낼 수 있는 메시지 수. 넘으면 연결을 끊는다. */
  maxMessagesPerSecond: 30,
  /** 응원·박수 동작 길이 (ms) */
  actionDurationMs: 1600,
  /** 동작·이모티콘 재사용 대기 (ms) */
  emoteCooldownMs: 1200,
  /** 머리 위 이모티콘 표시 시간 (ms) */
  emoteDurationMs: 1800,
  /** 한 화면에 그리는 다른 사람 수 상한 (가까운 순). 저가폰 성능을 위한 값이다. */
  maxVisiblePlayers: 40,
  /** 지도에서 고른 곳으로 바로 가기 재사용 대기 (ms) */
  warpCooldownMs: 1500,
  /** 지역마다 집터 수. 마을 맵 생성기와 집터 배정이 같이 쓴다. 다 차면 새 동네 확장은 [결정 필요] */
  lotsPerDistrict: 20,
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
  /** 카메라: 위에서 내려다보는 각도와 방향 (도). 아이소메트릭 느낌으로 비스듬히 본다. */
  pitchDeg: 33,
  yawDeg: 45,
  /** 방 전체가 화면에 들어오게 맞출 때의 여백 배율 */
  framePadding: 1.12,
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
  guestbookMax: 300,
  /** 마을 지도에서 지역마다 보여 줄 방 수 */
  exploreLimit: 24,
  /** 방명록을 한 번에 보여 줄 수 */
  guestbookPageSize: 30,
  /** 방문 기록을 보여 줄 기간 (일) */
  visitDays: 30,
} as const;

/** 대진 방식. 초기 인원이 적으면 축 대전이나 기질 그룹 대전으로 바꾼다. */
export type MatchupMode = 'type' | 'axis' | 'temperament';

// 오늘의 토론: 중앙광장 이벤트 (PROJECT_GUIDE.md 10장). 시간과 숫자는 모두 가안이다.
export const debateConfig = {
  /** 하루 경기 시간표 (한국 시간). 칸 하나가 한 경기다. 하루 1~2경기. */
  slots: [{ opensAt: '00:00', writingEndsAt: '18:00', votingEndsAt: '21:00' }],
  /** 시간표 기준 시간대 (UTC 기준 분). 한국은 +9시간, 서머타임 없음. */
  utcOffsetMinutes: 540,
  matchupMode: 'type' as MatchupMode,
  /** 논거 한 개 최대 글자 수 */
  argumentMaxLength: 300,
  argumentMinLength: 10,
  /** 한 사람이 한 경기에 낼 수 있는 논거 수 */
  argumentsPerUser: 1,
  /** 팀 대표 논거 수 (팀 안 추천 상위 N개) */
  representativeArgs: 3,
  /**
   * 관전 판정 집계 방식. 관전자는 대표 논거 하나를 고르고, 그 논거의 팀에 한 표가 간다.
   * byType: 유형마다 같은 무게로 센다 (사람이 많은 유형이 투표를 좌우하지 않게).
   * none: 표 수 그대로 센다.
   */
  voteNormalization: 'byType' as 'byType' | 'none',
  /** MBTI를 바꾼 뒤 다시 바꿀 수 있을 때까지 (일). 팀을 옮겨 다니며 참여하는 걸 막는다. */
  mbtiChangeCooldownDays: 7,
  /** 결과 집계가 이 시간(분) 넘게 끝나지 않으면 멈춘 것으로 보고 다시 집계한다 */
  judgingStaleMinutes: 10,
} as const;
