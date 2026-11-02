// 운영 중 바꿀 수 있어야 하는 값은 코드에 박지 않고 여기에 둔다 (PROJECT_GUIDE.md 3부 2번).

export const plazaConfig = {
  /** Colyseus 방 이름 */
  roomName: 'plaza',
  /** 방(채널)당 정원. 서버에서는 PLAZA_ROOM_CAPACITY 환경변수가 있으면 그 값을 쓴다. */
  roomCapacity: 100,
  /** 클라이언트가 위치를 보내는 최대 빈도 (초당). 가이드 기준 10회 이하. */
  moveSendHz: 10,
  /** 서버가 상태를 내려보내는 주기 (ms) */
  patchRateMs: 100,
  /** 걷는 속도 (타일/초) */
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
} as const;

/** 대진 방식. 초기 인원이 적으면 축 대전이나 기질 그룹 대전으로 바꾼다. */
export type MatchupMode = 'type' | 'axis' | 'temperament';

// 토론 매치 규칙 (PROJECT_GUIDE.md 7장). 시간과 숫자는 모두 가안이다.
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
