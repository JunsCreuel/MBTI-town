import { describe, expect, it } from 'vitest';
import { parseAuthSettings } from './authSettings';

describe('parseAuthSettings', () => {
  it('메일 인증·가입 허용을 읽는다', () => {
    expect(parseAuthSettings({ disable_signup: false, mailer_autoconfirm: false })).toEqual({ signup: true, confirmEmail: true });
    expect(parseAuthSettings({ disable_signup: true, mailer_autoconfirm: true })).toEqual({ signup: false, confirmEmail: false });
  });
  it('모양이 다르면 null', () => {
    expect(parseAuthSettings(null)).toBeNull();
    expect(parseAuthSettings({ disable_signup: false })).toBeNull();
    expect(parseAuthSettings('x')).toBeNull();
  });
});
