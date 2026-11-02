// 기록 한 장 (감정 아이콘 + 글 + 사진). 기록 화면과 다른 사람 방에서 같이 쓴다.
import type { CSSProperties } from 'react';
import { tokens } from '@/design/tokens';
import { EMOTION_LABEL, RECORD_KIND_LABEL, VISIBILITY_LABEL } from '@/shared/records';
import type { RecordView } from '@/server/scene/service';
import { Icon } from '../app/Icon';

const when = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' });

export function RecordCard({ record, children }: { record: RecordView; children?: React.ReactNode }) {
  return (
    <article className="record-card">
      <div className="record-card__head">
        {record.emotion ? (
          <span className="emotion" style={{ color: tokens.emotion[record.emotion] } as CSSProperties}>
            <Icon name={record.emotion} emotion size={22} />
            {EMOTION_LABEL[record.emotion]}
          </span>
        ) : (
          <span className="record-card__kind">{RECORD_KIND_LABEL[record.kind]}</span>
        )}
        <span className="record-card__date">{when(record.createdAt)}</span>
      </div>
      {record.body && <p className="record-card__body">{record.body}</p>}
      {record.photoId && (
        // eslint-disable-next-line @next/next/no-img-element -- 권한 검사가 필요한 사진 (서버가 확인)
        <img className="record-card__photo" src={`/api/photos/${record.photoId}`} alt="기록 사진" loading="lazy" />
      )}
      <div className="record-card__foot">
        <span className="tag">
          <Icon name={record.visibility === 'private' ? 'lock' : record.visibility === 'friends' ? 'friends' : 'globe'} size={12} />
          {VISIBILITY_LABEL[record.visibility]}
        </span>
        {children}
      </div>
    </article>
  );
}
