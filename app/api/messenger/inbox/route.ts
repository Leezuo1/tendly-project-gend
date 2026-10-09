import { inboxAccessError } from '@/lib/services/inboxAccess';
import { readMessengerInbox, readOlderMessengerMessages } from '@/lib/services/messengerInboxDb';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const denied = inboxAccessError(request);
  if (denied) return denied;
  const pageId = process.env.PAGE_ID;
  if (!pageId || !process.env.DATABASE_URL) return Response.json({ error: 'Cần cấu hình PAGE_ID và DATABASE_URL.' }, { status: 503 });
  const params = new URL(request.url).searchParams;
  const psid = params.get('psid');
  try {
    if (psid) {
      const before = Number(params.get('before'));
      const mid = params.get('messageId');
      if (!/^\d{1,64}$/.test(psid) || !Number.isSafeInteger(before) || before < 0 || !mid || mid.length > 1024) {
        return Response.json({ error: 'Thông tin phân trang không hợp lệ.' }, { status: 400 });
      }
      return Response.json(await readOlderMessengerMessages(pageId, psid, before, mid), { headers: { 'Cache-Control': 'no-store' } });
    }
    const limit = Number(params.get('limit') || 100);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) return Response.json({ error: 'Giới hạn hội thoại không hợp lệ.' }, { status: 400 });
    return Response.json(await readMessengerInbox(pageId, limit), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Không đọc được hội thoại. Kiểm tra database và chạy npm run db:migrate.' }, { status: 503 });
  }
}
