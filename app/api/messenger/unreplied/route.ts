import { inboxAccessError } from '@/lib/services/inboxAccess';
import { readUnrepliedCount } from '@/lib/services/messengerCount';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const denied = inboxAccessError(request);
  if (denied) return denied;
  if (!process.env.PAGE_ID || !process.env.DATABASE_URL) {
    return Response.json({ error: 'Chưa cấu hình kết nối Messenger.' }, { status: 503 });
  }
  try {
    return Response.json({ count: await readUnrepliedCount(process.env.PAGE_ID) }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json({ error: 'Không tải được số hội thoại chưa trả lời.' }, { status: 503 });
  }
}
