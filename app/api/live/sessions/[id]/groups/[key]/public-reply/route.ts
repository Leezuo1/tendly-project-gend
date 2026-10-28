import { liveErrorResponse, liveJson, parseGroupKey, parseSessionId } from '@/lib/services/live/api';
import { buildSnapshot } from '@/lib/services/live/engine';
import { replyPublicly } from '@/lib/services/live/reply';
import { InvalidMarketingRequest, marketingPageId, readMarketingJson } from '@/lib/services/marketingApi';
import { requireDashboardKey } from '@/lib/services/postsApi';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * "Trả lời bằng comment" { text, revision }: Trang trả lời công khai 1 lần dưới bình luận mới nhất của nhóm.
 * Cần quyền pages_manage_engagement — thiếu thì trả 403 NEED_PERMISSION.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; key: string }> }) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const pageId = marketingPageId();
    const { id, key } = await params;
    const sessionId = parseSessionId(id);
    const body = await readMarketingJson(request);
    if (typeof body.text !== 'string' || typeof body.revision !== 'number' || !Number.isInteger(body.revision)) {
      throw new InvalidMarketingRequest('Cần nội dung trả lời và revision của nhóm.');
    }
    const result = await replyPublicly(pageId, sessionId, parseGroupKey(key), body.text, body.revision);
    return liveJson({ ...result, snapshot: await buildSnapshot(pageId, sessionId) });
  } catch (error) {
    return liveErrorResponse(error);
  }
}
