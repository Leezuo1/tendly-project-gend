import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const INBOX_SESSION_COOKIE = 'tendly_inbox_session';
export function createInboxSession(key: string, now = Date.now()): string {
  const expires = Math.floor(now / 1000) + 3600;
  const signature = createHmac('sha256', key).update(`inbox-session:${expires}`).digest('hex');
  return `${expires}.${signature}`;
}

function validSession(request: Request, key: string): boolean {
  const cookie = request.headers.get('cookie')?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${INBOX_SESSION_COOKIE}=`))?.slice(INBOX_SESSION_COOKIE.length + 1) || '';
  const match = /^(\d{10})\.([a-f0-9]{64})$/.exec(cookie);
  if (!match || Number(match[1]) <= Math.floor(Date.now() / 1000)) return false;
  const expected = createHmac('sha256', key).update(`inbox-session:${match[1]}`).digest();
  return timingSafeEqual(expected, Buffer.from(match[2], 'hex'));
}

/** Temporary single-shop access until the application has account authentication. */
export function inboxAccessError(request: Request): Response | undefined {
  const key = process.env.INBOX_ACCESS_KEY;
  if (!key || key.length < 24) return Response.json({ error: 'Chưa cấu hình INBOX_ACCESS_KEY (ít nhất 24 ký tự).' }, { status: 503 });
  if (validSession(request, key)) {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'Nguồn truy cập không hợp lệ.' }, { status: 403 });
    return;
  }
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  const hash = (value: string) => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(hash(key), hash(supplied))) return Response.json({ error: 'Mã truy cập inbox không đúng.' }, { status: 401 });
}
