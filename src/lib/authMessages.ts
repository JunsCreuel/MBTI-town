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
