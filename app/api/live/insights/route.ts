import { liveErrorResponse, liveJson } from '@/lib/services/live/api';
import { readInsights } from '@/lib/services/live/engine';
import { marketingPageId } from '@/lib/services/marketingApi';
import { requireDashboardKey } from '@/lib/services/postsApi';

export const runtime = 'nodejs';

/** Tổng hợp các phiên live theo tháng — cho dashboard tổng quan. */
export async function GET(request: Request) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    return liveJson(await readInsights(marketingPageId()));
  } catch (error) {
    return liveErrorResponse(error);
  }
}
