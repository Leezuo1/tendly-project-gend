/**
 * Shop duyệt 1 câu trả lời cho cả nhóm → nhắn riêng (Private Reply) cho từng người bình luận trong nhóm.
 * Giống sendCommentPrivateReply (lib/services/facebookComments.ts): đặt chỗ trong DB trước khi gửi,
 * kết quả mơ hồ thì để "unknown" và không bao giờ tự gửi lại. Phiên demo chỉ giả lập gửi.
 */
import { randomUUID } from 'node:crypto';
import { getMessengerPool, savePostgresMessages } from '@/lib/services/messengerPostgres';
import { graphRead } from '@/lib/services/facebookComments';
import type { LiveOrderItem, LiveSendResult } from '@/lib/types/live';
import { type Database, LiveError, loadSession } from '@/lib/services/live/engine';
import { fillTemplate, suggestAlternative } from '@/lib/services/live/templates';

const BATCH = 15;
const WEEK = 7 * 24 * 60 * 60 * 1000;

function metaConfig() {
  const token = process.env.PAGE_ACCESS_TOKEN?.trim();
  const version = process.env.META_GRAPH_VERSION?.trim();
  if (!token || !version || !/^v\d+\.\d+$/.test(version)) {
    throw new LiveError('Cần cấu hình PAGE_ACCESS_TOKEN và META_GRAPH_VERSION để nhắn riêng.', 503, 'NO_FACEBOOK');
  }
  return { token, version };
}

interface MemberRow {
  comment_id: string; author_id: string; author_name: string; created_at: string;
  sku: string | null; color: string | null; size: string | null; qty: number | null; intent: string;
}

type Outcome = 'sent' | 'failed' | 'unknown' | 'not_allowed';

async function sendFacebook(pageId: string, commentId: string, text: string): Promise<{ outcome: Outcome; messageId: string | null; recipientId: string | null }> {
  const { token, version } = metaConfig();
  try {
    const live = await graphRead(commentId, 'can_reply_privately');
    if (live.can_reply_privately !== true) return { outcome: 'not_allowed', messageId: null, recipientId: null };
  } catch {
    // Không đọc được bình luận (đã xoá, thiếu quyền...) → chưa gửi gì, đánh dấu lỗi để shop xem
    return { outcome: 'failed', messageId: null, recipientId: null };
  }
  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${pageId}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
    });
    if (response.ok) {
      const result = await response.json() as { message_id?: unknown; recipient_id?: unknown };
      if (typeof result.message_id === 'string' && result.message_id) {
        const recipientId = typeof result.recipient_id === 'string' && /^\d{1,64}$/.test(result.recipient_id) ? result.recipient_id : null;
        return { outcome: 'sent', messageId: result.message_id, recipientId };
      }
      return { outcome: 'unknown', messageId: null, recipientId: null };
    }
    return { outcome: response.status >= 400 && response.status < 500 ? 'failed' : 'unknown', messageId: null, recipientId: null };
  } catch {
    return { outcome: 'unknown', messageId: null, recipientId: null }; // có thể Meta đã nhận — không tự gửi lại
  }
}

/**
 * Duyệt nhóm và gửi tối đa 15 tin mỗi lần gọi (giới hạn thời gian của serverless). Gọi lại cho tới khi remaining = 0.
 * @param revision phiên bản câu trả lời dashboard đang hiển thị — lệch thì từ chối để không gửi câu cũ.
 */
