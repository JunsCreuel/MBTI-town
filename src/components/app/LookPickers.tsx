'use client';

// 피부색·머리 색 고르기 (가입·내 캐릭터·옷장이 같이 쓴다). '기본'은 그 캐릭터 모델의 원래 색이다.
import { tokens } from '@/design/tokens';
import { HAIR_COLORS, SKIN_TONES, type Avatar } from '@/shared/avatar';

export function LookPickers({ avatar, onChange, titleClassName }: { avatar: Avatar; onChange: (a: Avatar) => void; titleClassName: string }) {
  return (
    <>
      <h2 className={titleClassName}>피부색</h2>
      <div className="swatches">
        {SKIN_TONES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`swatch${avatar.skin === s.id ? ' swatch--on' : ''}`}
            style={{ background: s.id === 'natural' ? tokens.avatarSkinNatural[avatar.body] : tokens.avatarSkin[s.id] }}
            aria-label={`피부색 ${s.label}`}
            aria-pressed={avatar.skin === s.id}
            onClick={() => onChange({ ...avatar, skin: s.id })}
          />
        ))}
      </div>
      <h2 className={titleClassName}>머리 색</h2>
      <div className="swatches">
        {HAIR_COLORS.map((h) => (
          <button
            key={h.id}
            type="button"
            className={`swatch${avatar.hair === h.id ? ' swatch--on' : ''}`}
            style={{ background: h.id === 'natural' ? tokens.avatarHairNatural[avatar.body] : tokens.avatarHair[h.id] }}
            aria-label={`머리 색 ${h.label}`}
            aria-pressed={avatar.hair === h.id}
            onClick={() => onChange({ ...avatar, hair: h.id })}
          />
        ))}
      </div>
    </>
  );
}
