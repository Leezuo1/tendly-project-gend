'use client';

import type { CommentsData, FacebookComment } from '@/lib/types/facebookComments';
import { currentAiKnowledge } from '@/lib/services/aiChat';
import { dashboardRequest } from '@/lib/services/postsClient';

const endpoint = '/api/facebook/comments';
const post = (body: object) => dashboardRequest(endpoint, { method: 'POST', body: JSON.stringify(body) });

export const facebookCommentsClient = {
  list: () => dashboardRequest(endpoint).then((r) => r.json() as Promise<CommentsData>),
  saveSettings: (autoReply: boolean) => dashboardRequest(endpoint, {
    method: 'PUT', body: JSON.stringify({ autoReply, knowledge: currentAiKnowledge() }),
  }),
  setAutoReply: (autoReply: boolean) => dashboardRequest(endpoint, {
    method: 'PUT', body: JSON.stringify(autoReply ? { autoReply, knowledge: currentAiKnowledge() } : { autoReply }),
  }),
  draft: (commentId: string) => post({ action: 'draft', commentId }),
  process: () => post({ action: 'process' }),
  send: (comment: FacebookComment, text: string) => post({ action: 'send', commentId: comment.commentId, revision: comment.revision, text })
    .then((r) => r.json() as Promise<{ status: string; persisted: boolean; reason: string }>),
};
