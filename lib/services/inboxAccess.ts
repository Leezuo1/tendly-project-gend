import { createHash, timingSafeEqual } from 'node:crypto';

/** Temporary single-shop access until the application has account authentication. */
export function inboxAccessError(request: Request): Response | undefined {
  const key = process.env.INBOX_ACCESS_KEY;
  if (!key || key.length < 24) return Response.json({ error: 'Chưa cấu hình INBOX_ACCESS_KEY (ít nhất 24 ký tự).' }, { status: 503 });
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  const hash = (value: string) => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(hash(key), hash(supplied))) return Response.json({ error: 'Mã truy cập inbox không đúng.' }, { status: 401 });
}
