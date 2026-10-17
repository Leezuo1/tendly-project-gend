'use client';

import { useSyncExternalStore } from 'react';
import { mockOnboardingSnapshot, subscribeMockOnboarding, type MockOnboarding } from '@/lib/services/mockOnboarding';

export function useMockOnboarding() {
  const snapshot = useSyncExternalStore(subscribeMockOnboarding, mockOnboardingSnapshot, () => '');
  const [authenticated, data]: [boolean, MockOnboarding] = snapshot
    ? JSON.parse(snapshot) : [false, { version: 1, workspace: null, connections: {}, completed: false }];
  return { ready: snapshot !== '', authenticated, ...data };
}
