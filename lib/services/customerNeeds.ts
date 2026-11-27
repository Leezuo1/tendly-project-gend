import type { Pool } from 'pg';
import { getMessengerPool } from '@/lib/services/messengerPostgres';

export const NEEDS_MAX = 500;

export class CustomerNeedsError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export function parseNeeds(input: unknown): string {
  if (typeof input !== 'string' || input.trim().length > NEEDS_MAX) throw new CustomerNeedsError('Nhu cầu không hợp lệ.');
  return input.trim();
}

/** Nhân viên ghi nhu cầu của khách; chuỗi rỗng là xóa. Không tạo khách mới. */
export async function saveCustomerNeeds(pageId: string, psid: string, input: unknown,
  db: Pick<Pool, 'query'> = getMessengerPool()): Promise<{ needs: string; needsUpdatedAt: number }> {
  const needs = parseNeeds(input);
  const row = (await db.query(`UPDATE messenger_customers SET needs=$3, needs_updated_at=$4
    WHERE page_id=$1 AND psid=$2 RETURNING needs, needs_updated_at`, [pageId, psid, needs, Date.now()])).rows[0];
  if (!row) throw new CustomerNeedsError('Không tìm thấy khách hàng.', 404);
  return { needs: row.needs, needsUpdatedAt: Number(row.needs_updated_at) };
}
