// 색, 폰트, 간격, 둥글기 토큰. 코드에서는 색 값을 직접 쓰지 않고 이 파일만 참조한다.
// 값은 가안이다 (PROJECT_GUIDE.md 13장).
export const tokens = {
  color: {
    bg: '#FFF9F2',
    surface: '#FFFFFF',
    text: '#2B2B33',
    textSub: '#6B6B76',
    border: '#ECE4DA',
    accent: '#5B6CFF',
    accentText: '#FFFFFF',
    // 기질 그룹 색: 마을 구역과 팀 표시에 쓴다
    groupNT: '#7A6CF0', // 분석가
    groupNF: '#3FBF8A', // 외교관
    groupSJ: '#3E8EDE', // 관리자
    groupSP: '#F2B33D', // 탐험가
    win: '#2FB36B',
    lose: '#9A9AA5',
    danger: '#E5484D',
    shadow: 'rgb(43 43 51 / 0.1)',
    scrim: 'rgb(43 43 51 / 0.72)',
  },
  // 3D 광장 장면 색
  scene: {
    skyTop: '#5DB6F2',
    skyHorizon: '#D6EEFF',
    fog: '#D9EFFF',
    cloud: '#FFFFFF',
    sun: '#FFF1D8',
    hemiSky: '#DDF0FF',
    hemiGround: '#D8D2A6',
    grass: '#8FD06E',
    grassDark: '#7BC15C',
    grassTuft: '#A6DD82',
    path: '#E6CFA6',
    pathPebble: '#CDB894',
    stone: '#F1E6D6',
    stoneGrout: '#D3C3AD',
    stoneSide: '#CDBBA2',
    soil: '#9C7457',
    planter: '#C79466',
    hedge: '#5FAE5A',
    leaf: '#6FBF62',
    water: '#8ED2F2',
    flowerPink: '#FF9FC0',
    flowerYellow: '#FFDA6B',
    flowerWhite: '#FFFFFF',
    flowerLilac: '#C9B4FF',
    shadow: '#2B2B33',
    tagBg: '#FFFFFF',
    tagText: '#2B2B33',
    heart: '#FF6F96',
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
  vars['--font-base'] = tokens.font.base;
  for (const [k, v] of Object.entries(tokens.radius)) vars[`--radius-${k}`] = `${v}px`;
  tokens.space.forEach((v, i) => (vars[`--space-${i}`] = `${v}px`));
  return vars;
}
