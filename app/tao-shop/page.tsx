import type { Metadata } from 'next';
import { OnboardingScreen } from '@/components/features/onboarding/OnboardingScreen';

export const metadata: Metadata = { title: 'Tạo shop của bạn | Tendly' };

export default function CreateShopPage() { return <OnboardingScreen step="workspace" />; }
