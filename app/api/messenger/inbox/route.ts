import { withAppAccess } from '@/lib/services/appSecurity';
import { inboxAccessError } from '@/lib/services/inboxAccess';
import { readMessengerInbox, readOlderMessengerMessages } from '@/lib/services/messengerInboxDb';
import { refreshMessengerProfiles } from '@/lib/services/messengerProfiles';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import { readZaloInboxPageId } from '@/lib/services/zaloMessages';
import type { MessengerThread } from '@/lib/types/messengerInbox';

export const runtime = 'nodejs';
export const GET = withAppAccess(async function GET(request: Request) {
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
    const snapshot = await readMessengerInbox(pageId, limit);
    await refreshMessengerProfiles(snapshot);
    // Zalo là kênh phụ: lỗi ở đây không được làm mất hộp thư Messenger.
    try {
      const zaloPage = await readZaloInboxPageId(getMessengerPool());
      if (zaloPage) {
        const zalo = await readMessengerInbox(zaloPage, limit);
        const last = (t: MessengerThread) => t.messages.at(-1)?.timestamp ?? 0;
        const all = [...snapshot.conversations, ...zalo.conversations].sort((x, y) =>
          Number(y.waitingConfirmation === true) - Number(x.waitingConfirmation === true) || last(y) - last(x));
        snapshot.conversations = all.slice(0, limit);
        snapshot.hasMore ||= zalo.hasMore || all.length > limit;
      }
    } catch { /* giữ nguyên snapshot Messenger */ }
    return Response.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Không đọc được hội thoại. Kiểm tra database và chạy npm run db:migrate.' }, { status: 503 });
  }
});