export async function approveGroup(pageId: string, sessionId: string, groupKey: string, text: string, revision: number,
  db: Database = getMessengerPool(), now = Date.now()): Promise<LiveSendResult & { revision: number }> {
  const { session, products } = await loadSession(pageId, sessionId, db);
  const group = (await db.query('SELECT * FROM live_groups WHERE session_id=$1 AND group_key=$2', [sessionId, groupKey])).rows[0];
  if (!group) throw new LiveError('Không tìm thấy nhóm bình luận.', 404);
  if (Number(group.revision) !== revision) throw new LiveError('Câu trả lời của nhóm vừa thay đổi. Hãy tải lại rồi duyệt.', 409);
  const template = text.trim();
  if (!template || template.length > 2000) throw new LiveError('Câu trả lời phải từ 1 đến 2.000 ký tự.');
  let currentRevision = revision;
  if (template !== group.reply_text) {
    const updated = await db.query(`UPDATE live_groups SET reply_text=$4, reply_source='shop', revision=revision+1, updated_at=$5
      WHERE session_id=$1 AND group_key=$2 AND revision=$3 RETURNING revision`, [sessionId, groupKey, revision, template, now]);
    if (!updated.rowCount) throw new LiveError('Câu trả lời của nhóm vừa thay đổi. Hãy tải lại rồi duyệt.', 409);
    currentRevision = Number(updated.rows[0].revision);
  }

  // Tồn kho hiện tại để điền {con_lai} / gợi ý mẫu khác khi hết hàng
  const orders = (await db.query('SELECT items_json, status FROM live_orders WHERE session_id=$1', [sessionId])).rows;
  const held = new Map<string, number>();
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    const items = (typeof o.items_json === 'string' ? JSON.parse(o.items_json) : o.items_json) as LiveOrderItem[];
    for (const i of items) if (i.stockOk) held.set(i.sku, (held.get(i.sku) ?? 0) + i.qty);
  }
  const remainingOf = (sku: string) => (products.find((p) => p.sku === sku)?.qty ?? 0) - (held.get(sku) ?? 0);

  const members = (await db.query(`SELECT comment_id,author_id,author_name,created_at,sku,color,size,qty,intent FROM live_comments
    WHERE session_id=$1 AND group_key=$2 AND reply_status IN ('review','failed') ORDER BY created_at LIMIT ${BATCH}`,
  [sessionId, groupKey])).rows as MemberRow[];
  const result: LiveSendResult = { sent: 0, failed: 0, notAllowed: 0, unknown: 0, remaining: 0 };

  for (const m of members) {
    const product = products.find((p) => p.sku === m.sku) ?? null;
    const message = fillTemplate(template, {
      customerName: m.author_name, product, color: m.color, size: m.size, qty: m.qty,
      remaining: product ? remainingOf(product.sku) : null, suggestion: suggestAlternative(product, products, remainingOf),
    });
    // Đặt chỗ trước khi gửi: lần duyệt song song không gửi trùng
    const reserved = await db.query(`UPDATE live_comments SET reply_status='sending', reply_text=$3
      WHERE session_id=$1 AND comment_id=$2 AND reply_status IN ('review','failed') RETURNING comment_id`,
    [sessionId, m.comment_id, message]);
    if (!reserved.rowCount) continue;

    let outcome: Outcome;
    let messageId: string | null = null;
    let recipientId: string | null = null;
    if (session.platform === 'demo' || m.comment_id.startsWith('manual-')) {
      outcome = 'sent';
      messageId = `demo-${randomUUID()}`;
    } else if (now - Number(m.created_at) >= WEEK) {
      outcome = 'not_allowed'; // Meta chỉ cho nhắn riêng trong 7 ngày
    } else {
      ({ outcome, messageId, recipientId } = await sendFacebook(pageId, m.comment_id, message));
    }
    const sentAt = Date.now();
    await db.query(`UPDATE live_comments SET reply_status=$3, message_id=$4, sent_at=$5 WHERE session_id=$1 AND comment_id=$2`,
      [sessionId, m.comment_id, outcome, messageId, outcome === 'sent' ? sentAt : null]);
    if (outcome === 'sent') {
      result.sent++;
      // Đơn đã nhắn xin địa chỉ → chờ khách gửi thông tin
      if (m.intent === 'order') {
        await db.query(`UPDATE live_orders SET status='awaiting_info', updated_at=$3
          WHERE session_id=$1 AND customer_id=$2 AND status='draft'`, [sessionId, m.author_id, sentAt]);
      }
      if (recipientId && messageId && session.platform === 'facebook') {
        try {
          await savePostgresMessages([{ pageId, psid: recipientId, messageId, direction: 'out', timestamp: sentAt, text: message, attachments: [] }], db);
        } catch { /* Messenger echo sẽ đồng bộ lại */ }
      }
    } else if (outcome === 'failed') result.failed++;
    else if (outcome === 'not_allowed') result.notAllowed++;
    else result.unknown++;
  }

  result.remaining = Number((await db.query(`SELECT COUNT(*) AS n FROM live_comments
    WHERE session_id=$1 AND group_key=$2 AND reply_status='review'`, [sessionId, groupKey])).rows[0].n);
  return { ...result, revision: currentRevision };
}
