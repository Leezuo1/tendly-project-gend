import { withAppAccess } from '@/lib/services/appSecurity';
import { inboxAccessError } from '@/lib/services/inboxAccess';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import { queueZaloText, waitZaloResult, ZaloSendError } from '@/lib/services/zaloOutbox';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Xếp tin vào hàng đợi cho worker Zalo rồi chờ kết quả tối đa ~12 giây. Tin hiện trong hội thoại khi Zalo phát lại tin của chính shop. */
export const POST = withAppAccess(async function POST(request: Request) {
  const denied = inboxAccessError(request);
  if (denied) return denied;
  if (!process.env.DATABASE_URL) return Response.json({ error: 'Chưa cấu hình DATABASE_URL.' }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: 'Thông tin gửi không hợp lệ.' }, { status: 400 }); }
  try {
    const db = getMessengerPool();
    const id = await queueZaloText({ psid: body?.psid, text: body?.text, requestId: body?.requestId }, db);
    const result = await waitZaloResult(id, db);
    if (result.status === 'failed') return Response.json({ error: result.error || 'Zalo không gửi được tin.' }, { status: 502 });
    return Response.json({ status: result.status === 'sent' ? 'sent' : 'pending' }, { status: result.status === 'sent' ? 200 : 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ZaloSendError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Không xử lý được yêu cầu gửi Zalo. Kiểm tra database và chạy npm run db:migrate.' }, { status: 503 });
  }
});
