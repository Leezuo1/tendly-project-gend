import type { Pool } from 'pg';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import type { MessengerMessage } from '@/lib/types/messenger';
import type { MessengerInboxSnapshot, MessengerThread } from '@/lib/types/messengerInbox';

export interface MessageRow {
  page_id: string; message_id: string; psid: string; direction: 'in' | 'out';
  sent_at: string; text: string; attachments_json: MessengerMessage['attachments'];
}
export function messageFromRow(row: MessageRow): MessengerMessage {
  return { pageId: row.page_id, psid: row.psid, messageId: row.message_id,
    direction: row.direction, timestamp: Number(row.sent_at), text: row.text, attachments: row.attachments_json };
}

export async function readMessengerInbox(pageId: string, limit = 100, db: Pick<Pool, 'query'> = getMessengerPool()): Promise<MessengerInboxSnapshot> {
  const rows = await db.query(`SELECT c.*, u.psid FROM messenger_conversations c
    JOIN messenger_customers u ON c.customer_id=u.id WHERE c.page_id=$1
    ORDER BY c.last_message_at DESC NULLS LAST, c.id LIMIT $2`, [pageId, limit + 1]);
  const conversations: MessengerThread[] = [];
  // A bounded, single-query message fetch for every thread shown in the list.
  const ids = rows.rows.slice(0, limit).map((r) => r.id);
  const recent = ids.length ? await db.query(`SELECT * FROM (
    SELECT m.*, ROW_NUMBER() OVER(PARTITION BY conversation_id ORDER BY sent_at DESC, message_id DESC) AS rn
    FROM messenger_messages m WHERE page_id=$1 AND conversation_id=ANY($2::text[])
  ) recent WHERE rn <= 51 ORDER BY sent_at, message_id`, [pageId, ids]) : { rows: [] };
  for (const row of rows.rows.slice(0, limit)) {
    const messages = recent.rows.filter((m) => m.conversation_id === row.id);
    conversations.push({ id: row.id, pageId, psid: row.psid, createdAt: Number(row.created_at),
      lastInAt: row.last_in_at === null ? null : Number(row.last_in_at),
      lastOutAt: row.last_out_at === null ? null : Number(row.last_out_at),
      messages: messages.slice(-50).map((m) => messageFromRow({ ...m, psid: row.psid })), hasOlder: messages.length > 50 });
  }
  return { conversations, hasMore: rows.rows.length > limit };
}

export async function readOlderMessengerMessages(pageId: string, psid: string, timestamp: number, messageId: string,
  db: Pick<Pool, 'query'> = getMessengerPool()) {
  const key = JSON.stringify([pageId, psid]);
  const result = await db.query(`SELECT * FROM messenger_messages WHERE page_id=$1 AND conversation_id=$2
    AND (sent_at < $3 OR (sent_at=$3 AND message_id < $4)) ORDER BY sent_at DESC, message_id DESC LIMIT 51`,
  [pageId, key, timestamp, messageId]);
  return { messages: result.rows.slice(0, 50).reverse().map((m) => messageFromRow({ ...m, psid })), hasOlder: result.rows.length > 50 };
}
