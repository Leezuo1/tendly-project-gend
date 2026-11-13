import type { Pool } from 'pg';
import { getMessengerPool } from '@/lib/services/messengerPostgres';

export interface CustomerOrderHistory {
  confirmedOrders: number; confirmedTotalVnd: number; lastConfirmedDate: string | null;
  recent: { id: string; status: 'confirmed' | 'draft'; items: string; totalVnd: number; date: string }[];
}

// Readable dates: raw epoch milliseconds tend to be turned into wrong dates by the model.
const day = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });

// What the AI may know about a customer's orders: ids, items, quantities and totals. Never contact details.
export async function readCustomerOrderHistory(pageId: string, psid: string,
  db: Pick<Pool, 'query'> = getMessengerPool()): Promise<CustomerOrderHistory | null> {
  try {
    const params = [pageId, psid];
    const total = (await db.query(`SELECT COUNT(*) FILTER (WHERE status='confirmed') AS n,
      COALESCE(SUM(total) FILTER (WHERE status='confirmed'),0) AS sum, MAX(created_at) FILTER (WHERE status='confirmed') AS last
      FROM messenger_orders WHERE page_id=$1 AND psid=$2`, params)).rows[0];
    const recent = (await db.query(`SELECT id,items_json,total,status,created_at FROM messenger_orders
      WHERE page_id=$1 AND psid=$2 AND status<>'cancelled' ORDER BY created_at DESC LIMIT 3`, params)).rows;
    if (!recent.length) return null;
    return { confirmedOrders: Number(total.n), confirmedTotalVnd: Number(total.sum), lastConfirmedDate: total.last == null ? null : day(Number(total.last)),
      recent: recent.map((row) => ({ id: String(row.id), status: row.status, totalVnd: Number(row.total), date: day(Number(row.created_at)),
        items: (Array.isArray(row.items_json) ? row.items_json : []).slice(0, 10)
          .map((item: { name?: unknown; qty?: unknown }) => `${String(item?.name ?? '').slice(0, 80)} x${Number(item?.qty) || 1}`).join(', ') })) };
  } catch {
    // Order history is optional context: a missing table or a query error must never stop a customer reply.
    return null;
  }
}
