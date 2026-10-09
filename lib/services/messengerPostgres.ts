import { Pool } from 'pg';
import { getDefaultAutoSelectFamilyAttemptTimeout, setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';
import { attachDatabasePool } from '@vercel/functions';
import type { MessengerMessage } from '@/lib/types/messenger';

let pool: Pool | undefined;

export function getMessengerPool(): Pool {
  if (!process.env.DATABASE_URL?.trim()) throw new Error('Missing DATABASE_URL');
  if (!pool) {
    if (!process.env.VERCEL) {
      setDefaultAutoSelectFamilyAttemptTimeout(Math.max(getDefaultAutoSelectFamilyAttemptTimeout(), 2000));
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3, connectionTimeoutMillis: process.env.VERCEL ? 5000 : 15000, idleTimeoutMillis: 5000,
      statement_timeout: 8000,
    });
    // Prevent an unhandled idle-client error without logging connection strings.
    pool.on('error', () => console.error('Messenger database idle connection failed.'));
    if (process.env.VERCEL) attachDatabasePool(pool);
  }
  return pool;
}

export async function savePostgresMessages(messages: MessengerMessage[], database: Pick<Pool, 'connect'> = getMessengerPool()) {
  const client = await database.connect();
  let inserted = 0;
  try {
    await client.query('BEGIN');
    // Consistent customer lock order reduces deadlocks between overlapping batches.
    const ordered = [...messages].sort((a, b) =>
      JSON.stringify([a.pageId, a.psid]).localeCompare(JSON.stringify([b.pageId, b.psid])));
    for (const message of ordered) {
      const exists = await client.query('SELECT 1 FROM messenger_messages WHERE page_id=$1 AND message_id=$2',
        [message.pageId, message.messageId]);
      if (exists.rowCount) continue;
      const key = JSON.stringify([message.pageId, message.psid]);
      const receivedAt = Date.now();
      await client.query(`INSERT INTO messenger_customers(id,page_id,psid,created_at)
        VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [key, message.pageId, message.psid, receivedAt]);
      await client.query(`INSERT INTO messenger_conversations(id,customer_id,page_id,created_at)
        VALUES($1,$1,$2,$3) ON CONFLICT DO NOTHING`, [key, message.pageId, receivedAt]);
      const result = await client.query(`INSERT INTO messenger_messages
        (page_id,message_id,conversation_id,direction,sent_at,received_at,text,attachments_json)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
        ON CONFLICT(page_id,message_id) DO NOTHING RETURNING message_id`,
      [message.pageId, message.messageId, key, message.direction, message.timestamp, receivedAt,
        message.text, JSON.stringify(message.attachments)]);
      if (!result.rowCount) continue;
      inserted++;
      await client.query(`UPDATE messenger_conversations SET
        hidden_at=CASE WHEN $2::text='in' AND (hidden_at IS NULL OR $1::bigint > hidden_at) THEN NULL ELSE hidden_at END,
        last_message_at=GREATEST(COALESCE(last_message_at,0),$1::bigint),
        last_in_at=CASE WHEN $2::text='in' THEN GREATEST(COALESCE(last_in_at,0),$1::bigint) ELSE last_in_at END,
        last_out_at=CASE WHEN $2::text='out' THEN GREATEST(COALESCE(last_out_at,0),$1::bigint) ELSE last_out_at END
        WHERE id=$3`, [message.timestamp, message.direction, key]);
    }
    await client.query('COMMIT');
    return { inserted, duplicates: messages.length - inserted };
  } catch (error) {
    // Preserve the original failure if the connection itself broke during rollback.
    try { await client.query('ROLLBACK'); } catch { /* connection unavailable */ }
    throw error;
  } finally { client.release(); }
}
