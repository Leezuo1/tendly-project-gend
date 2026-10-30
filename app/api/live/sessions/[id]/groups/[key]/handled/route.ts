import { withAppAccess } from '@/lib/services/appSecurity';
import { liveErrorResponse, liveJson, parseGroupKey, parseSessionId } from '@/lib/services/live/api';
import { buildSnapshot, markGroupHandled } from '@/lib/services/live/engine';
import { marketingPageId } from '@/lib/services/marketingApi';
import { requireDashboardKey } from '@/lib/services/postsApi';

export const runtime = 'nodejs';

/** "Đã trả lời" / "Đã xử lý": shop đã trả lời trên live, không cần nhắn riêng các bình luận đang chờ của nhóm. */
export const POST = withAppAccess(async function POST(request: Request, { params }: { params: Promise<{ id: string; key: string }> }) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const pageId = marketingPageId();
    const { id, key } = await params;
    const sessionId = parseSessionId(id);
    await markGroupHandled(pageId, sessionId, parseGroupKey(key));
    return liveJson(await buildSnapshot(pageId, sessionId));
  } catch (error) {
    return liveErrorResponse(error);
  }
});
