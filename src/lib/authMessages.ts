// 로그인·가입 오류를 사람이 알아듣는 말로 (Supabase Auth 오류 코드 → 한국어).
// 로그인 화면과 메일 링크 콜백(/auth/callback → /login?error=…)이 같이 쓴다.

export function authErrorMessage(code: string | undefined | null): string {
  switch (code) {
    case 'invalid_credentials':
      return '이메일이나 비밀번호가 맞지 않아요.';
    case 'email_not_confirmed':
      return '아직 이메일 인증을 하지 않았어요. 가입할 때 받은 메일의 링크를 눌러 주세요.';
    case 'email_exists':
    case 'user_already_exists':
      return '이미 가입한 이메일이에요. 로그인해 주세요.';
    case 'weak_password':
      return '비밀번호가 너무 쉬워요. 8자 이상으로 글자와 숫자를 섞어 주세요.';
    case 'same_password':
      return '지금 쓰는 비밀번호와 달라야 해요.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return '짧은 시간에 너무 많이 시도했어요. 잠시 뒤에 다시 해 주세요.';
    case 'email_address_not_authorized':
      return '지금은 이 주소로 메일을 보낼 수 없어요 (메일 발송 설정이 필요해요). 운영자에게 알려 주세요.';
    case 'email_address_invalid':
    case 'validation_failed':
      return '이메일 주소를 확인해 주세요.';
    case 'signup_disabled':
      return '지금은 새로 가입할 수 없어요.';
    case 'user_banned':
      return '이 계정은 지금 쓸 수 없어요.';
    // 메일 링크 콜백에서 오는 이름
    case 'otp_expired':
    case 'expired':
      return '메일 링크가 만료됐거나 이미 쓰였어요. 다시 시도해 주세요.';
    case 'browser':
      return '메일 링크를 요청한 곳과 다른 브라우저(또는 메일 앱 안)에서 열었어요. 가입 인증은 끝났을 수 있으니, 여기서 이메일과 비밀번호로 로그인해 보세요.';
    case 'reset_browser':
      return '비밀번호 재설정 링크는 요청한 브라우저에서 열어 주세요. 이 브라우저에서 다시 요청해도 돼요.';
    default:
      return '로그인하지 못했어요. 잠시 뒤에 다시 시도해 주세요.';
  }
}

/** 비밀번호 규칙: 8자 이상 */
export const PASSWORD_MIN = 8;

/** 가입할 때 이 오류면 메일을 못 보낸 것 (메일 발송 설정·한도 문제, 사용자가 고칠 수 없다) */
const MAIL_SEND_FAILURES = new Set(['email_address_not_authorized', 'over_email_send_rate_limit', 'unexpected_failure']);

/** 가입 오류 코드 (없으면 status_<HTTP 상태>) */
export function authErrorCode(err: { code?: string; status?: number } | null | undefined): string {
  return err?.code || `status_${err?.status ?? 0}`;
}

/** 가입하다 막혔을 때 보여 줄 말: 메일 발송 문제는 운영자에게 저절로 알려진다 (signup-issue) */
export function signupErrorMessage(code: string): string {
  if (MAIL_SEND_FAILURES.has(code) || /^status_5\d\d$/.test(code)) {
    return '지금 가입 인증 메일을 보내지 못하고 있어요. 운영자에게 저절로 알려졌어요. 조금 뒤에 같은 이메일로 다시 가입해 주세요.';
  }
  return authErrorMessage(code);
}

/** 운영자에게 알릴 만한 오류인지 (비밀번호가 짧거나 이미 가입한 주소처럼 사용자가 고칠 수 있는 것은 빼고) */
export function shouldReportAuthError(step: 'signup' | 'login' | 'resend', code: string): boolean {
  if (step === 'login') return code === 'email_not_confirmed';
  return !['weak_password', 'same_password', 'email_exists', 'user_already_exists', 'email_address_invalid', 'validation_failed'].includes(code);
}

/** 운영 화면 가입 도움: 막힌 이유를 짧게 */
export function authTroubleLabel(code: string): string {
  switch (code) {
    case 'email_address_not_authorized':
      return '메일 발송 막힘 (메일 발송 설정 필요)';
    case 'over_email_send_rate_limit':
      return '메일 발송 한도 넘음';
    case 'over_request_rate_limit':
      return '시도 횟수 한도 넘음';
    case 'email_not_confirmed':
      return '메일 인증 전에 로그인 시도';
    case 'unexpected_failure':
      return '메일 발송 실패';
    case 'signup_disabled':
      return '새 가입이 꺼져 있음';
    default:
      return /^status_5\d\d$/.test(code) ? '인증 서버 오류' : code;
  }
}
