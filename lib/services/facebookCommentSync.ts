import type { Pool } from 'pg';
import { FacebookCommentError, graphRead, saveFacebookComments } from '@/lib/services/facebookComments';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import { InvalidWebhook, parseMetaComments } from '@/lib/services/metaWebhook';

/** Reconcile missed webhooks without fetching Meta again for every browser poll. */
export async function syncFacebookComments(pageId: string, db: Pick<Pool, 'query' | 'connect'> = getMessengerPool()) {
  const now = Date.now();
  const claimed = await db.query(`INSERT INTO facebook_comment_sync(page_id,retry_after) VALUES($1,$2)
    ON CONFLICT(page_id) DO UPDATE SET retry_after=EXCLUDED.retry_after
    WHERE facebook_comment_sync.retry_after<=$3 RETURNING page_id`, [pageId, now + 60_000, now]);
  if (claimed.rowCount) {
    try {
      // shortcut: reconcile 20 latest comments on 10 latest posts; use a paginated worker for larger Pages.
      const result = await graphRead(`${pageId}/published_posts`,
        'id,comments.limit(20).order(reverse_chronological).filter(stream){id,message,created_time,from}',
        undefined, { limit: '10' });
      if (!Array.isArray(result.data)) throw new FacebookCommentError('Meta trả danh sách bài đăng không hợp lệ.', 502);
      const changes = [];
      for (const post of result.data) {
        if (!post || typeof post.id !== 'string' || !new RegExp(`^${pageId}_\\d{1,64}$`).test(post.id)) {
          throw new FacebookCommentError('Meta trả dữ liệu bình luận không hợp lệ.', 502);
        }
        // Meta omits the comments field entirely when a post has no comments.
        if (post.comments === undefined) continue;
        if (!Array.isArray(post.comments?.data)) throw new FacebookCommentError('Meta trả dữ liệu bình luận không hợp lệ.', 502);
        for (const comment of post.comments.data) {
          if (!comment || typeof comment !== 'object') throw new FacebookCommentError('Meta trả dữ liệu bình luận không hợp lệ.', 502);
          changes.push({ field: 'feed', value: { item: 'comment', verb: 'add', post_id: post.id,
            comment_id: comment.id, from: comment.from, message: comment.message,
            created_time: typeof comment.created_time === 'string' ? Date.parse(comment.created_time) / 1000 : NaN } });
        }
      }
      const events = parseMetaComments({ object: 'page', entry: [{ id: pageId, time: Math.floor(now / 1000), changes }] }, pageId);
      await saveFacebookComments(events, db);
      await db.query('UPDATE facebook_comment_sync SET synced_at=$2,retry_after=$3,error=NULL WHERE page_id=$1',
        [pageId, Date.now(), Date.now() + 10_000]);
    } catch (error) {
      if (!(error instanceof FacebookCommentError) && !(error instanceof InvalidWebhook)) throw error;
      await db.query('UPDATE facebook_comment_sync SET retry_after=$2,error=$3 WHERE page_id=$1',
        [pageId, Date.now() + 10_000, error instanceof FacebookCommentError ? error.message : 'Meta trả dữ liệu bình luận không hợp lệ.']);
    }
  }
  const row = (await db.query('SELECT synced_at,error FROM facebook_comment_sync WHERE page_id=$1', [pageId])).rows[0];
  return { syncedAt: row?.synced_at == null ? null : Number(row.synced_at), error: row?.error as string | null };
}
