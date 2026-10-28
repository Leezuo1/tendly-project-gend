/**
 * Shop duyệt 1 câu trả lời cho cả nhóm → nhắn riêng (Private Reply) cho từng người bình luận trong nhóm.
 * Giống sendCommentPrivateReply (lib/services/facebookComments.ts): đặt chỗ trong DB trước khi gửi,
 * kết quả mơ hồ thì để "unknown" và không bao giờ tự gửi lại.
 */
import { getMessengerPool, savePostgresMessages } from '@/lib/services/messengerPostgres';
import { graphRead, saveFacebookComments } from '@/lib/services/facebookComments';
import type { LiveOrderItem, LiveSendResult } from '@/lib/types/live';
import { type Database, LiveError, loadSession, markGroupHandled } from '@/lib/services/live/engine';
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
  comment_id: string; author_id: string; author_name: string; created_at: string; text: string;
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
  const { products, session, row: sessionRow } = await loadSession(pageId, sessionId, db);
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

  const members = (await db.query(`SELECT comment_id,author_id,author_name,created_at,text,sku,color,size,qty,intent FROM live_comments
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

    const sharedPostId = session.platform === 'facebook' && session.sourceKind === 'post' ? sessionRow.source_post_id : null;
    if (sharedPostId) {
      await saveFacebookComments([{ pageId, commentId: m.comment_id, postId: sharedPostId,
        authorId: m.author_id, authorName: m.author_name, text: m.text,
        createdAt: Number(m.created_at), eventAt: now, removed: false }], db);
      // Both screens reserve the same Page/comment row before sending a post private reply.
      const shared = await db.query(`UPDATE facebook_comments SET status='sending',draft=$3,reason='Đang gửi qua Meta'
        WHERE page_id=$1 AND comment_id=$2 AND status IN ('pending','review','ignored','failed')
        AND author_id<>page_id RETURNING comment_id`, [pageId, m.comment_id, message]);
      if (!shared.rowCount) {
        await db.query(`UPDATE live_comments SET reply_status='not_allowed' WHERE session_id=$1 AND comment_id=$2`, [sessionId, m.comment_id]);
        result.notAllowed++;
        continue;
      }
    }

    let outcome: Outcome;
    let messageId: string | null = null;
    let recipientId: string | null = null;
    if (now - Number(m.created_at) >= WEEK) {
      outcome = 'not_allowed'; // Meta chỉ cho nhắn riêng trong 7 ngày
    } else {
      ({ outcome, messageId, recipientId } = await sendFacebook(pageId, m.comment_id, message));
    }
    const sentAt = Date.now();
    await db.query(`UPDATE live_comments SET reply_status=$3, message_id=$4, sent_at=$5 WHERE session_id=$1 AND comment_id=$2`,
      [sessionId, m.comment_id, outcome, messageId, outcome === 'sent' ? sentAt : null]);
    if (sharedPostId) await db.query(`UPDATE facebook_comments SET status=$3,message_id=$4,recipient_id=$5,sent_at=$6,reason=$7
      WHERE page_id=$1 AND comment_id=$2 AND status='sending'`,
    [pageId, m.comment_id, outcome === 'not_allowed' ? 'ignored' : outcome, messageId, recipientId,
      outcome === 'sent' ? sentAt : null, outcome === 'sent' ? 'Meta đã xác nhận gửi tin.'
        : outcome === 'unknown' ? 'Chưa xác định kết quả gửi. Kiểm tra Messenger; không tự gửi lại.' : 'Meta chưa cho phép gửi tin.']);
    if (outcome === 'sent') {
      result.sent++;
      // Đơn đã nhắn xin địa chỉ → chờ khách gửi thông tin
      if (m.intent === 'order') {
        await db.query(`UPDATE live_orders SET status='awaiting_info', updated_at=$3
          WHERE session_id=$1 AND customer_id=$2 AND status='draft'`, [sessionId, m.author_id, sentAt]);
      }
      if (recipientId && messageId) {
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

/**
 * "Trả lời bằng comment": Trang trả lời CÔNG KHAI 1 lần dưới bình luận mới nhất của nhóm, cả nhóm cùng thấy câu trả lời,
 * rồi đánh dấu nhóm đã xử lý. Cần Page token có quyền pages_manage_engagement.
 */
export async function replyPublicly(pageId: string, sessionId: string, groupKey: string, text: string, revision: number,
  db: Database = getMessengerPool(), now = Date.now()): Promise<{ commentId: string; repliedTo: string }> {
  const { token, version } = metaConfig();
  const { products } = await loadSession(pageId, sessionId, db);
  const group = (await db.query('SELECT * FROM live_groups WHERE session_id=$1 AND group_key=$2', [sessionId, groupKey])).rows[0];
  if (!group) throw new LiveError('Không tìm thấy nhóm bình luận.', 404);
  if (Number(group.revision) !== revision) throw new LiveError('Câu trả lời của nhóm vừa thay đổi. Hãy tải lại rồi trả lời.', 409);
  const template = text.trim();
  if (!template || template.length > 2000) throw new LiveError('Câu trả lời phải từ 1 đến 2.000 ký tự.');
  const target = (await db.query(`SELECT comment_id, sku, created_at FROM live_comments WHERE session_id=$1 AND group_key=$2
    ORDER BY created_at DESC LIMIT 1`, [sessionId, groupKey])).rows[0];
  if (!target) throw new LiveError('Nhóm chưa có bình luận để trả lời.', 409);
  // Giữ chỗ: không cho 2 lần bấm cùng lúc đăng 2 comment; đã trả lời rồi thì chỉ trả lời lại khi có bình luận mới hơn
  const reserved = await db.query(`UPDATE live_groups SET public_reply_id=$4 WHERE session_id=$1 AND group_key=$2 AND revision=$3
    AND (public_reply_id IS NULL OR (public_reply_id NOT LIKE 'pending:%' AND COALESCE(handled_at,0) < $5))
    RETURNING public_reply_id`, [sessionId, groupKey, revision, `pending:${now}`, Number(target.created_at)]);
  if (!reserved.rowCount) throw new LiveError('Nhóm này vừa được trả lời bằng comment.', 409);
  const product = products.find((p) => p.sku === target.sku) ?? null;
  const message = fillTemplate(template, { customerName: 'mọi người', product, color: null, size: null, qty: null,
    remaining: null, suggestion: null });
  let response: Response;
  try {
    response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(target.comment_id)}/comments`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(12_000), body: JSON.stringify({ message }),
    });
  } catch {
    await db.query(`UPDATE live_groups SET public_reply_id=NULL WHERE session_id=$1 AND group_key=$2 AND public_reply_id=$3`,
      [sessionId, groupKey, `pending:${now}`]);
    throw new LiveError('Mất kết nối với Meta, chưa rõ comment đã đăng chưa. Kiểm tra dưới bình luận trước khi thử lại.', 502);
  }
  const data = await response.json().catch(() => ({})) as { id?: unknown; error?: { code?: unknown; message?: unknown } };
  if (!response.ok || typeof data.id !== 'string') {
    await db.query(`UPDATE live_groups SET public_reply_id=NULL WHERE session_id=$1 AND group_key=$2 AND public_reply_id=$3`,
      [sessionId, groupKey, `pending:${now}`]);
    const code = Number(data.error?.code);
    if (code === 10 || code === 200 || /permission|pages_manage_engagement/i.test(String(data.error?.message ?? ''))) {
      throw new LiveError('Token chưa có quyền trả lời bình luận công khai (pages_manage_engagement). Tạo lại PAGE_ACCESS_TOKEN có quyền này, hoặc dùng "Nhắn riêng".', 403, 'NEED_PERMISSION');
    }
    throw new LiveError('Meta từ chối đăng comment trả lời. Bình luận có thể đã bị xoá.', 502);
  }
  await db.query('UPDATE live_groups SET public_reply_id=$3 WHERE session_id=$1 AND group_key=$2', [sessionId, groupKey, data.id]);
  await markGroupHandled(pageId, sessionId, groupKey, db, Math.max(now, Number(target.created_at)));
  return { commentId: data.id, repliedTo: target.comment_id };
}
