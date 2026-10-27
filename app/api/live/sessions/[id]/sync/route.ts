import { liveErrorResponse, liveJson, parseSessionId } from '@/lib/services/live/api';
import { syncSession } from '@/lib/services/live/engine';
import { marketingPageId } from '@/lib/services/marketingApi';
import { requireDashboardKey } from '@/lib/services/postsApi';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Kéo bình luận mới → phân loại → gom nhóm/đơn → trả snapshot. Dashboard gọi khoảng 3 giây/lần khi đang live. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    return liveJson(await syncSession(marketingPageId(), parseSessionId((await params).id)));
  } catch (error) {
    return liveErrorResponse(error);
  }
}
