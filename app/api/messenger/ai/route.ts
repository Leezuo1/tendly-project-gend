import { inboxAccessError } from '@/lib/services/inboxAccess';
import { InvalidAiKnowledge, parseAiKnowledge } from '@/lib/services/aiKnowledge';
import { processMessengerAi, readMessengerAiSettings, saveMessengerAiSettings } from '@/lib/services/messengerAi';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function handle(request: Request) {
  const denied = inboxAccessError(request);
  if (denied) return denied;
  const pageId = process.env.PAGE_ID;
  if (!pageId || !/^\d{1,64}$/.test(pageId) || !process.env.DATABASE_URL) return Response.json({ error: 'Chưa cấu hình Messenger.' }, { status: 503 });
  try {
    if (request.method === 'GET') return Response.json(await readMessengerAiSettings(pageId), { headers: { 'Cache-Control': 'no-store' } });
    const raw = await request.text();
    if (raw.length > 550_000) return Response.json({ error: 'Dữ liệu AI quá lớn.' }, { status: 413 });
    let body;
    try { body = JSON.parse(raw); } catch { return Response.json({ error: 'JSON không hợp lệ.' }, { status: 400 }); }
    if (!body || typeof body !== 'object') return Response.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 400 });
    if (request.method === 'PUT') {
      if (typeof body.autoReply !== 'boolean') return Response.json({ error: 'Chế độ tự trả lời không hợp lệ.' }, { status: 400 });
      const knowledge = body.autoReply ? parseAiKnowledge(body.knowledge) : undefined;
      return Response.json(await saveMessengerAiSettings(pageId, body.autoReply, knowledge));
    }
    if (typeof body.psid !== 'string' || !/^\d{1,64}$/.test(body.psid)) return Response.json({ error: 'Khách không hợp lệ.' }, { status: 400 });
    return Response.json(await processMessengerAi(pageId, body.psid, parseAiKnowledge(body.knowledge)), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof InvalidAiKnowledge ? error.message : 'Không xử lý được AI Messenger. Kiểm tra cấu hình và migration.' },
      { status: error instanceof InvalidAiKnowledge ? 400 : 503 });
  }
}
export const GET = handle;
export const PUT = handle;
export const POST = handle;
