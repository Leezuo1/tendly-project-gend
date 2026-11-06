import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { AiKnowledge } from '@/lib/types/ai';
import type { CustomerCareSettings } from '@/lib/types/customerCare';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import { parseAiKnowledge } from '@/lib/services/aiKnowledge';
import { CustomerCareError, generateCareReply, parseCareProfile } from '@/lib/services/customerCare';
import { readConversationSources } from '@/lib/services/conversationSources';
import { saveConversationMemory } from '@/lib/services/conversationMemory';
import { AutomationStoppedError, sendMessengerMessage } from '@/lib/services/messengerSend';
import { AppSecurityError, assertOperationAllowed, canRunAutomation, isInteractiveRequest, runAutomaticAccess } from '@/lib/services/appSecurity';

export async function readMessengerAiSettings(pageId: string, db: Pick<Pool, 'query'> = getMessengerPool()): Promise<CustomerCareSettings> {
  const row = (await db.query('SELECT * FROM messenger_ai_settings WHERE page_id=$1', [pageId])).rows[0];
  return { autoReply: row?.auto_reply === true && !!row.profile_json, updatedAt: row ? Number(row.updated_at) : null,
    profile: row?.profile_json ? parseCareProfile(row.profile_json) : null, pageProfile: row?.page_profile_json ?? null,
    pageAssigned: row?.page_assigned === true, pageEnabled: row?.page_enabled === true,
    approvedBy: row?.approved_by || '', approvedAt: row?.approved_at == null ? null : Number(row.approved_at),
    knowledge: row ? parseAiKnowledge(row.knowledge_json) : null };
}

export async function saveMessengerAiSettings(pageId: string, autoReply: boolean, knowledge?: AiKnowledge,
  db: Pick<Pool, 'query'> = getMessengerPool(), updatedAt?: number) {
  // Legacy callers may toggle the confirmed configuration, never replace its knowledge snapshot.
  void knowledge;
  const updated = await db.query(`UPDATE messenger_ai_settings SET auto_reply=$2,
    profile_json=jsonb_set(profile_json,'{enabled}',to_jsonb($2::boolean)),
    updated_at=GREATEST(updated_at+1,$3),enabled_at=$3 WHERE page_id=$1
    AND (NOT $2::boolean OR (profile_json IS NOT NULL AND page_assigned AND page_enabled AND ($4::bigint IS NULL OR updated_at=$4))) RETURNING page_id`, [pageId, autoReply, Date.now(), updatedAt ?? null]);
  if (autoReply && !updated.rowCount) throw new CustomerCareError('Xác nhận cấu hình AI Chat và gán Fanpage trước khi bật.', 409);
  return readMessengerAiSettings(pageId, db);
}

export async function saveConversationAutoReply(pageId: string, psid: string, enabled: boolean, updatedAt: number,
  db: Pick<Pool, 'query'> = getMessengerPool()) {
  const row = (await db.query(`UPDATE messenger_conversations SET ai_auto_reply=$3,
    ai_enabled_at=CASE WHEN $3::boolean AND NOT ai_auto_reply THEN $4 ELSE ai_enabled_at END,
    ai_updated_at=GREATEST(ai_updated_at+1,$4) WHERE page_id=$1 AND id=$2 AND hidden_at IS NULL AND ai_updated_at=$5
    RETURNING ai_auto_reply,ai_updated_at`, [pageId, JSON.stringify([pageId, psid]), enabled, Date.now(), updatedAt])).rows[0];
  if (!row) throw new CustomerCareError('Hội thoại đã thay đổi hoặc không còn hiển thị. Tải lại trước khi thử lại.', 409);
  return { autoReply: row.ai_auto_reply, updatedAt: Number(row.ai_updated_at) };
}

