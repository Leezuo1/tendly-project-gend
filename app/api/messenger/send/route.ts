import { inboxAccessError } from '@/lib/services/inboxAccess';
import { MessengerSendError, sendMessengerMessage } from '@/lib/services/messengerSend';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const denied = inboxAccessError(request);
  if (denied) return denied;
  if (!process.env.DATABASE_URL) return Response.json({ error: 'Chưa cấu hình DATABASE_URL.' }, { status: 503 });
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 16000) return Response.json({ error: 'Yêu cầu quá dài.' }, { status: 413 });
    body = JSON.parse(raw);
  } catch { return Response.json({ error: 'JSON không hợp lệ.' }, { status: 400 }); }
  if (!body || typeof body.psid !== 'string' || !/^\d{1,64}$/.test(body.psid) ||
    typeof body.text !== 'string' || !body.text.trim() || Array.from(body.text).length > 2000 ||
    typeof body.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.requestId)) {
    return Response.json({ error: 'Cần khách hợp lệ, nội dung 1–2.000 ký tự và request ID.' }, { status: 400 });
  }
  try {
    return Response.json(await sendMessengerMessage({ psid: body.psid, text: body.text.trim(), requestId: body.requestId }),
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof MessengerSendError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Không xử lý được yêu cầu gửi. Kiểm tra Messenger trước khi thử lại.' }, { status: 503 });
  }
}
