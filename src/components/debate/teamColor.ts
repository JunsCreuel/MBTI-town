// 팀 표시 색. 유형 팀은 유형 색, 기질 그룹 팀은 그룹 색, 축 대전은 두 팀에 서로 다른 색.
import { MBTI_GROUPS, isMbtiType, mbtiColor, withMaxLightness } from '@/design/mbti';
import { tokens } from '@/design/tokens';
import type { Side, Team } from '@/shared/debate';

export function teamColor(team: Team, side: Side): string {
  if (team.kind === 'type' && isMbtiType(team.id)) return mbtiColor(team.id);
  if (team.kind === 'group') {
    const g = MBTI_GROUPS.find((x) => x.id === team.id);
    if (g) return tokens.color[g.colorToken];
  }
  return side === 'a' ? tokens.color.accent : tokens.color.groupSP;
}

/** 팀 색을 글자에 쓸 때: 밝은 유형 색은 흰 바탕에서 읽기 어려워 조금 어둡게 한다 */
export function teamInk(team: Team, side: Side): string {
  return withMaxLightness(teamColor(team, side), 0.48);
}

/** 테두리·점은 --team-color, 글자는 --team-ink */
export function teamVars(team: Team, side: Side): Record<string, string> {
  return { '--team-color': teamColor(team, side), '--team-ink': teamInk(team, side) };
}
