'use client';

import { dashboardRequest } from './postsClient';
import type { MarketingWorkspaceView } from '@/lib/types/marketingWorkspace';

export const marketingWorkspaceClient = {
  read: () => dashboardRequest('/api/marketing/workspace').then(response => response.json() as Promise<MarketingWorkspaceView>),
  act: (revision: number, action: string, input: object) => dashboardRequest('/api/marketing/workspace', { method: 'POST', body: JSON.stringify({ revision, action, input }), signal: AbortSignal.timeout(65_000) }) /* route.ts maxDuration = 60 */.then(response => response.json() as Promise<MarketingWorkspaceView>),
};
