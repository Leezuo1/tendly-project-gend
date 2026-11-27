import type { Pool } from 'pg';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import type { CrmCustomerPage } from '@/lib/types/crmExport';

export function parseCrmLimit(value: string | null): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 50;
}

/** Khách còn hiển thị trong Hộp thoại của Page, sắp theo psid; `after` là `nextCursor` của trang trước. */
export async function readCrmCustomers(pageId: string, opts: { limit: number; after?: string | null },
  db: Pick<Pool, 'query'> = getMessengerPool()): Promise<CrmCustomerPage> {
  const rows = (await db.query(`SELECT u.psid, u.display_name, u.needs, u.needs_source, u.needs_updated_at, u.created_at, c.last_message_at,
      COALESCE(o.n,0) AS n, COALESCE(o.total,0) AS total, o.last_at, COALESCE(o.mock,false) AS mock
    FROM messenger_customers u
    JOIN messenger_conversations c ON c.customer_id=u.id AND c.hidden_at IS NULL
    LEFT JOIN (SELECT psid, COUNT(*) AS n, SUM(total) AS total, MAX(created_at) AS last_at, bool_or(is_mock) AS mock
      FROM messenger_orders WHERE page_id=$1 AND status='confirmed' GROUP BY psid) o ON o.psid=u.psid
    WHERE u.page_id=$1 AND ($2::text IS NULL OR u.psid > $2::text)
    ORDER BY u.psid LIMIT $3`, [pageId, opts.after ?? null, opts.limit + 1])).rows;
  const page = rows.slice(0, opts.limit);
  const num = (value: unknown) => value == null ? null : Number(value);
  return {
    customers: page.map((row) => ({ id: row.psid, channel: 'messenger' as const, name: row.display_name ?? null, needs: row.needs ?? '',
      needsSource: row.needs_source === 'ai' || row.needs_source === 'staff' ? row.needs_source : null,
      needsUpdatedAt: num(row.needs_updated_at), createdAt: Number(row.created_at), lastMessageAt: num(row.last_message_at),
      orders: { confirmedCount: Number(row.n), confirmedTotalVnd: Number(row.total), lastConfirmedAt: num(row.last_at), includesMock: row.mock === true } })),
    nextCursor: rows.length > opts.limit ? page[page.length - 1].psid : null,
  };
}
