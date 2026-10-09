import type { Pool } from 'pg';
import type { AiChatReply } from '@/lib/types/ai';
import type { ConversationMemoryEntry } from '@/lib/types/conversationMemory';
import { getMessengerPool } from '@/lib/services/messengerPostgres';

export async function hideConversation(pageId: string, psid: string, db: Pick<Pool, 'query'> = getMessengerPool()) {
  return db.query('UPDATE messenger_conversations SET hidden_at=$3 WHERE page_id=$1 AND id=$2 RETURNING id,hidden_at',
    [pageId, JSON.stringify([pageId, psid]), Date.now()]);
}

export async function saveConversationMemory(pageId: string, psid: string, messageId: string, result: AiChatReply,
  db: Pick<Pool, 'query'> = getMessengerPool()) {
  const saved = await db.query(`INSERT INTO messenger_analysis_history
    (page_id,message_id,conversation_id,analysis,reply,model,source_summary,analyzed_at)
    SELECT m.page_id,m.message_id,m.conversation_id,$4::jsonb,$5,$6,$7,$8 FROM messenger_messages m
    JOIN messenger_conversations c ON c.id=m.conversation_id
    WHERE m.page_id=$1 AND m.conversation_id=$2 AND m.message_id=$3 AND m.direction='in' AND c.hidden_at IS NULL
    ON CONFLICT(page_id,message_id) DO UPDATE SET analysis=EXCLUDED.analysis,reply=EXCLUDED.reply,
      model=EXCLUDED.model,source_summary=EXCLUDED.source_summary,analyzed_at=EXCLUDED.analyzed_at RETURNING message_id`,
  [pageId, JSON.stringify([pageId, psid]), messageId, JSON.stringify(result.analysis), result.reply, result.model, result.sourceSummary, Date.now()]);
  return (saved.rowCount ?? 0) > 0;
}

export async function readConversationMemories(pageId: string, ids: string[], db: Pick<Pool, 'query'> = getMessengerPool()) {
  if (!ids.length) return new Map<string, ConversationMemoryEntry[]>();
  const result = await db.query(`SELECT a.*,m.sent_at,m.text FROM messenger_analysis_history a
    JOIN messenger_messages m ON m.page_id=a.page_id AND m.message_id=a.message_id
    WHERE a.page_id=$1 AND a.conversation_id=ANY($2::text[]) ORDER BY m.sent_at,m.message_id`, [pageId, ids]);
  const memory = new Map<string, ConversationMemoryEntry[]>();
  for (const row of result.rows) {
    const entries = memory.get(row.conversation_id) || [];
    entries.push({ messageId: row.message_id, timestamp: Number(row.sent_at), messageText: row.text,
      analyzedAt: Number(row.analyzed_at), analysis: row.analysis, reply: row.reply, model: row.model, sourceSummary: row.source_summary });
    memory.set(row.conversation_id, entries);
  }
  return memory;
}

export async function pendingHistoricalAnalysis(pageId: string, psid: string, db: Pick<Pool, 'query'> = getMessengerPool()) {
  const id = JSON.stringify([pageId, psid]);
  const result = await db.query(`SELECT m.* FROM messenger_messages m JOIN messenger_conversations c ON c.id=m.conversation_id
    LEFT JOIN messenger_analysis_history a ON a.page_id=m.page_id AND a.message_id=m.message_id
    WHERE m.page_id=$1 AND m.conversation_id=$2 AND m.direction='in' AND a.message_id IS NULL AND c.hidden_at IS NULL
    ORDER BY m.sent_at,m.message_id LIMIT 10`, [pageId, id]);
  const jobs = [];
  for (const row of result.rows) {
    const context = await db.query(`SELECT direction,text FROM messenger_messages WHERE page_id=$1 AND conversation_id=$2
      AND (sent_at < $3 OR (sent_at=$3 AND message_id<$4)) ORDER BY sent_at DESC,message_id DESC LIMIT 10`,
    [pageId, id, row.sent_at, row.message_id]);
    jobs.push({ messageId: row.message_id as string, text: row.text as string,
      context: context.rows.reverse().filter((m) => m.text.trim()).map((m) => ({ role: m.direction === 'in' ? 'user' : 'model', text: m.text.slice(0, 2000) })) });
  }
  return jobs;
}
