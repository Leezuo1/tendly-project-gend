'use client';

import { useSyncExternalStore } from 'react';
import { mockOnboardingSnapshot, subscribeMockOnboarding, type MockOnboarding } from '@/lib/services/mockOnboarding';
import { useAppSecurity } from '@/lib/hooks/useAppSecurity';

export function useMockOnboarding() {
  const security = useAppSecurity();
  const snapshot = useSyncExternalStore(subscribeMockOnboarding, mockOnboardingSnapshot, () => '');
  const [, data]: [boolean, MockOnboarding] = snapshot
    ? JSON.parse(snapshot) : [false, { version: 1, workspace: null, connections: {}, completed: false }];
  return { ready: snapshot !== '' && !security.loading, authenticated: security.session.authenticated, ...data };
}
