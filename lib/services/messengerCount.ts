import type { Pool } from 'pg';
import { getMessengerPool } from '@/lib/services/messengerPostgres';

/** Opening a conversation does not count as answering it. */
export async function readUnrepliedCount(pageId: string, db: Pick<Pool, 'query'> = getMessengerPool()): Promise<number> {
  const result = await db.query(`SELECT COUNT(*) AS count FROM messenger_conversations
    WHERE page_id=$1 AND hidden_at IS NULL AND last_in_at IS NOT NULL
    AND (last_out_at IS NULL OR last_in_at > last_out_at)`, [pageId]);
  return Number(result.rows[0].count);
}