export async function processMessengerAi(pageId: string, psid: string, knowledge?: AiKnowledge,
  db: Pool = getMessengerPool()) {
  if (isInteractiveRequest()) await assertOperationAllowed(db);
  else if (!await canRunAutomation(db)) return {};
  const id = JSON.stringify([pageId, psid]);
  const settings = (await db.query('SELECT * FROM messenger_ai_settings WHERE page_id=$1', [pageId])).rows[0];
  const source = settings?.profile_json ? parseAiKnowledge(settings.knowledge_json) : undefined;
  if (!source) return {};
  const profile = parseCareProfile(settings.profile_json);
  const latest = (await db.query(`SELECT m.*,c.ai_auto_reply,c.ai_updated_at,c.ai_enabled_at FROM messenger_messages m JOIN messenger_conversations c ON c.id=m.conversation_id
    WHERE m.page_id=$1 AND m.conversation_id=$2 AND c.hidden_at IS NULL
    ORDER BY m.sent_at DESC,m.message_id DESC LIMIT 1`, [pageId, id])).rows[0];
  if (!latest || latest.direction !== 'in') return {};
  const now = Date.now();
  const claimed = await db.query(`INSERT INTO messenger_ai_jobs(page_id,message_id,conversation_id,sent_at,status,updated_at)
    VALUES($1,$2,$3,$4,'processing',$5) ON CONFLICT(page_id,message_id) DO UPDATE SET status='processing',updated_at=$5
    WHERE messenger_ai_jobs.status='ready' OR (messenger_ai_jobs.status='processing' AND messenger_ai_jobs.updated_at<$5::bigint-120000) RETURNING message_id`,
  [pageId, latest.message_id, id, latest.sent_at, now]);
  if (!claimed.rowCount) return {};
  try {
    const context = (await db.query(`SELECT direction,text FROM messenger_messages WHERE page_id=$1 AND conversation_id=$2
      AND (sent_at<$3 OR (sent_at=$3 AND message_id<$4)) ORDER BY sent_at DESC,message_id DESC LIMIT 10`,
    [pageId, id, latest.sent_at, latest.message_id])).rows.reverse()
      .filter((m) => m.text.trim()).map((m) => ({ role: m.direction === 'in' ? 'user' as const : 'model' as const, text: m.text.slice(0, 2000) }));
    const sources = await readConversationSources(pageId, psid, latest.message_id, db);
    if (!sources) throw new CustomerCareError('Hội thoại không còn hiển thị.', 409);
    const reply = await generateCareReply(source, profile, settings.page_profile_json, latest.text.slice(0, 8000) || '[Tệp đính kèm chưa được đọc]', context, sources);
    reply.sourceSummary += ` · Quy tắc Chat ${settings.updated_at}`;
    const blocked = !reply.analysis.canAutoReply || reply.analysis.needsHuman || !latest.text.trim()
      || latest.attachments_json.length > 0 || Array.from(reply.reply).length > 2000;
    if (blocked) reply.analysis.canAutoReply = false;
    const current = (await db.query('SELECT updated_at FROM messenger_ai_settings WHERE page_id=$1', [pageId])).rows[0];
    if (!current || Number(current.updated_at) !== Number(settings.updated_at)) {
      await db.query("UPDATE messenger_ai_jobs SET status='ready',updated_at=$3 WHERE page_id=$1 AND message_id=$2 AND status='processing'", [pageId, latest.message_id, Date.now()]);
      return {};
    }
    if ((await readConversationSources(pageId, psid, latest.message_id, db))?.fingerprint !== sources.fingerprint) {
      await db.query("UPDATE messenger_ai_jobs SET status='review',updated_at=$3 WHERE page_id=$1 AND message_id=$2 AND status='processing'", [pageId, latest.message_id, Date.now()]);
      return {};
    }
    await saveConversationMemory(pageId, psid, latest.message_id, reply, db);
    await db.query(`UPDATE messenger_ai_jobs SET status=$3,updated_at=$4 WHERE page_id=$1 AND message_id=$2 AND status='processing'`,
      [pageId, latest.message_id, blocked ? 'review' : 'ready', Date.now()]);
    if (blocked || !settings.auto_reply || !latest.ai_auto_reply || Number(latest.sent_at) <= Number(settings.enabled_at)
      || Number(latest.sent_at) <= Number(latest.ai_enabled_at)) return { reply, messageId: latest.message_id };
    // Recheck the switch, current message and all unresolved reviews immediately before reserving the send.
    const send = await db.query(`UPDATE messenger_ai_jobs j SET status='sending',updated_at=$3
      FROM messenger_conversations c,messenger_ai_settings s
      WHERE j.page_id=$1 AND j.message_id=$2 AND j.status='ready' AND c.id=j.conversation_id AND c.hidden_at IS NULL
      AND s.page_id=j.page_id AND s.auto_reply AND s.updated_at=$4
      AND c.ai_auto_reply AND c.ai_updated_at=$5 AND j.sent_at>c.ai_enabled_at AND j.sent_at>s.enabled_at
      AND COALESCE(c.last_out_at,0)<j.sent_at AND $3::bigint-j.sent_at<86400000
      AND j.message_id=(SELECT message_id FROM messenger_messages WHERE conversation_id=c.id ORDER BY sent_at DESC,message_id DESC LIMIT 1)
      AND NOT EXISTS(SELECT 1 FROM messenger_ai_jobs other WHERE other.conversation_id=c.id
        AND other.status IN ('processing','review','sending','unknown') AND other.message_id<>j.message_id AND other.sent_at>COALESCE(c.last_out_at,0))
      RETURNING j.message_id`, [pageId, latest.message_id, Date.now(), settings.updated_at, latest.ai_updated_at]);
    if (!send.rowCount) return { reply, messageId: latest.message_id };
    try {
      const sent = await runAutomaticAccess(Number(latest.sent_at), () => sendMessengerMessage({ psid, text: reply.reply, requestId: randomUUID(),
        automation: { messageId: latest.message_id, settingsVersion: Number(settings.updated_at), conversationVersion: Number(latest.ai_updated_at), sourceFingerprint: sources.fingerprint } }, db));
      await db.query(`UPDATE messenger_ai_jobs SET status=$4,updated_at=$3 WHERE page_id=$1 AND message_id=$2`,
        [pageId, latest.message_id, Date.now(), sent.persisted ? 'sent' : 'unknown']);
      return { reply, sent, messageId: latest.message_id };
    } catch (error) {
      await db.query(`UPDATE messenger_ai_jobs SET status=$4,updated_at=$3 WHERE page_id=$1 AND message_id=$2`,
        [pageId, latest.message_id, Date.now(), error instanceof AppSecurityError || error instanceof AutomationStoppedError ? 'review' : 'unknown']);
      return { reply, messageId: latest.message_id };
    }
  } catch (cause) {
    await db.query(`UPDATE messenger_ai_jobs SET status='review',updated_at=$3 WHERE page_id=$1 AND message_id=$2 AND status IN ('processing','ready')`,
      [pageId, latest.message_id, Date.now()]);
    throw new Error('AI chưa xác nhận đủ căn cứ. Hội thoại cần shop kiểm tra.', { cause });
  } finally {
    // A newer message may have finished first but waited for this analysis before it could send.
    const newer = (await db.query(`SELECT message_id FROM messenger_messages WHERE page_id=$1 AND conversation_id=$2
      ORDER BY sent_at DESC,message_id DESC LIMIT 1`, [pageId, id])).rows[0];
    if (newer && newer.message_id !== latest.message_id) await processMessengerAi(pageId, psid, knowledge, db);
  }
}
