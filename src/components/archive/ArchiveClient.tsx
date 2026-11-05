'use client';

// ARCHIVE: 나의 기록 (PROJECT_GUIDE.md 8장). 짧은 문장, 사진 한 장만으로도 기록할 수 있다.
// 기본은 나만 보기. 메모는 늘 나만 보기.
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { recordConfig } from '@/config/game';
import { tokens } from '@/design/tokens';
import { call, errorMessage, shrinkImage } from '@/lib/api';
import type { RecordView } from '@/server/scene/service';
import {
  EMOTIONS, EMOTION_LABEL, RECORD_KIND_LABEL, VISIBILITIES, VISIBILITY_LABEL,
  type Emotion, type RecordKind, type Visibility,
} from '@/shared/records';
import { Guide } from '../app/Guide';
import { Icon } from '../app/Icon';
import { TabBar } from '../app/TabBar';
import { useMe } from '../app/useMe';
import { RecordCard } from './RecordCard';

function Composer({ onSaved }: { onSaved: () => void }) {
  const [kind, setKind] = useState<RecordKind>('emotion');
  const [emotion, setEmotion] = useState<Emotion | null>(null);
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!photo) return setPreview(null);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const max = kind === 'emotion' ? recordConfig.lineMax : recordConfig.bodyMax;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let photoId: string | undefined;
      if (photo && kind !== 'emotion') {
        const { blob, width, height } = await shrinkImage(photo, recordConfig.photoMaxSide);
        const res = await fetch(`/api/photos?w=${width}&h=${height}`, { method: 'POST', body: blob, headers: { 'content-type': 'image/jpeg' } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? '사진을 올리지 못했어요');
        photoId = data.id;
      }
      await call('POST', '/api/records', { kind, emotion, body, photoId, visibility: kind === 'memo' ? 'private' : visibility });
      setBody('');
      setPhoto(null);
      setEmotion(null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error && !(err as { code?: string }).code ? err.message : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const canSave = kind === 'emotion' ? !!emotion : !!body.trim() || !!photo;

  return (
    <form className="composer" onSubmit={save}>
      <div className="seg" role="tablist">
        {(['emotion', 'daily', 'memo'] as const).map((k) => (
          <button type="button" key={k} role="tab" aria-selected={kind === k} className={`seg__btn${kind === k ? ' seg__btn--on' : ''}`} onClick={() => setKind(k)}>
            {RECORD_KIND_LABEL[k]}
          </button>
        ))}
      </div>
      {kind !== 'memo' && (
        <div className="emotions" role="group" aria-label="오늘의 감정">
          {EMOTIONS.map((e) => (
            <button
              type="button"
              key={e}
              className={`emotion-btn${emotion === e ? ' emotion-btn--on' : ''}`}
              style={{ '--emotion': tokens.emotion[e] } as CSSProperties}
              aria-pressed={emotion === e}
              onClick={() => setEmotion(emotion === e ? null : e)}
            >
              <Icon name={e} emotion size={26} />
              <span>{EMOTION_LABEL[e]}</span>
            </button>
          ))}
        </div>
      )}
      <textarea
        value={body}
        maxLength={max}
        rows={kind === 'emotion' ? 2 : 4}
        onChange={(e) => setBody(e.target.value)}
        placeholder={kind === 'emotion' ? '한 줄로 남겨도 충분해요 (선택)' : kind === 'memo' ? '나만 보는 생각을 적어요' : '오늘 있었던 일, 사진 한 장도 좋아요'}
      />
      {kind === 'daily' && (
        <div className="composer__photo">
          <label className="btn-secondary upload-btn">
            <Icon name="photo" size={18} /> {photo ? '사진 바꾸기' : '사진 붙이기'}
            <input type="file" accept="image/*" hidden onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- 올리기 전 미리보기
            <img src={preview} alt="붙일 사진" className="composer__preview" />
          )}
        </div>
      )}
      <div className="composer__foot">
        {kind === 'memo' ? (
          <span className="tag"><Icon name="lock" size={12} /> 메모는 나만 봐요</span>
        ) : (
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)} aria-label="공개 범위">
            {VISIBILITIES.map((v) => (
              <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>
            ))}
          </select>
        )}
        <span className="muted">{body.length}/{max}</span>
        <button className="btn-primary btn-primary--inline" disabled={busy || !canSave}>{busy ? '남기는 중…' : '남기기'}</button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}

/** 기록 화면 (/archive): ?new=1이면 바로 쓰기 */
export function ArchiveRoute() {
  const params = useSearchParams();
  return <ArchiveClient startNew={params.get('new') === '1'} />;
}

