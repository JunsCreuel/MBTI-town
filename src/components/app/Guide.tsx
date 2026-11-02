// 안내 캐릭터 말풍선. 구름이는 단계 안내, 몬냥이는 첫 화면과 빈 화면에 나온다 (최종 디자인은 [결정 필요]).
import { assetUrl } from '@/assets/manifest';

export function Guide({ who = 'gureum', children, size = 56 }: { who?: 'gureum' | 'monnyang'; children: React.ReactNode; size?: number }) {
  return (
    <div className="guide">
      {/* eslint-disable-next-line @next/next/no-img-element -- 작은 SVG */}
      <img className="guide__face" src={assetUrl(`char.guide.${who}`)} alt={who === 'gureum' ? '구름이' : '몬냥이'} width={size} height={size} />
      <div className="guide__bubble">{children}</div>
    </div>
  );
}
