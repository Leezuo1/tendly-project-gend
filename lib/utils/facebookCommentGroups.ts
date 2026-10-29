import type { FacebookComment } from '@/lib/types/facebookComments';

export function groupCommentsByAuthor(comments: FacebookComment[]) {
  const groups = new Map<string, FacebookComment[]>();
  for (const comment of comments) {
    const key = JSON.stringify([comment.pageId, comment.authorId ? 'author' : 'comment', comment.authorId || comment.commentId]);
    const group = groups.get(key);
    if (group) group.push(comment);
    else groups.set(key, [comment]);
  }
  return [...groups.values()];
}
