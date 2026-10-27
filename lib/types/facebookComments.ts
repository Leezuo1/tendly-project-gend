export interface FacebookCommentEvent {
  pageId: string;
  commentId: string;
  postId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: number;
  eventAt: number;
  removed: boolean;
}

export type CommentStatus = 'pending' | 'processing' | 'review' | 'ignored' | 'sending' | 'sent' | 'unknown' | 'failed' | 'deleted';

export interface FacebookComment extends Omit<FacebookCommentEvent, 'removed'> {
  status: CommentStatus;
  revision: number;
  postText: string;
  draft: string;
  reason: string;
  sentAt: number | null;
}

export interface CommentSettings {
  autoReply: boolean;
  updatedAt: number | null;
  productCount: number;
}

export interface CommentsData {
  now: number;
  comments: FacebookComment[];
  settings: CommentSettings;
  pending: number;
  sync?: { syncedAt: number | null; error: string | null };
}
