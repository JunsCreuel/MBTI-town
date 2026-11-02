import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Guide } from '@/components/app/Guide';
import { Icon } from '@/components/app/Icon';
import { Wordmark } from '@/components/app/Wordmark';
import { currentUser } from '@/server/auth';
import { getSceneService } from '@/server/scene';

export const metadata: Metadata = { title: 'SCENE · 나만의 작은 방' };
export const dynamic = 'force-dynamic';

const FEATURES = [
  { icon: 'home', title: '나만의 방', text: '가구를 놓고 벽지를 바꿔 취향대로 꾸며요' },
  { icon: 'music', title: '나의 BGM', text: '방에 들어오는 사람이 내 음악을 들어요' },
  { icon: 'archive', title: '감정과 일상 기록', text: '한 줄, 사진 한 장으로도 충분해요' },
  { icon: 'friends', title: '친구 방 놀러 가기', text: '방을 구경하고 방명록을 남겨요' },
];

/** 1단계 "세계에 입장": 이미 방이 있으면 나의 방으로 */
export default async function Landing() {
  const user = await currentUser();
  if (user) {
    const me = await (await getSceneService()).me(user).catch(() => null);
    redirect(me?.profile.onboarded ? '/home' : '/onboarding');
  }
  return (
    <main className="landing">
      <Wordmark />
      <section className="landing__hero">
        <h1>
          나의 취향과 일상을 담는
          <br />
          작은 방 하나
        </h1>
        <p>
          다섯 동네가 있는 세계에 나만의 방을 만들어요. 음악과 사진, 기록으로 꾸민 방이 곧 나의 홈페이지예요.
        </p>
        <Guide who="monnyang">어서 와요! 3분이면 나의 방이 생겨요.</Guide>
      </section>
      <ul className="landing__features">
        {FEATURES.map((f) => (
          <li key={f.title}>
            <Icon name={f.icon} size={22} />
            <b>{f.title}</b>
            <span>{f.text}</span>
          </li>
        ))}
      </ul>
      <div className="landing__cta">
        <Link className="btn-primary" href="/login?next=/onboarding">시작하기</Link>
        <Link className="btn-secondary" href="/explore">마을 먼저 구경하기</Link>
      </div>
      <p className="landing__note muted">팔로워 수도, 좋아요 경쟁도 없어요. 내 방은 비공개로도 운영할 수 있어요.</p>
    </main>
  );
}
