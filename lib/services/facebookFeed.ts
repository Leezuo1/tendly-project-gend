import { FacebookCommentError, graphRead } from '@/lib/services/facebookComments';
import type { FacebookFeedPage, FacebookFeedPost, FacebookPostComment, FacebookPostCommentsPage } from '@/lib/types/facebookFeed';

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const count = (value: unknown): number | null => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;

function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}

function createdAt(value: unknown) {
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(time)) throw new FacebookCommentError('Meta trả thời gian bài đăng/bình luận không hợp lệ.', 502);
  return time;
}

function dataRows(data: Record<string, unknown>): Record<string, unknown>[] {
  if (!Array.isArray(data.data) || data.data.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new FacebookCommentError('Meta trả dữ liệu bài đăng/bình luận không hợp lệ.', 502);
  }
  return data.data;
}

function nextCursor(data: Record<string, unknown>): string | null {
  const paging = record(data.paging);
  const after = record(paging.cursors).after;
  return paging.next && typeof after === 'string' && after.length <= 2048 ? after : null;
}

export function parseFacebookCursor(value: string | null): string | undefined {
  if (value === null) return undefined;
  if (!value || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new FacebookCommentError('Mã phân trang Facebook không hợp lệ.', 400);
  }
  return value;
}

export async function readFacebookFeed(pageId: string, after?: string): Promise<FacebookFeedPage> {
  const data = await graphRead(`${pageId}/published_posts`,
    'id,message,created_time,full_picture,reactions.limit(0).summary(true),comments.limit(0).summary(true),shares',
    undefined, { limit: '20', ...(after ? { after } : {}) });
  const posts = dataRows(data).map<FacebookFeedPost>((row) => {
    if (typeof row.id !== 'string' || !new RegExp(`^${pageId}_\\d{1,64}$`).test(row.id)) {
      throw new FacebookCommentError('Meta trả bài đăng ngoài Fanpage đang kết nối.', 502);
    }
    return { id: row.id, message: typeof row.message === 'string' ? row.message : '', createdAt: createdAt(row.created_time),
      url: `https://www.facebook.com/${row.id}`, imageUrl: httpsUrl(row.full_picture),
      reactions: count(record(record(row.reactions).summary).total_count),
      comments: count(record(record(row.comments).summary).total_count), shares: count(record(row.shares).count) };
  });
  return { posts, after: nextCursor(data) };
}

function commentRow(row: Record<string, unknown>): FacebookPostComment {
  if (typeof row.id !== 'string' || !/^\d{1,64}(?:_\d{1,64})?$/.test(row.id)) {
    throw new FacebookCommentError('Meta trả mã bình luận không hợp lệ.', 502);
  }
  const replies = record(row.comments);
  return { id: row.id, authorName: typeof record(row.from).name === 'string' ? String(record(row.from).name) : 'Người dùng Facebook',
    message: typeof row.message === 'string' ? row.message : '', createdAt: createdAt(row.created_time), likes: count(row.like_count),
    replies: Array.isArray(replies.data) ? dataRows(replies).map(commentRow) : [], hasMoreReplies: Boolean(record(replies.paging).next) };
}

export async function readFacebookPostComments(pageId: string, postId: string, after?: string): Promise<FacebookPostCommentsPage> {
  if (!new RegExp(`^${pageId}_\\d{1,64}$`).test(postId)) throw new FacebookCommentError('Bài đăng không thuộc Fanpage đang kết nối.', 400);
  // shortcut: show three replies per comment, open Facebook for longer reply threads until in-app reply pagination is needed.
  const fields = 'id,message,created_time,from,like_count,comments.limit(3){id,message,created_time,from,like_count}';
  const data = await graphRead(`${postId}/comments`, fields, undefined,
    { limit: '20', filter: 'toplevel', order: 'chronological', ...(after ? { after } : {}) });
  return { comments: dataRows(data).map(commentRow), after: nextCursor(data) };
}
