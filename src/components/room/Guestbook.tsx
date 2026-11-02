'use client';

// 방명록 목록과 쓰기. 방 주인과 쓴 사람은 지울 수 있고, 다른 사람 글은 신고할 수 있다.
import { useState } from 'react';
import { socialConfig } from '@/config/game';
import { tokens } from '@/design/tokens';
import { call, errorMessage } from '@/lib/api';
import type { GuestbookView } from '@/server/scene/service';
import { Icon } from '../app/Icon';

const when = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });

export function Guestbook({
  handle, entries, canWrite, isOwner, onChange,
}: {
  handle: string;
  entries: GuestbookView[];
  canWrite: boolean;
  isOwner: boolean;
  onChange: () => void;
}) {
  const [body, setBody] = useState('');
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function write(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await call('POST', `/api/rooms/${handle}/guestbook`, { body, visibility: friendsOnly ? 'friends' : 'public' });
      setBody('');
      onChange();
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('이 글을 지울까요?')) return;
    await call('DELETE', `/api/guestbook/${id}`).catch(() => {});
    onChange();
  }

  async function report(id: string) {
    if (!confirm('이 글을 신고할까요? 운영자만 볼 수 있어요.')) return;
    await call('POST', '/api/reports', { kind: 'guestbook', targetId: id }).catch(() => {});
    setMessage('신고했어요. 확인 후 조치할게요.');
  }

  return (
    <div className="guestbook">
      {canWrite && (
        <form className="guestbook__form" onSubmit={write}>
          <textarea
            value={body}
            maxLength={socialConfig.guestbookMax}
            onChange={(e) => setBody(e.target.value)}
            placeholder="방 구경 잘 했어요! 한마디 남겨 주세요"
            rows={3}
          />
          <div className="guestbook__row">
            <label className="check">
              <input type="checkbox" checked={friendsOnly} onChange={(e) => setFriendsOnly(e.target.checked)} />
              친구만 보기
            </label>
            <button className="btn-primary btn-primary--inline" disabled={busy || !body.trim()}>남기기</button>
          </div>
        </form>
      )}
      {message && <p className="notice">{message}</p>}
      {entries.length === 0 ? (
        <p className="empty">{isOwner ? '아직 방명록이 없어요. 친구에게 방 주소를 보내 보세요.' : '첫 방명록을 남겨 보세요.'}</p>
      ) : (
        <ul className="guestbook__list">
          {entries.map((g) => (
            <li key={g.id} className="note-card">
              <div className="note-card__head">
                <span className="dot" style={{ background: tokens.avatar[g.author.avatar.color] }} aria-hidden />
                {g.author.handle ? <a href={`/r/${g.author.handle}`}>{g.author.displayName}</a> : <span>{g.author.displayName}</span>}
                {g.visibility === 'friends' && <span className="tag"><Icon name="lock" size={12} /> 친구만</span>}
                <span className="note-card__date">{when(g.createdAt)}</span>
              </div>
              <p className="note-card__body">{g.body}</p>
              <div className="note-card__actions">
                {g.canDelete && <button className="link-btn" onClick={() => remove(g.id)}>지우기</button>}
                {!g.canDelete && <button className="link-btn" onClick={() => report(g.id)}>신고</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
