import type { Pool } from 'pg';
import type { MessengerMessage } from '@/lib/types/messenger';
import { getMessengerPool, savePostgresMessages } from '@/lib/services/messengerPostgres';

export class MessengerSendError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export interface SendMessengerInput { psid: string; text: string; requestId: string }

export async function sendMessengerMessage(input: SendMessengerInput,
  db: Pool = getMessengerPool(), transport: typeof fetch = fetch) {
  const pageId = process.env.PAGE_ID;
  const token = process.env.PAGE_ACCESS_TOKEN;
  const version = process.env.META_GRAPH_VERSION;
  if (!pageId || !token || !version || !/^v\d+\.\d+$/.test(version)) {
    throw new MessengerSendError('Cần cấu hình PAGE_ID, PAGE_ACCESS_TOKEN và META_GRAPH_VERSION.', 503);
  }
  const thread = await db.query(`SELECT last_in_at FROM messenger_conversations WHERE page_id=$1 AND id=$2`,
    [pageId, JSON.stringify([pageId, input.psid])]);
  const lastIn = Number(thread.rows[0]?.last_in_at);
  if (!lastIn || Date.now() - lastIn > 24 * 60 * 60 * 1000) {
    throw new MessengerSendError('Chỉ gửi phản hồi tiêu chuẩn trong 24 giờ từ tin khách gần nhất. Hãy chờ khách nhắn lại.', 409);
  }
  const createdAt = Date.now();
  const reservation = await db.query(`INSERT INTO messenger_outbound_requests
    (page_id,request_id,psid,text,status,created_at) VALUES($1,$2,$3,$4,'sending',$5)
    ON CONFLICT(page_id,request_id) DO NOTHING RETURNING request_id`,
  [pageId, input.requestId, input.psid, input.text, createdAt]);
  if (!reservation.rowCount) {
    const existing = (await db.query(`SELECT * FROM messenger_outbound_requests WHERE page_id=$1 AND request_id=$2`,
      [pageId, input.requestId])).rows[0];
    if (!existing || existing.psid !== input.psid || existing.text !== input.text) {
      throw new MessengerSendError('Mã yêu cầu đã được dùng cho tin khác.', 409);
    }
    if (existing.status === 'sent' && existing.message_id) {
      const message: MessengerMessage = { pageId, psid: input.psid, messageId: existing.message_id, direction: 'out',
        timestamp: Number(existing.created_at), text: input.text, attachments: [] };
      try { await savePostgresMessages([message], db); return { message, persisted: true }; }
      catch { return { message, persisted: false }; }
    }
    throw new MessengerSendError(existing.status === 'failed'
      ? 'Meta đã từ chối yêu cầu này. Hãy kiểm tra lỗi và gửi lại bằng yêu cầu mới.'
      : 'Chưa xác định được kết quả gửi. Kiểm tra Messenger trước khi gửi lại để tránh trùng.', 409);
  }
  let response: Response;
  try {
    response = await transport(`https://graph.facebook.com/${version}/${encodeURIComponent(pageId)}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({ recipient: { id: input.psid }, messaging_type: 'RESPONSE', message: { text: input.text } }),
    });
  } catch {
    await db.query(`UPDATE messenger_outbound_requests SET status='unknown' WHERE page_id=$1 AND request_id=$2`, [pageId, input.requestId]);
    throw new MessengerSendError('Kết nối Meta bị gián đoạn; chưa xác định tin đã gửi hay chưa. Kiểm tra Messenger trước khi gửi lại.', 409);
  }
  if (!response.ok) {
    const unknown = response.status >= 500;
    await db.query(`UPDATE messenger_outbound_requests SET status=$3 WHERE page_id=$1 AND request_id=$2`,
      [pageId, input.requestId, unknown ? 'unknown' : 'failed']);
    throw new MessengerSendError(unknown ? 'Meta chưa xác nhận kết quả. Kiểm tra Messenger trước khi gửi lại.'
      : 'Meta từ chối gửi tin. Kiểm tra token, quyền nhắn tin và thời hạn phản hồi.', unknown ? 409 : 400);
  }
  let result;
  try { result = await response.json(); } catch { /* ambiguous success, do not resend */ }
  if (typeof result?.message_id !== 'string' || !result.message_id) {
    await db.query(`UPDATE messenger_outbound_requests SET status='unknown' WHERE page_id=$1 AND request_id=$2`, [pageId, input.requestId]);
    throw new MessengerSendError('Meta chưa trả mã tin nhắn. Kiểm tra Messenger trước khi gửi lại.', 409);
  }
  const message: MessengerMessage = { pageId, psid: input.psid, messageId: result.message_id,
    direction: 'out', timestamp: createdAt, text: input.text, attachments: [] };
  try {
    await db.query(`UPDATE messenger_outbound_requests SET status='sent',message_id=$3 WHERE page_id=$1 AND request_id=$2`,
      [pageId, input.requestId, message.messageId]);
    await savePostgresMessages([message], db);
    return { message, persisted: true };
  } catch {
    // Meta already accepted it. Never label this as a failed send or send again automatically.
    return { message, persisted: false };
  }
}
