import type { Metadata } from 'next';
import { OnboardingClient } from '@/components/onboarding/OnboardingClient';

export const metadata: Metadata = { title: '나의 방 만들기 · SCENE' };

export default function OnboardingPage() {
  return <OnboardingClient />;
}
