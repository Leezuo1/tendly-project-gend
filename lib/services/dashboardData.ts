import type { Pool } from 'pg';
import { getMessengerPool } from '@/lib/services/messengerPostgres';

export async function readDashboardData(pageId: string, db: Pick<Pool, 'query'> = getMessengerPool()) {
  const stats = await db.query(`SELECT
    (SELECT COUNT(*) FROM messenger_conversations WHERE page_id=$1 AND hidden_at IS NULL AND last_in_at IS NOT NULL
      AND (last_out_at IS NULL OR last_in_at > last_out_at)) AS waiting,
    COUNT(*) FILTER (WHERE direction='in' AND
      (to_timestamp(sent_at / 1000.0) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date =
      (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AS incoming_today,
    COUNT(*) FILTER (WHERE direction='out' AND
      (to_timestamp(sent_at / 1000.0) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date =
      (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AS outgoing_today
    FROM messenger_messages WHERE page_id=$1`, [pageId]);
  const recent = await db.query(`SELECT m.message_id, m.text, m.sent_at, u.display_name
    FROM messenger_messages m JOIN messenger_conversations c ON c.id=m.conversation_id AND c.page_id=m.page_id
    JOIN messenger_customers u ON u.id=c.customer_id
    WHERE m.page_id=$1 AND m.direction='in' AND c.hidden_at IS NULL ORDER BY m.sent_at DESC, m.message_id DESC LIMIT 10`, [pageId]);
  const weekly = await db.query(`SELECT
    (to_timestamp(sent_at / 1000.0) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS day,
    COUNT(DISTINCT conversation_id) AS count FROM messenger_messages WHERE page_id=$1 AND direction='in'
    AND (to_timestamp(sent_at / 1000.0) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >=
      (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 6
    GROUP BY day ORDER BY day`, [pageId]);
  return {
    waiting: Number(stats.rows[0].waiting), incomingToday: Number(stats.rows[0].incoming_today),
    outgoingToday: Number(stats.rows[0].outgoing_today),
    recentMessages: recent.rows.map((r) => ({ id: r.message_id as string, name: (r.display_name || '') as string,
      text: r.text as string, timestamp: Number(r.sent_at) })),
    weeklyChats: weekly.rows.map((r) => ({ day: r.day as string, count: Number(r.count) })),
  };
}
