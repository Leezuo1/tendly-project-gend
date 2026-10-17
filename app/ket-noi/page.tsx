import type { Metadata } from 'next';
import { OnboardingScreen } from '@/components/features/onboarding/OnboardingScreen';

export const metadata: Metadata = { title: 'Kết nối nền tảng | Tendly' };

export default function ConnectPlatformsPage() { return <OnboardingScreen step="connections" />; }
