'use client';

// 강아지 돌보기 (내 방): 친밀도·단계, 오늘 한 것(밥·산책·쓰다듬기), 재주 시키기, 이름 짓기.
import { petCareConfig } from '@/config/game';
import { withGwa } from '@/shared/josa';
import { PET_LEVEL_NAMES, TRICKS, trickUnlocked, type PetCareState, type TrickId } from '@/shared/petCare';
import { Icon } from '../app/Icon';
import { Sheet } from '../app/Sheet';

export function PetCareSheet({
  name, care, busy, onFeed, onTrick, onRename, onClose,
}: {
  name: string;
  /** null = 아직 준비 중 (SQL 실행 전) */
  care: PetCareState | null;
  busy: boolean;
  onFeed: () => void;
  onTrick: (id: TrickId) => void;
  onRename: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet title={`${name} 돌보기`} onClose={onClose}>
      {!care ? (
        <p className="muted">강아지 돌보기는 곧 열려요.</p>
      ) : (
        <div className="petcare">
          <div className="petcare__head">
            <span className="chip chip--on">Lv.{care.level}</span>
            <strong>{PET_LEVEL_NAMES[care.level - 1]}</strong>
            {care.collar && <span className="muted">목걸이를 했어요</span>}
          </div>
          <div className="progress" aria-label={`친밀도 ${care.affection}`}>
            <span style={{ width: `${care.next ? Math.min(100, ((care.affection - care.floor) / (care.next - care.floor)) * 100) : 100}%` }} />
          </div>
          <p className="muted">
            친밀도 {care.affection}
            {care.next ? ` · 다음 단계까지 ${care.next - care.affection}` : ' · 최고 단계'}
          </p>

          <h3 className="petcare__title">오늘</h3>
          <ul className="petcare__today">
            <li>
              <span>밥</span>
              {care.fedToday ? (
                <span className="muted">배불러요</span>
              ) : (
                <button className="btn-primary btn-primary--inline" onClick={onFeed} disabled={busy}>
                  밥 주기 +{petCareConfig.feed}
                </button>
              )}
            </li>
            <li>
              <span>쓰다듬기</span>
              <span className="muted">
                {care.petsToday}/{petCareConfig.petsPerDay}
              </span>
            </li>
            <li>
              <span>산책</span>
              <span className="muted">{care.walkedToday ? '다녀왔어요' : `마을에서 ${withGwa(name)} 같이 걸어요`}</span>
            </li>
          </ul>

          <h3 className="petcare__title">재주</h3>
          <div className="petcare__tricks">
            {TRICKS.map((t) => {
              const open = trickUnlocked(t.id, care.level);
              return (
                <button key={t.id} className="action-btn" disabled={!open || busy} onClick={() => onTrick(t.id)}>
                  {open ? <Icon name="paw" size={20} /> : <Icon name="lock" size={20} />}
                  {open ? t.name : `Lv.${t.level}`}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <button className="btn-secondary" onClick={onRename}>
        이름 짓기
      </button>
    </Sheet>
  );
}
