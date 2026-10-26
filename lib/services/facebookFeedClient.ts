'use client';

import { dashboardRequest } from '@/lib/services/postsClient';
import type { FacebookFeedPage, FacebookPostCommentsPage } from '@/lib/types/facebookFeed';

const endpoint = '/api/facebook/posts';
export const facebookFeedClient = {
  list: () => dashboardRequest(endpoint).then((r) => r.json() as Promise<FacebookFeedPage>),
  more: (after: string) => dashboardRequest(`${endpoint}?${new URLSearchParams({ after })}`)
    .then((r) => r.json() as Promise<FacebookFeedPage>),
  comments: (postId: string, after?: string) => dashboardRequest(`${endpoint}?${new URLSearchParams({ postId, ...(after ? { after } : {}) })}`)
    .then((r) => r.json() as Promise<FacebookPostCommentsPage>),
};
