import { liveErrorResponse, liveJson, parseSessionId } from '@/lib/services/live/api';
import { buildSnapshot, setFlashPrice } from '@/lib/services/live/engine';
import { InvalidMarketingRequest, marketingPageId, readMarketingJson } from '@/lib/services/marketingApi';
import { requireDashboardKey } from '@/lib/services/postsApi';

export const runtime = 'nodejs';

/** Flash sale trong phiên { sku, price } — price = null để tắt. Áp dụng cho câu trả lời mẫu và đơn chốt sau khi bật. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const pageId = marketingPageId();
    const sessionId = parseSessionId((await params).id);
    const body = await readMarketingJson(request);
    if (typeof body.sku !== 'string' || body.sku.length > 200 || (body.price !== null && typeof body.price !== 'number')) {
      throw new InvalidMarketingRequest('Cần mã sản phẩm và giá flash sale (hoặc null để tắt).');
    }
    await setFlashPrice(pageId, sessionId, body.sku, body.price as number | null);
    return liveJson(await buildSnapshot(pageId, sessionId));
  } catch (error) {
    return liveErrorResponse(error);
  }
}
