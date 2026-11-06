import { withAppAccess } from '@/lib/services/appSecurity';
import { liveErrorResponse, liveJson, parseSessionId } from '@/lib/services/live/api';
import { buildSnapshot, saveLiveDraft } from '@/lib/services/live/engine';
import { marketingPageId, readMarketingJson } from '@/lib/services/marketingApi';
import { parseAiKnowledge } from '@/lib/services/aiKnowledge';
import { requireDashboardKey } from '@/lib/services/postsApi';

export const runtime = 'nodejs';

/** Snapshot của phiên, không kéo bình luận mới — dùng cho phiên đã kết thúc hoặc lần tải đầu. */
export const GET = withAppAccess(async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    return liveJson(await buildSnapshot(marketingPageId(), parseSessionId((await params).id)));
  } catch (error) {
    return liveErrorResponse(error);
  }
});

export const PATCH = withAppAccess(async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const id = parseSessionId((await params).id), pageId = marketingPageId(), body = await readMarketingJson(request);
    await saveLiveDraft(pageId, id, body.revision, body.title, parseAiKnowledge(body.knowledge), body.preparation);
    return liveJson(await buildSnapshot(pageId, id));
  } catch (error) { return liveErrorResponse(error); }
});
