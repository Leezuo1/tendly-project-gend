import type { Pool } from 'pg';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import { customerProfileFromRow } from '@/lib/services/messengerInboxDb';
import type { MessengerInboxSnapshot } from '@/lib/types/messengerInbox';

const HOUR = 60 * 60 * 1000;
const cleanName = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 200) || null : null;
function safeAvatar(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 4096) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

/** Refresh at most three visible customers per poll, with a database lease across server instances. */
export async function refreshMessengerProfiles(snapshot: MessengerInboxSnapshot,
  db: Pick<Pool, 'query'> = getMessengerPool(), transport: typeof fetch = fetch) {
  const pageId = process.env.PAGE_ID?.trim();
  const token = process.env.PAGE_ACCESS_TOKEN?.trim();
  const version = process.env.META_GRAPH_VERSION?.trim();
  if (!pageId || !token || !version || !/^v\d+\.\d+$/.test(version)) return snapshot;
  const now = Date.now();
  const candidates = snapshot.conversations.filter((thread) => thread.pageId === pageId &&
    /^\d{1,64}$/.test(thread.psid) && (thread.customer?.retryAfter ?? 0) <= now).slice(0, 3);
  await Promise.allSettled(candidates.map(async (thread) => {
    // A short lease prevents every 2-second poll (or another dashboard) fetching the same profile.
    const claimed = await db.query(`UPDATE messenger_customers SET profile_retry_after=$3
      WHERE page_id=$1 AND psid=$2 AND (profile_retry_after IS NULL OR profile_retry_after <= $4)
      RETURNING psid`, [pageId, thread.psid, now + 60_000, now]);
    if (!claimed.rowCount) return;
    let firstName: string | null = null;
    let lastName: string | null = null;
    let avatarUrl: string | null = null;
    let available = false;
    try {
      const response = await transport(`https://graph.facebook.com/${version}/${encodeURIComponent(thread.psid)}?fields=first_name,last_name,profile_pic`, {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(3000), cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        firstName = cleanName(data.first_name);
        lastName = cleanName(data.last_name);
        avatarUrl = safeAvatar(data.profile_pic);
        available = Boolean(firstName || lastName || avatarUrl);
      }
    } catch { /* A missing profile must never prevent reading/replying to messages. */ }
    const name = [firstName, lastName].filter(Boolean).join(' ') || null;
    const result = await db.query(`UPDATE messenger_customers SET
      display_name=COALESCE($3,display_name), first_name=COALESCE($4,first_name),
      last_name=COALESCE($5,last_name), avatar_url=COALESCE($6,avatar_url),
      profile_status=CASE WHEN $7::boolean THEN 'ready'
        WHEN display_name IS NOT NULL OR avatar_url IS NOT NULL THEN 'ready' ELSE 'unavailable' END,
      profile_refreshed_at=CASE WHEN $7::boolean THEN $8::bigint ELSE profile_refreshed_at END,
      profile_retry_after=$9 WHERE page_id=$1 AND psid=$2 RETURNING *`,
    [pageId, thread.psid, name, firstName, lastName, avatarUrl, available, now, now + (available ? 24 * HOUR : HOUR)]);
    if (result.rows[0]) thread.customer = customerProfileFromRow(result.rows[0]);
  }));
  return snapshot;
}
