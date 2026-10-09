import { createInboxSession, INBOX_SESSION_COOKIE } from '@/lib/services/inboxAccess';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return Response.json({ error: 'Nguồn truy cập không hợp lệ.' }, { status: 403 });
  const key = process.env.INBOX_ACCESS_KEY;
  if (!key || key.length < 24 || !process.env.PAGE_ID || !process.env.DATABASE_URL) {
    return Response.json({ error: 'Chưa cấu hình INBOX_ACCESS_KEY, PAGE_ID và DATABASE_URL trên server.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store',
        'Set-Cookie': `${INBOX_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` },
    });
  }
  return Response.json({ ready: true }, { headers: {
    'Cache-Control': 'no-store',
    'Set-Cookie': `${INBOX_SESSION_COOKIE}=${createInboxSession(key)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600${url.protocol === 'https:' ? '; Secure' : ''}`,
  } });
}
