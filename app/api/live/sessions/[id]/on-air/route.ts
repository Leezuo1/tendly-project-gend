import { withAppAccess } from '@/lib/services/appSecurity';
import { liveErrorResponse, liveJson, parseSessionId } from '@/lib/services/live/api';
import { buildSnapshot, setOnAir } from '@/lib/services/live/engine';
import { InvalidMarketingRequest, marketingPageId, readMarketingJson } from '@/lib/services/marketingApi';
import { requireDashboardKey } from '@/lib/services/postsApi';

export const runtime = 'nodejs';

/** Mẫu đang lên sóng { sku } (hoặc { sku: null }). Bình luận ngắn ("1", "chốt M trắng") được gán cho mẫu này. */
export const POST = withAppAccess(async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const pageId = marketingPageId();
    const id = parseSessionId((await params).id);
    const body = await readMarketingJson(request);
    if (body.sku !== null && (typeof body.sku !== 'string' || body.sku.length > 200)) {
      throw new InvalidMarketingRequest('Sản phẩm không hợp lệ.');
    }
    await setOnAir(pageId, id, body.sku);
    return liveJson(await buildSnapshot(pageId, id));
  } catch (error) {
    return liveErrorResponse(error);
  }
});
