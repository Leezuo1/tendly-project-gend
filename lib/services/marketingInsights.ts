/**
 * Số liệu Marketing lấy từ dữ liệu thật (Messenger + bài đăng trong Postgres).
 * Shop chưa có dữ liệu đơn hàng nên nhóm khách chia theo hoạt động nhắn tin, không phải RFM.
 */
import type { Pool } from 'pg';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import { normalize } from '@/lib/utils/format';
import type { ActivitySegment, MarketingCustomer, RemarketingSend } from '@/lib/types/marketing';

type Queryable = Pick<Pool, 'query'>;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Messenger chỉ cho phép shop nhắn trong 24 giờ từ tin cuối của khách; chừa 30 phút cho an toàn. */
export const MESSAGING_WINDOW = 24 * HOUR - 30 * 60_000;
/** Khách nhắn lại trong khoảng này sau tin remarketing thì tính là "nhắn lại". */
export const REPLY_WINDOW = 7 * DAY;
/** request_id của tin remarketing trong messenger_outbound_requests (Hộp thoại dùng UUID trần). */
export const REMARKETING_PREFIX = 'rmk-';

export function activitySegment(createdAt: number, lastInAt: number | null, now = Date.now()): ActivitySegment {
  if (now - createdAt <= 7 * DAY) return 'new';
  if (lastInAt === null) return 'risk';
  if (now - lastInAt <= 7 * DAY) return 'active';
  if (now - lastInAt <= 30 * DAY) return 'quiet';
  return 'risk';
}

// Từ khoá đã bỏ dấu (khách hay gõ không dấu). Tránh từ một âm tiết dễ nhầm: "loi" (lời/lỗi), "hong" (hông/hỏng), "gia" (giá/gia đình).
const PRODUCT_QUESTION_WORDS = [
  'size', 'con hang', 'con khong', 'het hang', 'bao nhieu', 'gia bao', 'gia sao', 'gia the nao', 'mau gi', 'co mau',
  'co san', 'phi ship', 'ship khong', 'ship ve', 'dat hang', 'dat mua', 'chot don', 'ib gia', 'inbox gia',
];
const COMPLAINT_WORDS = [
  'bi loi', 'hang loi', 'san pham loi', 'bi hong', 'hu hong', 'hong roi', 'rach', 'chat luong kem', 'kem chat luong',
  'chua nhan', 'khong nhan duoc', 'giao cham', 'cham qua', 'doi tra', 'hoan tien', 'tra hang', 'te qua', 'that vong',
  'lua dao', 'buc minh', 'khieu nai', 'sai hang', 'giao sai', 'thieu hang',
];

const hasPhrase = (text: string, phrases: string[]) => phrases.some((p) => text.includes(` ${p} `));

/** Tên/SKU sản phẩm trong Cấu hình AI để dò khách đã hỏi sản phẩm nào (bỏ chữ thương hiệu chung). */
export function productMatchers(products: { name: string; sku: string }[], shopName = '') {
  const brand = normalize(shopName);
  return products.slice(0, 200).map((p) => {
    const name = normalize(p.name).split(' ').filter((w) => w && w !== brand).join(' ');
    return { label: p.name, terms: [normalize(p.sku), name].filter((t) => t.length >= 3) };
  });
}

interface CustomerRow {
  id: string; psid: string; display_name: string | null; avatar_url: string | null;
  created_at: string; last_in_at: string | null; last_out_at: string | null;
}

