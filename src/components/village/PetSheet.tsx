'use client';

// 펫 불러오기: 펫을 고르면 내 옆을 따라다닌다 (지금은 강아지 하나, src/shared/pets.ts에 하나씩 늘려 간다).
// 지어 준 이름이 있으면 그 이름으로 보이고, 데리고 있는 펫은 이름을 바꾸거나 집에 보낼 수 있다.
import { assetUrl } from '@/assets/manifest';
import { Sheet } from '@/components/app/Sheet';
import { petNameOf, type Avatar } from '@/shared/avatar';
import { PETS, isPetId } from '@/shared/pets';

export function PetSheet({
  current, petNames, onPick, onRename, onClose,
}: {
  current: string;
  petNames: Avatar['petNames'];
  onPick: (pet: string) => void;
  onRename: (pet: string) => void;
  onClose: () => void;
}) {
  const named = { petNames };
  return (
    <Sheet title="펫 불러오기" onClose={onClose}>
      <div className="pets">
        <ul className="inventory__grid">
          {PETS.map((p) => {
            const on = p.id === current;
            return (
              <li key={p.id}>
                <button className={`inventory__item${on ? ' inventory__item--on' : ''}`} aria-pressed={on} onClick={() => onPick(p.id)} disabled={on}>
                  <img className="pets__photo" src={assetUrl(p.thumb)} alt="" width={84} height={84} draggable={false} />
                  {petNameOf(named, p.id)}
                  {on && <span className="tag">산책 중</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {isPetId(current) && (
          <div className="pets__actions">
            <button className="btn-secondary" onClick={() => onRename(current)}>
              이름 짓기
            </button>
            <button className="btn-secondary" onClick={() => onPick('')}>
              집에 보내기
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
