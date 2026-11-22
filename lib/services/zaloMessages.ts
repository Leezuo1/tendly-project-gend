import type { Pool } from 'pg';
import type { MessengerAttachment, MessengerMessage } from '@/lib/types/messenger';

// shortcut: tin Zalo dùng chung bảng messenger_*, tách bằng page_id "zalo:<id tài khoản>" (không đụng Messenger); tách bảng/cột platform khi cần nhiều tài khoản Zalo cho nhiều shop.
export const ZALO_PAGE_PREFIX = 'zalo:';
export class InvalidZaloPayload extends Error {}

export interface ZaloProfile { name: string | null; avatarUrl: string | null }
export interface ZaloIngest { pageId: string; messages: MessengerMessage[]; profiles: Map<string, ZaloProfile> }

const ID = /^\d{1,64}$/;
const object = (v: unknown, label: string) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new InvalidZaloPayload(`${label} không hợp lệ.`);
  return v as Record<string, unknown>;
};
const httpsUrl = (v: unknown) => {
  if (typeof v !== 'string' || v.length > 4096) return null;
  try { const url = new URL(v); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
};
const cleanName = (v: unknown) => typeof v === 'string' ? v.trim().slice(0, 200) || null : null;

/** Kiểm tra dữ liệu worker zca-js gửi lên (tin cậy thấp: ai biết secret mới gọi được, nhưng vẫn kiểm từng trường). */
export function parseZaloIngest(input: unknown): ZaloIngest {
  const body = object(input, 'Dữ liệu Zalo');
  if (typeof body.ownId !== 'string' || !ID.test(body.ownId)) throw new InvalidZaloPayload('Thiếu ownId Zalo.');
  if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 100) throw new InvalidZaloPayload('Cần 1–100 tin nhắn.');
  const pageId = ZALO_PAGE_PREFIX + body.ownId;
  const profiles = new Map<string, ZaloProfile>();
  const messages = body.messages.map((raw, index) => {
    const m = object(raw, `Tin nhắn ${index + 1}`);
    const ts = Number(m.ts);
    if (typeof m.threadId !== 'string' || !ID.test(m.threadId) || m.threadId === body.ownId) throw new InvalidZaloPayload('threadId Zalo không hợp lệ.');
    if (typeof m.msgId !== 'string' || !/^[\w-]{1,64}$/.test(m.msgId)) throw new InvalidZaloPayload('msgId Zalo không hợp lệ.');
    if (!Number.isSafeInteger(ts) || ts <= 0 || typeof m.isSelf !== 'boolean') throw new InvalidZaloPayload('Thời gian hoặc hướng tin không hợp lệ.');
    const text = typeof m.text === 'string' ? m.text.slice(0, 20_000) : '';
    const attachments: MessengerAttachment[] = (Array.isArray(m.attachments) ? m.attachments.slice(0, 10) : []).flatMap(a => {
      const item = a && typeof a === 'object' ? a as Record<string, unknown> : {};
      if (typeof item.type !== 'string' || !/^[a-z]{1,20}$/.test(item.type)) return [];
      const url = httpsUrl(item.url);
      return [{ type: item.type, ...(url ? { url } : {}) }];
    });
    // Tên/ảnh trong tin của chính shop là hồ sơ của shop, không phải của khách.
    if (!m.isSelf && m.profile) {
      const p = object(m.profile, 'Hồ sơ Zalo');
      profiles.set(m.threadId, { name: cleanName(p.name), avatarUrl: httpsUrl(p.avatar) });
    }
    return { pageId, psid: m.threadId, messageId: m.msgId, direction: m.isSelf ? 'out' as const : 'in' as const, timestamp: ts, text, attachments };
  });
  return { pageId, messages, profiles };
}

export async function saveZaloMessages(ingest: ZaloIngest, db: Pick<Pool, 'query' | 'connect'>) {
  const { savePostgresMessages } = await import('@/lib/services/messengerPostgres');
  const result = await savePostgresMessages(ingest.messages, db);
  const now = Date.now();
  for (const [psid, p] of ingest.profiles) {
    if (!p.name && !p.avatarUrl) continue;
    await db.query(`UPDATE messenger_customers SET display_name=COALESCE($3,display_name), avatar_url=COALESCE($4,avatar_url),
      profile_status='ready', profile_refreshed_at=$5 WHERE page_id=$1 AND psid=$2`, [ingest.pageId, psid, p.name, p.avatarUrl, now]);
  }
  return result;
}

/** shortcut: một tài khoản Zalo đang đồng bộ (cái có tin mới nhất); đọc theo shop khi gắn Zalo vào app_users. */
export async function readZaloInboxPageId(db: Pick<Pool, 'query'>): Promise<string | null> {
  const row = (await db.query(`SELECT page_id FROM messenger_conversations WHERE page_id LIKE 'zalo:%'
    ORDER BY last_message_at DESC NULLS LAST LIMIT 1`)).rows[0];
  return row?.page_id ?? null;
}
