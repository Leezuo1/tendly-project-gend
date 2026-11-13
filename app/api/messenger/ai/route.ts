import { AppSecurityError, sameOrigin, withAppAccess } from '@/lib/services/appSecurity';
import { inboxAccessError } from '@/lib/services/inboxAccess';
import { CustomerCareError } from '@/lib/services/customerCare';
import { messengerDebounceMs } from '@/lib/services/messengerDebounce';
import { processMessengerAi, readMessengerAiSettings, saveMessengerAiSettings, saveConversationAutoReply } from '@/lib/services/messengerAi';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function handle(request: Request) {
  const denied = inboxAccessError(request);
  if (denied) return denied;
  const pageId = process.env.PAGE_ID;
  if (!pageId || !/^\d{1,64}$/.test(pageId) || !process.env.DATABASE_URL) return Response.json({ error: 'Chưa cấu hình Messenger.' }, { status: 503 });
  try {
    if (request.method === 'GET') return Response.json(await readMessengerAiSettings(pageId), { headers: { 'Cache-Control': 'no-store' } });
    sameOrigin(request);
    const raw = await request.text();
    if (raw.length > 550_000) return Response.json({ error: 'Dữ liệu AI quá lớn.' }, { status: 413 });
    let body;
    try { body = JSON.parse(raw); } catch { return Response.json({ error: 'JSON không hợp lệ.' }, { status: 400 }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 400 });
    if (request.method === 'PUT') {
      if (typeof body.autoReply !== 'boolean') return Response.json({ error: 'Chế độ tự trả lời không hợp lệ.' }, { status: 400 });
      if (body.psid !== undefined) {
        if (typeof body.psid !== 'string' || !/^\d{1,64}$/.test(body.psid) || !Number.isSafeInteger(body.updatedAt) || body.updatedAt < 0) return Response.json({ error: 'Hội thoại hoặc phiên bản không hợp lệ.' }, { status: 400 });
        return Response.json(await saveConversationAutoReply(pageId, body.psid, body.autoReply, body.updatedAt));
      }
      if (body.updatedAt !== undefined && (!Number.isSafeInteger(body.updatedAt) || body.updatedAt < 0)) return Response.json({ error: 'Phiên bản cấu hình không hợp lệ.' }, { status: 400 });
      return Response.json(await saveMessengerAiSettings(pageId, body.autoReply, undefined, undefined, body.updatedAt));
    }
    if (typeof body.psid !== 'string' || !/^\d{1,64}$/.test(body.psid)) return Response.json({ error: 'Khách không hợp lệ.' }, { status: 400 });
    // The inbox calls this automatically for unanswered messages; it must wait like the webhook does.
    return Response.json(await processMessengerAi(pageId, body.psid, undefined, undefined, messengerDebounceMs()), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof CustomerCareError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof AppSecurityError) throw error;
    return Response.json({ error: 'Không xử lý được AI Messenger. Kiểm tra cấu hình và migration.' }, { status: 503 });
  }
}
export const GET = withAppAccess(handle);
export const PUT = withAppAccess(handle);
export const POST = withAppAccess(handle);
