'use client';

// 펫 불러오기: 펫을 고르면 내 옆을 따라다닌다 (지금은 강아지 하나, src/shared/pets.ts에 하나씩 늘려 간다).
import { Icon } from '@/components/app/Icon';
import { Sheet } from '@/components/app/Sheet';
import { PETS, petDef } from '@/shared/pets';

export function PetSheet({ current, onPick, onClose }: { current: string; onPick: (pet: string) => void; onClose: () => void }) {
  const out = petDef(current);
  return (
    <Sheet title="펫 불러오기" onClose={onClose}>
      <div className="pets">
        <ul className="inventory__grid">
          {PETS.map((p) => {
            const on = p.id === current;
            return (
              <li key={p.id}>
                <button className={`inventory__item${on ? ' inventory__item--on' : ''}`} aria-pressed={on} onClick={() => onPick(p.id)} disabled={on}>
                  <Icon name="paw" size={34} className="pets__icon" />
                  {p.name}
                  {on && <span className="tag">산책 중</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {out && (
          <button className="btn-secondary" onClick={() => onPick('')}>
            {out.name} 집에 보내기
          </button>
        )}
      </div>
    </Sheet>
  );
}