export async function readMarketingCustomers(
  pageId: string, products: { label: string; terms: string[] }[], now = Date.now(), db: Queryable = getMessengerPool(),
): Promise<MarketingCustomer[]> {
  // Giống Hộp thoại: bỏ hội thoại đã xoá (hidden_at) và tin trước mốc xoá (view_start_at).
  // created_at là lúc Tendly nhận/đồng bộ hội thoại; lần đầu khách nhắn lấy theo tin sớm nhất còn hiển thị.
  const { rows } = await db.query(`SELECT c.id, u.psid, u.display_name, u.avatar_url, c.last_in_at, c.last_out_at,
      LEAST(c.created_at, COALESCE((SELECT MIN(m.sent_at) FROM messenger_messages m
        WHERE m.page_id = c.page_id AND m.conversation_id = c.id AND m.sent_at > COALESCE(c.view_start_at, 0)), c.created_at)) AS created_at
    FROM messenger_conversations c JOIN messenger_customers u ON u.id = c.customer_id
    WHERE c.page_id=$1 AND c.hidden_at IS NULL ORDER BY c.last_message_at DESC NULLS LAST, c.id LIMIT 500`, [pageId]);
  const ids = (rows as CustomerRow[]).map((r) => r.id);
  // 30 tin khách gửi gần nhất của mỗi hội thoại là đủ để dò từ khoá, không đọc cả lịch sử.
  const inbound = ids.length ? (await db.query(`SELECT conversation_id, text, sent_at, total FROM (
      SELECT m.conversation_id, m.text, m.sent_at, COUNT(*) OVER (PARTITION BY m.conversation_id) AS total,
        ROW_NUMBER() OVER (PARTITION BY m.conversation_id ORDER BY m.sent_at DESC, m.message_id DESC) AS rn
      FROM messenger_messages m JOIN messenger_conversations c ON c.page_id = m.page_id AND c.id = m.conversation_id
      WHERE m.page_id=$1 AND m.direction='in' AND m.conversation_id = ANY($2::text[])
        AND m.sent_at > COALESCE(c.view_start_at, 0)
    ) recent WHERE rn <= 30 ORDER BY sent_at DESC`, [pageId, ids])).rows : [];

  return (rows as CustomerRow[]).map((row) => {
    const messages = inbound.filter((m) => m.conversation_id === row.id);
    const text = ` ${messages.map((m) => normalize(String(m.text))).join(' ')} `;
    const matchedProducts = products.filter((p) => p.terms.some((t) => text.includes(` ${t} `))).map((p) => p.label);
    const createdAt = Number(row.created_at);
    const lastInAt = row.last_in_at === null ? null : Number(row.last_in_at);
    const lastOutAt = row.last_out_at === null ? null : Number(row.last_out_at);
    return {
      psid: row.psid,
      name: row.display_name?.trim() || `Khách #${row.psid.slice(-4)}`,
      avatarUrl: row.avatar_url,
      segment: activitySegment(createdAt, lastInAt, now),
      firstContactAt: createdAt,
      lastInAt,
      lastOutAt,
      inboundCount: messages.length ? Number(messages[0].total) : 0,
      lastInboundText: messages.find((m) => String(m.text).trim())?.text ?? '',
      waitingReply: lastInAt !== null && lastInAt > (lastOutAt ?? 0),
      canMessageUntil: lastInAt !== null && now - lastInAt < MESSAGING_WINDOW ? lastInAt + MESSAGING_WINDOW : null,
      askedProduct: matchedProducts.length > 0 || hasPhrase(text, PRODUCT_QUESTION_WORDS),
      complained: hasPhrase(text, COMPLAINT_WORDS),
      matchedProducts,
    };
  });
}

/** Hội thoại gần đây (cả hai chiều) để AI soạn tin nhắn cá nhân hoá. */
export async function readConversationForDraft(pageId: string, psid: string, db: Queryable = getMessengerPool()) {
  const conversationId = JSON.stringify([pageId, psid]);
  // Hội thoại đã xoá thì không soạn; tin trước mốc xoá không đưa cho AI đọc.
  const customer = await db.query(`SELECT u.display_name, u.first_name, c.last_in_at, c.view_start_at FROM messenger_conversations c
    JOIN messenger_customers u ON u.id = c.customer_id WHERE c.page_id=$1 AND c.id=$2 AND c.hidden_at IS NULL`, [pageId, conversationId]);
  if (!customer.rows.length) return null;
  const messages = await db.query(`SELECT direction, text, sent_at FROM messenger_messages
    WHERE page_id=$1 AND conversation_id=$2 AND sent_at > $3
    ORDER BY sent_at DESC, message_id DESC LIMIT 20`, [pageId, conversationId, Number(customer.rows[0].view_start_at ?? 0)]);
  return {
    name: (customer.rows[0].first_name || customer.rows[0].display_name || '') as string,
    lastInAt: customer.rows[0].last_in_at === null ? null : Number(customer.rows[0].last_in_at),
    messages: messages.rows.reverse().map((m) => ({
      from: m.direction === 'in' ? 'khach' as const : 'shop' as const,
      text: String(m.text).slice(0, 1000),
      at: Number(m.sent_at),
    })),
  };
}

/** Tin remarketing đã gửi thành công và khách có nhắn lại trong 7 ngày sau đó không. */
export async function readRemarketingSends(pageId: string, db: Queryable = getMessengerPool()): Promise<RemarketingSend[]> {
  const { rows } = await db.query(`SELECT r.psid, r.text, r.created_at, u.display_name,
      (SELECT MIN(m.sent_at) FROM messenger_messages m
        WHERE m.page_id = r.page_id AND m.conversation_id = c.id AND m.direction='in'
          AND m.sent_at > r.created_at AND m.sent_at <= r.created_at + $3) AS replied_at
    FROM messenger_outbound_requests r
    LEFT JOIN messenger_conversations c ON c.page_id = r.page_id AND c.id = '["' || r.page_id || '","' || r.psid || '"]'
    LEFT JOIN messenger_customers u ON u.id = c.customer_id
    WHERE r.page_id=$1 AND r.status='sent' AND r.request_id LIKE $2
    ORDER BY r.created_at DESC LIMIT 200`, [pageId, `${REMARKETING_PREFIX}%`, REPLY_WINDOW]);
  return rows.map((r) => ({
    psid: r.psid as string,
    name: (r.display_name as string | null)?.trim() || `Khách #${String(r.psid).slice(-4)}`,
    text: r.text as string,
    sentAt: Number(r.created_at),
    repliedAt: r.replied_at === null ? null : Number(r.replied_at),
  }));
}
