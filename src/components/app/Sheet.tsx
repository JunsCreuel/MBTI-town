'use client';

// 아래에서 올라오는 시트. 바깥을 누르거나 Esc로 닫는다.
import { useEffect } from 'react';
import { Icon } from './Icon';

export function Sheet({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet" role="dialog" aria-modal aria-label={title} onClick={onClose}>
      <div className={`sheet__panel${wide ? ' sheet__panel--wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <h2 className="sheet__title">{title}</h2>
          <button className="icon-btn icon-btn--plain" onClick={onClose} aria-label="닫기">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </div>
  );
}
