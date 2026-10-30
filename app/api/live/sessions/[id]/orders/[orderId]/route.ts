import { withAppAccess } from '@/lib/services/appSecurity';
import { liveErrorResponse, liveJson, parseSessionId } from '@/lib/services/live/api';
import { buildSnapshot, updateOrderStatus } from '@/lib/services/live/engine';
import { InvalidMarketingRequest, marketingPageId, readMarketingJson } from '@/lib/services/marketingApi';
import { requireDashboardKey } from '@/lib/services/postsApi';
import type { LiveOrderStatus } from '@/lib/types/live';

export const runtime = 'nodejs';

const STATUSES: LiveOrderStatus[] = ['draft', 'awaiting_info', 'confirmed', 'cancelled'];

/** Đổi trạng thái đơn nháp { status }. Huỷ đơn thì trả lại hàng đang giữ. */
export const PATCH = withAppAccess(async function PATCH(request: Request, { params }: { params: Promise<{ id: string; orderId: string }> }) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const pageId = marketingPageId();
    const { id, orderId } = await params;
    const sessionId = parseSessionId(id);
    const body = await readMarketingJson(request);
    if (!STATUSES.includes(body.status as LiveOrderStatus) || !/^[0-9a-f-]{36}$/i.test(orderId)) {
      throw new InvalidMarketingRequest('Trạng thái đơn không hợp lệ.');
    }
    await updateOrderStatus(pageId, sessionId, orderId, body.status as LiveOrderStatus);
    return liveJson(await buildSnapshot(pageId, sessionId));
  } catch (error) {
    return liveErrorResponse(error);
  }
});
