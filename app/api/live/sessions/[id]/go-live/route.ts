import { liveErrorResponse, liveJson, parseSessionId } from '@/lib/services/live/api';
import { buildSnapshot, goLive } from '@/lib/services/live/engine';
import { marketingPageId } from '@/lib/services/marketingApi';
import { requireDashboardKey } from '@/lib/services/postsApi';

export const runtime = 'nodejs';

/** Chỉ phiên demo đang chờ: "Giả lập bật live" — kịch bản bình luận bắt đầu chạy từ lúc này. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const pageId = marketingPageId();
    const id = parseSessionId((await params).id);
    await goLive(pageId, id);
    return liveJson(await buildSnapshot(pageId, id));
  } catch (error) {
    return liveErrorResponse(error);
  }
}
