// 색, 폰트, 간격, 둥글기 토큰. 코드에서는 색 값을 직접 쓰지 않고 이 파일만 참조한다.
// 방향: Nostalgic × Dreamy × Minimal. 파스텔 민트와 하늘색 (PROJECT_GUIDE.md 14, 19장). 값은 가안이다.
export const tokens = {
  color: {
    bg: '#F2FAF8',
    bgAlt: '#EAF5FC',
    surface: '#FFFFFF',
    text: '#283240',
    textSub: '#667085',
    border: '#DCEBE8',
    /** 강조(민트). 흰 글자를 올리는 버튼 배경 */
    accent: '#2E9E86',
    /** 강조색 글자 (밝은 바탕 위) */
    accentInk: '#1F7F6B',
    accentSoft: '#DDF3EE',
    accentText: '#FFFFFF',
    sky: '#6FB3E3',
    skySoft: '#E3F1FB',
    // 기질 그룹 색: 오늘의 토론 팀 표시에 쓴다
    groupNT: '#7A6CF0', // 분석가
    groupNF: '#3FBF8A', // 외교관
    groupSJ: '#3E8EDE', // 관리자
    groupSP: '#F2B33D', // 탐험가
    win: '#2FB36B',
    lose: '#9A9AA5',
    danger: '#E5484D',
    shadow: 'rgb(40 50 64 / 0.1)',
    scrim: 'rgb(40 50 64 / 0.72)',
  },
  /** 다섯 거주 지역 색 */
  district: {
    wood: '#6DBB7E',
    fire: '#F08A6C',
    earth: '#D9B57C',
    metal: '#9EABBD',
    water: '#6F9BDB',
  },
  /** 감정 아이콘 색 (감정에 따라 점수나 보상을 다르게 주지 않는다) */
  emotion: {
    calm: '#6CC3AE',
    joy: '#EDB53C',
    flutter: '#F08DAE',
    tired: '#9C97C4',
    sad: '#6F9EDB',
    complex: '#A98ED0',
    angry: '#EA8467',
  },
  /** 취향 고르기의 색 견본 */
  taste: {
    mint: '#A7E0CF',
    green: '#8CCB8F',
    coral: '#F59C8C',
    peach: '#FFC9B3',
    cream: '#FBF1E2',
    butter: '#FFE6A1',
    silver: '#C9D0D9',
    white: '#FFFFFF',
    sky: '#B4DBF6',
    lavender: '#D9CBF3',
  },
  /** 캐릭터 색 */
  avatar: {
    mint: '#9EDCCB',
    sky: '#A9D3F2',
    peach: '#FFC4A8',
    butter: '#FFE08F',
    lilac: '#D2C3F0',
    coral: '#F7A08F',
    sage: '#B6CFA3',
    navy: '#7287B8',
  },
  /** 3D 방 색 */
  room: {
    wall: {
      mint: '#D9F1EA',
      sky: '#DDEEFA',
      cream: '#FBF1E2',
      peach: '#FDE4D8',
      lilac: '#ECE5F8',
      'mint-stripe': '#D9F1EA',
      'sky-dot': '#DDEEFA',
      night: '#34406A',
    },
    /** 줄무늬·물방울 무늬 색 */
    wallPattern: {
      'mint-stripe': '#C4E8DD',
      'sky-dot': '#C4E0F5',
      night: '#F6EDC4',
    },
    floor: {
      oak: '#E8CBA3',
      walnut: '#B07E57',
      tile: '#F3F5F8',
      'mint-tile': '#CDEBE2',
      carpet: '#CBE2F4',
    },
    /** 바닥 판자 사이 줄, 타일 줄눈 */
    floorLine: 'rgb(60 40 20 / 0.12)',
    /** 벽 윗면과 걸레받이 */
    trim: '#FFFFFF',
    /** 방 밖 배경 */
    backdropTop: '#EAF5FC',
    backdropBottom: '#F2FAF8',
    sun: '#FFF3DE',
    hemiSky: '#EEF7FF',
    hemiGround: '#F2E4CF',
    /** 저녁·밤에 창밖 풍경과 빛에 곱하는 색 */
    evening: '#FFD9C2',
    night: '#8E99C9',
    /** BGM이 나올 때 턴테이블 위 음표 */
    note: '#2E9E86',
    /** 고른 소품·놓을 자리 표시 */
    select: '#2E9E86',
    invalid: '#E5484D',
  },
  /** 3D 마을과 결과 카드 배경 */
  scene: {
    skyTop: '#8FCBF2',
    skyHorizon: '#E3F3FC',
    fog: '#E3F1FA',
    cloud: '#FFFFFF',
    sun: '#FFF3DE',
    hemiSky: '#E6F4FF',
    hemiGround: '#DCD6AE',
    grass: '#9ED6A3',
    grassDark: '#86C98E',
    grassTuft: '#B2E0B2',
    path: '#EAD7B4',
    pathPebble: '#D2BF9C',
    stone: '#F3EADC',
    stoneGrout: '#D8C9B4',
    stoneSide: '#D0BFA7',
    soil: '#A07A5C',
    planter: '#CB9B6E',
    hedge: '#6DB86A',
    leaf: '#7CC572',
    sea: '#8CCDEE',
    /** 먼바다 */
    seaDeep: '#5FAFDF',
    /** 물가 얕은 물 */
    seaShallow: '#A6E3E6',
    /** 물거품 */
    foam: '#F4FBFF',
    sand: '#F4E6BE',
    sandSide: '#DFCB98',
    /** 하루의 빛 (새벽·노을·밤) */
    dawnTop: '#9EC3EC',
    dawnHorizon: '#FCD9C4',
    dawnSun: '#FFD2A8',
    duskTop: '#7E8FD0',
    duskHorizon: '#FFB59A',
    duskSun: '#FFB27E',
    duskHemi: '#F7D6E0',
    nightTop: '#1E2A55',
    nightHorizon: '#4A5A92',
    nightFog: '#33416F',
    nightHemi: '#8D9ED8',
    nightGround: '#3D4A6B',
    moon: '#C6D3FF',
    /** 밤에 켜지는 창문·가로등 빛 */
    windowGlow: '#FFD58A',
    firefly: '#E9FF8A',
    butterfly: '#FFFFFF',
    /** 전체 지도의 지역 경계선 */
    mapBorder: '#FFFFFF',
    flowerPink: '#FFA9C6',
    flowerYellow: '#FFDE7A',
    flowerWhite: '#FFFFFF',
    flowerLilac: '#CDBBFF',
    tagBg: '#FFFFFF',
    tagText: '#283240',
    heart: '#FF7A9C',
  },
  font: {
    base: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif",
  },
  radius: { sm: 8, md: 12, lg: 20 },
  space: [0, 4, 8, 12, 16, 24, 32, 48],
} as const;

export type ColorToken = keyof typeof tokens.color;

/** CSS 변수로 내보낸다. globals.css는 이 변수만 쓴다. */
export function tokensToCssVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(tokens.color)) vars[`--color-${k}`] = v;
  for (const [k, v] of Object.entries(tokens.district)) vars[`--district-${k}`] = v;
  for (const [k, v] of Object.entries(tokens.emotion)) vars[`--emotion-${k}`] = v;
  vars['--font-base'] = tokens.font.base;
  for (const [k, v] of Object.entries(tokens.radius)) vars[`--radius-${k}`] = `${v}px`;
  tokens.space.forEach((v, i) => (vars[`--space-${i}`] = `${v}px`));
  return vars;
}
