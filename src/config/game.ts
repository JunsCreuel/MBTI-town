// 운영 중 바꿀 수 있어야 하는 값은 코드에 박지 않고 여기에 둔다 (PROJECT_GUIDE.md 3부 2번).

// 나의 방 (PROJECT_GUIDE.md 6장)
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