/** embedded: 마을·방 위에 창으로 열 때 (아래 탭은 그 화면의 것을 쓴다). startNew: 바로 쓰기 */
export function ArchiveClient({ embedded = false, startNew = false }: { embedded?: boolean; startNew?: boolean } = {}) {
  const { me } = useMe({ require: 'onboarded' });
  const [tab, setTab] = useState<'records' | 'album'>('records');
  const [records, setRecords] = useState<RecordView[] | null>(null);
  const [more, setMore] = useState(false);
  const [photos, setPhotos] = useState<{ id: string }[] | null>(null);
  const [writing, setWriting] = useState(startNew);

  const load = useCallback(async (before?: string) => {
    const r = await call<{ records: RecordView[] }>('GET', `/api/records${before ? `?before=${encodeURIComponent(before)}` : ''}`);
    setRecords((cur) => (before && cur ? [...cur, ...r.records] : r.records));
    setMore(r.records.length >= recordConfig.pageSize);
  }, []);

  useEffect(() => {
    if (me) load().catch(() => setRecords([]));
  }, [me, load]);

  useEffect(() => {
    if (me && tab === 'album') call<{ photos: { id: string }[] }>('GET', '/api/photos').then((r) => setPhotos(r.photos)).catch(() => setPhotos([]));
  }, [me, tab]);

  async function setVisibility(id: string, visibility: Visibility) {
    await call('PATCH', `/api/records/${id}`, { visibility }).catch(() => {});
    setRecords((cur) => cur?.map((r) => (r.id === id ? { ...r, visibility } : r)) ?? cur);
  }

  async function remove(id: string) {
    if (!confirm('이 기록을 지울까요?')) return;
    await call('DELETE', `/api/records/${id}`).catch(() => {});
    setRecords((cur) => cur?.filter((r) => r.id !== id) ?? cur);
  }

  if (!me) return <main className="page page--center"><div className="loader" aria-hidden /></main>;

  return (
    <main className="page page--tabs">
      <header className="page__head">
        <h1>나의 기록</h1>
        <p className="muted">기록은 기본으로 나만 봐요. 기록마다 공개 범위를 고를 수 있어요.</p>
      </header>
      {writing ? (
        <Composer
          onSaved={() => {
            setWriting(false);
            load();
          }}
        />
      ) : (
        <button className="btn-primary" onClick={() => setWriting(true)}>
          <Icon name="plus" size={18} /> 기록 남기기
        </button>
      )}
      <div className="seg seg--wide" role="tablist">
        <button role="tab" aria-selected={tab === 'records'} className={`seg__btn${tab === 'records' ? ' seg__btn--on' : ''}`} onClick={() => setTab('records')}>기록</button>
        <button role="tab" aria-selected={tab === 'album'} className={`seg__btn${tab === 'album' ? ' seg__btn--on' : ''}`} onClick={() => setTab('album')}>사진첩</button>
      </div>
      {tab === 'records' &&
        (records === null ? (
          <div className="loader" aria-hidden />
        ) : records.length === 0 ? (
          <Guide who="monnyang">아직 기록이 없어요. 오늘의 감정 하나만 골라도 기록이 돼요.</Guide>
        ) : (
          <div className="records">
            {records.map((r) => (
              <RecordCard key={r.id} record={r}>
                {r.kind !== 'memo' && (
                  <select className="mini-select" value={r.visibility} onChange={(e) => setVisibility(r.id, e.target.value as Visibility)} aria-label="공개 범위 바꾸기">
                    {VISIBILITIES.map((v) => (
                      <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>
                    ))}
                  </select>
                )}
                <button className="link-btn" onClick={() => remove(r.id)}>지우기</button>
              </RecordCard>
            ))}
            {more && <button className="btn-secondary" onClick={() => load(records.at(-1)!.createdAt)}>더 보기</button>}
          </div>
        ))}
      {tab === 'album' &&
        (photos === null ? (
          <div className="loader" aria-hidden />
        ) : photos.length === 0 ? (
          <p className="empty">사진이 없어요. 일상 기록에 사진을 붙이거나 액자에 걸어 보세요.</p>
        ) : (
          <div className="album">
            {photos.map((p) => (
              <a key={p.id} className="album__item" href={`/api/photos/${p.id}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- 권한 검사가 필요한 사진 */}
                <img src={`/api/photos/${p.id}`} alt="" loading="lazy" />
              </a>
            ))}
          </div>
        ))}
      {!embedded && <TabBar />}
    </main>
  );
}
