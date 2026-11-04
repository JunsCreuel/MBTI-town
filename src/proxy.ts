// 요청이 화면·API에 닿기 전에 Supabase 로그인 세션을 갱신한다 (Supabase 공식 방식).
// 서버 화면(마을·첫 화면)은 쿠키를 쓸 수 없어서, 거기서 만료된 세션을 갱신하면 새 토큰이 버려지고
// 이미 쓴 갱신 토큰만 남아 나중에 로그아웃된 것처럼 보일 수 있다. 여기서 먼저 갱신해 응답 쿠키에 담는다.
// 만료 전이면 네트워크 호출 없이 지나간다 (getSession은 만료됐을 때만 갱신한다. 누구인지 확인하는 일은 currentUser가 한다).
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { authMode, supabaseAnonKey, supabaseUrl } from '@/lib/authConfig';

export async function proxy(request: NextRequest) {
  // 개발용 로그인이거나 로그인 쿠키가 없으면 할 일이 없다
  if (authMode() !== 'supabase' || !request.cookies.getAll().some((c) => c.name.startsWith('sb-'))) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        // 이 요청을 받는 화면·API도 새 토큰을 보게 하고, 브라우저에도 돌려준다
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  try {
    await supabase.auth.getSession();
  } catch {
    // 갱신에 실패해도 요청은 그대로 보낸다 (화면·API가 로그인 안 한 것으로 다룬다)
  }
  return response;
}

export const config = {
  // 화면과 API만 (정적 파일·에셋·이미지는 빼고)
  matcher: ['/((?!_next/static|_next/image|assets/|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|glb|gltf|ogg|mp3|json|woff2?|css|js|txt)$).*)'],
};
