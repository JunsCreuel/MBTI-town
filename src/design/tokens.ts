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
    /** 유튜브 신청곡 표시 */
    youtube: '#D93A3F',
    /** 황금 고래·신화 표시 (금빛 띠의 바탕, 진한 금색, 글자) */
    goldSoft: '#FFF4CF',
    gold: '#F2C14E',
    goldBright: '#FFE08A',
    goldInk: '#5A4100',
    goldGlow: 'rgb(242 193 78 / 0.55)',
    shadow: 'rgb(40 50 64 / 0.1)',
    scrim: 'rgb(40 50 64 / 0.72)',
  },
  /** 16유형 마을 색: 기질 그룹 색(groupNT·NF·SJ·SP)에서 명도만 바꾼다 (src/design/mbti.ts mbtiColor와 같은 값) */
  district: {
    INTJ: '#4834EA',
    INTP: '#6959EE',
    ENTJ: '#8B7FF2',
    ENTP: '#A89FF5',
    INFJ: '#309169',
    INFP: '#3AB07F',
    ENFJ: '#4EC593',
    ENFP: '#69CDA4',
    ISTJ: '#216FBE',
    ISFJ: '#2D84DB',
    ESTJ: '#4F98E1',
    ESFJ: '#6EAAE6',
    ISTP: '#E3990F',
    ISFP: '#F1AC2A',
    ESTP: '#F3BA50',
    ESFP: '#F6C872',
  },
  /** 오늘의 토론 성향 팀 색 (축마다 서로 잘 구분되는 두 색) */
  axis: {
    E: '#F08A6C',
    I: '#5B7FD6',
    S: '#D9A54C',
    N: '#9B7BE0',
    T: '#3E8EDE',
    F: '#F27E9C',
    J: '#3FAF7F',
    P: '#F2B33D',
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
  /** 캐릭터 피부색 (avatar.ts SKIN_TONES. natural은 모델 원래 색이라 몸마다 따로) */
  avatarSkin: {
    fair: '#FBE0CF',
    honey: '#E8B48C',
    tan: '#CD9468',
    brown: '#A06644',
    deep: '#6C4431',
  },
  avatarSkinNatural: { male: '#F5C2A3', female: '#FCB993' },
  /** 캐릭터 머리 색 (avatar.ts HAIR_COLORS. natural은 모델 원래 색이라 몸마다 따로) */
  avatarHair: {
    black: '#26211F',
    brown: '#6B4532',
    blonde: '#E9C46F',
    red: '#C2583B',
    pink: '#F3A2BF',
    lavender: '#B7A3EC',
    mint: '#8AD7C2',
    silver: '#D8DBE2',
  },
  avatarHairNatural: { male: '#754134', female: '#31160C' },
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
    /** 집 안에서 벽 너머(방 밖)의 어둠. 방이 무대처럼 떠 보이게 따뜻한 어두운 색 */
    outside: '#2B2731',
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
    /** 현관문(나무)과 손잡이 (1인칭으로 들어설 때 열린다) */
    door: '#C8976A',
    doorKnob: '#E8C36A',
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
    /** 클럽 (실내): 벽 밖은 어둠, 짙은 바닥, 보랏빛 조명, 네온 색 */
    clubVoid: '#09080F',
    clubFloor: '#2C2739',
    clubFloorEdge: '#1F1B29',
    clubLight: '#B9A8FF',
    clubHemiSky: '#7C6CDB',
    clubHemiGround: '#2B1D3B',
    clubTileOff: '#1A1824',
    clubNeon: ['#FF5FA2', '#7C6BFF', '#3CC8FF', '#5BE38C', '#FFD24A'],
    clubBall: '#E4E2F2',
    /** 비콘 간판: 나무 간판(낚시터·광장)과 네온 간판(클럽) */
    signWood: '#B98556',
    signWoodDark: '#7E5236',
    signFace: '#FFF4DF',
    signInk: '#2F7FB8',
    signSub: '#8A7A66',
    signDark: '#1C1726',
    signNeonSub: '#B9A8FF',
    signExit: '#5BE38C',
    /** 낚시: 찌(빨강·하양), 낚싯줄, 물보라 */
    bobberTop: '#E2483D',
    bobberBottom: '#FFFFFF',
    fishingLine: '#F4F1EA',
    splash: '#DDF3FF',
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
  vars['--room-outside'] = tokens.room.outside;
  vars['--font-base'] = tokens.font.base;
  for (const [k, v] of Object.entries(tokens.radius)) vars[`--radius-${k}`] = `${v}px`;
  tokens.space.forEach((v, i) => (vars[`--space-${i}`] = `${v}px`));
  return vars;
}
