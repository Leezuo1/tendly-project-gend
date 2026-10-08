import { InvalidWebhook, parseMetaMessages, verifyMetaSignature } from '@/lib/services/metaWebhook';
import { requireMessengerDatabase, persistMessengerMessages } from '@/lib/services/messengerStorage';

export const runtime = 'nodejs';
export const maxDuration = 60;
const MAX_BODY_BYTES = 1024 * 1024;

export async function GET(request: Request) {
  const token = process.env.VERIFY_TOKEN;
  if (!token) return Response.json({ error: 'Webhook chưa được cấu hình.' }, { status: 503 });
  const params = new URL(request.url).searchParams;
  const challenge = params.get('hub.challenge');
  if (params.get('hub.mode') !== 'subscribe' || params.get('hub.verify_token') !== token || !challenge) {
    return new Response('Forbidden', { status: 403 });
  }
  return new Response(challenge, { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const secret = process.env.APP_SECRET;
  const pageId = process.env.PAGE_ID;
  if (!secret || !pageId || !/^\d{1,64}$/.test(pageId)) {
    return Response.json({ error: 'Webhook chưa được cấu hình.' }, { status: 503 });
  }
  try { requireMessengerDatabase(); }
  catch { return Response.json({ error: 'Chưa cấu hình DATABASE_URL cho Messenger.' }, { status: 503 }); }
  const reader = request.body?.getReader();
  if (!reader) return new Response('Invalid payload', { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return new Response('Payload too large', { status: 413 });
      }
      chunks.push(value);
    }
  } catch { return new Response('Invalid payload', { status: 400 }); }
  finally { reader.releaseLock(); }
  const raw = Buffer.concat(chunks);
  if (!verifyMetaSignature(raw, request.headers.get('x-hub-signature-256'), secret)) {
    return new Response('Forbidden', { status: 403 });
  }
  let messages;
  try { messages = parseMetaMessages(JSON.parse(raw.toString('utf8')), pageId); }
  catch (error) {
    if (error instanceof SyntaxError || error instanceof InvalidWebhook) return new Response('Invalid payload', { status: 400 });
    throw error;
  }
  try {
    if (messages.length) {
      await persistMessengerMessages(messages);
    }
    return new Response('EVENT_RECEIVED', { headers: { 'Content-Type': 'text/plain' } });
  } catch {
    // No token, message text or raw payload in logs/responses. Non-200 lets Meta retry.
    return Response.json({ error: 'Không lưu được tin nhắn. Vui lòng thử lại.' }, { status: 503 });
  }
}
