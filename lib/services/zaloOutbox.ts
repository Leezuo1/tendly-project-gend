import { createHash, timingSafeEqual } from 'node:crypto';
import type { Pool } from 'pg';
import { ZALO_PAGE_PREFIX } from '@/lib/services/zaloMessages';

type Db = Pick<Pool, 'query'>;
export class ZaloSendError extends Error { constructor(message: string, readonly status: number) { super(message); } }

export const ZALO_TEXT_MAX = 2000;
const WORKER_FRESH_MS = 15_000;   // worker hỏi hàng đợi mỗi ~1,5 giây
const PENDING_EXPIRES_MS = 60_000; // tin chưa ai nhận quá lâu thì hỏng, không gửi muộn khi worker bật lại
const SENDING_EXPIRES_MS = 120_000; // worker chết giữa chừng: có thể đã gửi, không tự gửi lại
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Worker xác thực bằng ZALO_INGEST_SECRET (cùng bí mật với route nhận tin). */
export function hasZaloSecret(request: Request) {
  const secret = process.env.ZALO_INGEST_SECRET?.trim();
  const value = request.headers.get('authorization') ?? '';
  return !!secret && timingSafeEqual(createHash('sha256').update(value).digest(), createHash('sha256').update(`Bearer ${secret}`).digest());
}

export interface ZaloResult { id: string; ok: boolean; error?: string }
export interface ZaloJob { id: string; psid: string; text: string }

/** Một lượt của worker: báo kết quả các tin đã gửi, báo "còn sống", rồi nhận tin mới. */
export async function pollZaloOutbox(ownId: string, results: ZaloResult[], db: Db, now = Date.now()): Promise<ZaloJob[]> {
  const pageId = ZALO_PAGE_PREFIX + ownId;
  await db.query(`INSERT INTO zalo_worker(id,own_id,last_seen_at) VALUES(1,$1,$2)
    ON CONFLICT(id) DO UPDATE SET own_id=EXCLUDED.own_id,last_seen_at=EXCLUDED.last_seen_at`, [ownId, now]);
  for (const r of results) {
    await db.query(`UPDATE zalo_outbox SET status=$3,error=$4,updated_at=$5 WHERE id=$1 AND page_id=$2 AND status='sending'`,
      [r.id, pageId, r.ok ? 'sent' : 'failed', r.ok ? null : (r.error ?? 'Zalo không gửi được tin.').slice(0, 300), now]);
  }
  await db.query(`UPDATE zalo_outbox SET status='failed',error='Worker Zalo không nhận kịp tin này.',updated_at=$2
    WHERE page_id=$1 AND status='pending' AND created_at<$3`, [pageId, now, now - PENDING_EXPIRES_MS]);
  await db.query(`UPDATE zalo_outbox SET status='failed',error='Worker dừng giữa chừng; kiểm tra Zalo trước khi gửi lại.',updated_at=$2
    WHERE page_id=$1 AND status='sending' AND updated_at<$3`, [pageId, now, now - SENDING_EXPIRES_MS]);
  // Điều kiện status ở UPDATE ngoài được kiểm lại sau khi khóa hàng, nên hai worker không nhận trùng một tin.
  const claimed = await db.query(`UPDATE zalo_outbox SET status='sending',updated_at=$2 WHERE status='pending' AND id IN
    (SELECT id FROM zalo_outbox WHERE page_id=$1 AND status='pending' ORDER BY created_at LIMIT 5) RETURNING id,psid,text,created_at`, [pageId, now]);
  return claimed.rows.sort((a, b) => Number(a.created_at) - Number(b.created_at)).map(r => ({ id: r.id, psid: r.psid, text: r.text }));
}

/** Xếp một tin chữ vào hàng đợi. requestId do client sinh: gửi lại cùng mã không tạo tin thứ hai. */
export async function queueZaloText(input: { psid: unknown; text: unknown; requestId: unknown }, db: Db, now = Date.now()) {
  const { psid, text, requestId } = input;
  if (typeof psid !== 'string' || !/^\d{1,64}$/.test(psid) || typeof requestId !== 'string' || !UUID.test(requestId)) throw new ZaloSendError('Thông tin gửi không hợp lệ.', 400);
  if (typeof text !== 'string' || !text.trim() || text.length > ZALO_TEXT_MAX) throw new ZaloSendError(`Tin nhắn cần 1–${ZALO_TEXT_MAX} ký tự.`, 400);
  const worker = (await db.query('SELECT own_id,last_seen_at FROM zalo_worker WHERE id=1')).rows[0];
  if (!worker || now - Number(worker.last_seen_at) > WORKER_FRESH_MS) throw new ZaloSendError('Worker Zalo chưa chạy. Chạy npm run zalo:listener rồi gửi lại.', 503);
  const pageId = ZALO_PAGE_PREFIX + worker.own_id;
  // Chỉ nhắn lại hội thoại đã có trong hộp thư, không gửi tới uid tùy ý.
  const thread = await db.query('SELECT 1 FROM messenger_conversations WHERE page_id=$1 AND id=$2', [pageId, JSON.stringify([pageId, psid])]);
  if (!thread.rows.length) throw new ZaloSendError('Không tìm thấy hội thoại Zalo này.', 404);
  await db.query(`INSERT INTO zalo_outbox(id,page_id,psid,text,status,created_at,updated_at) VALUES($1,$2,$3,$4,'pending',$5,$5)
    ON CONFLICT(id) DO NOTHING`, [requestId, pageId, psid, text, now]);
  const row = (await db.query('SELECT page_id,psid,text FROM zalo_outbox WHERE id=$1', [requestId])).rows[0];
  if (row.page_id !== pageId || row.psid !== psid || row.text !== text) throw new ZaloSendError('Mã yêu cầu gửi đã dùng cho tin khác.', 409);
  return requestId;
}

/** Chờ worker báo kết quả; hết giờ thì trả 'pending' (tin vẫn trong hàng đợi, đừng gửi lại). */
export async function waitZaloResult(id: string, db: Db, timeoutMs = 12_000, sleep = (ms: number) => new Promise(r => setTimeout(r, ms))) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const row = (await db.query('SELECT status,error FROM zalo_outbox WHERE id=$1', [id])).rows[0] as { status: string; error: string | null };
    if (row.status === 'sent' || row.status === 'failed') return row;
    if (Date.now() >= until) return row;
    await sleep(400);
  }
}
