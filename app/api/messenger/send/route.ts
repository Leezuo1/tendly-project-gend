import { withAppAccess } from '@/lib/services/appSecurity';
import { inboxAccessError } from '@/lib/services/inboxAccess';
import { MessengerSendError, sendMessengerMessage } from '@/lib/services/messengerSend';
import { parseSendRequest } from '@/lib/services/messengerSendRequest';
import { readProductImage } from '@/lib/services/productImages';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const POST = withAppAccess(async function POST(request: Request) {
  const denied = inboxAccessError(request);
  if (denied) return denied;
  if (!process.env.DATABASE_URL) return Response.json({ error: 'Chưa cấu hình DATABASE_URL.' }, { status: 503 });
  try {
    const parsed = await parseSendRequest(request);
    let input;
    if (parsed.kind === 'text') input = { psid: parsed.psid, text: parsed.text, requestId: parsed.requestId };
    else if (parsed.kind === 'file') input = { psid: parsed.psid, text: '', requestId: parsed.requestId, image: { data: parsed.data, mime: parsed.mime, label: 'upload' } };
    else {
      const stored = await readProductImage(process.env.PAGE_ID ?? '', parsed.imageId);
      if (!stored) return Response.json({ error: 'Ảnh không còn tồn tại.' }, { status: 404 });
      input = { psid: parsed.psid, text: '', requestId: parsed.requestId, image: { data: stored.data, mime: stored.mime, label: parsed.imageId } };
    }
    return Response.json(await sendMessengerMessage(input), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof MessengerSendError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Không xử lý được yêu cầu gửi. Kiểm tra Messenger trước khi thử lại.' }, { status: 503 });
  }
});
