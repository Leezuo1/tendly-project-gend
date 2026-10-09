import { inboxAccessError } from '@/lib/services/inboxAccess';
import { hideConversation, pendingHistoricalAnalysis, saveConversationMemory } from '@/lib/services/conversationMemory';
import { parseAiAnalysis } from '@/lib/services/aiAnalysis';

export const runtime = 'nodejs';
async function handle(request: Request) {
  const denied = inboxAccessError(request);
  if (denied) return denied;
  const pageId = process.env.PAGE_ID;
  if (!pageId || !process.env.DATABASE_URL) return Response.json({ error: 'Chưa cấu hình Messenger.' }, { status: 503 });
  try {
    const body = request.method === 'GET' ? Object.fromEntries(new URL(request.url).searchParams) : await request.json();
    if (typeof body.psid !== 'string' || !/^\d{1,64}$/.test(body.psid)) return Response.json({ error: 'Khách hàng không hợp lệ.' }, { status: 400 });
    if (request.method === 'DELETE') {
      const result = await hideConversation(pageId, body.psid);
      return Response.json({ deleted: (result.rowCount ?? 0) > 0, hiddenAt: result.rows[0] ? Number(result.rows[0].hidden_at) : null });
    }
    if (request.method === 'GET') return Response.json({ jobs: await pendingHistoricalAnalysis(pageId, body.psid) }, { headers: { 'Cache-Control': 'no-store' } });
    if (typeof body.messageId !== 'string' || !body.messageId || body.messageId.length > 1024
      || typeof body.reply !== 'string' || !body.reply.trim() || body.reply.length > 8000
      || typeof body.model !== 'string' || body.model.length > 200
      || typeof body.sourceSummary !== 'string' || body.sourceSummary.length > 2000) return Response.json({ error: 'Phân tích không hợp lệ.' }, { status: 400 });
    let analysis;
    try { analysis = parseAiAnalysis(body.analysis); } catch { return Response.json({ error: 'Nhãn cảm xúc không hợp lệ.' }, { status: 400 }); }
    const saved = await saveConversationMemory(pageId, body.psid, body.messageId, { ...body, analysis });
    return Response.json({ saved }, { status: saved ? 200 : 404 });
  } catch { return Response.json({ error: 'Không xử lý được hội thoại. Kiểm tra database và chạy migration.' }, { status: 503 }); }
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
