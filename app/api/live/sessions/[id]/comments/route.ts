import { liveErrorResponse, liveJson, parseSessionId } from '@/lib/services/live/api';
import { addDemoComment, buildSnapshot } from '@/lib/services/live/engine';
import { InvalidMarketingRequest, marketingPageId, readMarketingJson } from '@/lib/services/marketingApi';
import { requireDashboardKey } from '@/lib/services/postsApi';

export const runtime = 'nodejs';

/** Chỉ phiên demo: thêm bình luận gõ tay { authorName, text } để người thuyết trình gõ trực tiếp khi pitch. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const pageId = marketingPageId();
    const id = parseSessionId((await params).id);
    const body = await readMarketingJson(request);
    if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 2000) {
      throw new InvalidMarketingRequest('Bình luận phải từ 1 đến 2.000 ký tự.');
    }
    await addDemoComment(pageId, id, typeof body.authorName === 'string' ? body.authorName : '', body.text.trim());
    return liveJson(await buildSnapshot(pageId, id), 201);
  } catch (error) {
    return liveErrorResponse(error);
  }
}
