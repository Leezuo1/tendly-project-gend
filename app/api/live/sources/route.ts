import { liveErrorResponse, liveJson } from '@/lib/services/live/api';
import { listFacebookSources, UPCOMING_PLATFORMS } from '@/lib/services/live/sources';
import { marketingPageId } from '@/lib/services/marketingApi';
import { requireDashboardKey } from '@/lib/services/postsApi';

export const runtime = 'nodejs';

/** Video Live và bài đăng gần đây để chọn làm nguồn bình luận (Facebook), kèm nền tảng sắp hỗ trợ. */
export async function GET(request: Request) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const sources = await listFacebookSources(marketingPageId(), AbortSignal.timeout(15_000));
    return liveJson({ sources, upcoming: UPCOMING_PLATFORMS });
  } catch (error) {
    return liveErrorResponse(error);
  }
}
