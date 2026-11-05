'use client';

// 펫 이름 짓기 (방에서 강아지를 누르거나, 마을 펫 시트에서). 계정에 저장되고, 내 방에 놀러 온 이웃에게도 보인다.
import { useState } from 'react';
import { call, errorMessage } from '@/lib/api';
import { PET_NAME_MAX, type Avatar } from '@/shared/avatar';
import { petDef, type PetId } from '@/shared/pets';
import { withEulReul } from '@/shared/josa';
import { Sheet } from './Sheet';

export function PetNameSheet({
  pet, current, onSaved, onClose,
}: {
  pet: PetId;
  /** 지금 이름 (지어 준 이름이 없으면 '') */
  current: string;
  onSaved: (avatar: Avatar) => void;
  onClose: () => void;
}) {
  const kind = petDef(pet)?.name ?? '펫';
  const [name, setName] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setBusy(true);
    setError('');
    try {
      const profile = await call<{ avatar: Avatar }>('PATCH', '/api/me', { petNames: { [pet]: name.trim() } });
      onSaved(profile.avatar);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Sheet title={`${withEulReul(kind)} 부를 이름`} onClose={onClose}>
      <form
        className="pet-name"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="field">
          <span>이름 ({PET_NAME_MAX}자까지)</span>
          <input value={name} maxLength={PET_NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder={`예: 몽이 (비우면 ${kind})`} autoFocus />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn-primary" type="submit" disabled={busy || name.trim() === current}>
          {busy ? '저장하는 중…' : '이름 짓기'}
        </button>
      </form>
    </Sheet>
  );
}
