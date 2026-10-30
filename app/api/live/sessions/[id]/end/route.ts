import { withAppAccess } from '@/lib/services/appSecurity';
import { liveErrorResponse, liveJson, parseSessionId } from '@/lib/services/live/api';
import { endSession } from '@/lib/services/live/engine';
import { marketingPageId } from '@/lib/services/marketingApi';
import { requireDashboardKey } from '@/lib/services/postsApi';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Kết thúc phiên → tóm tắt cuối phiên + gợi ý nhập hàng (1 lần gọi AI). Gọi lại để tính lại tóm tắt. */
export const POST = withAppAccess(async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    return liveJson(await endSession(marketingPageId(), parseSessionId((await params).id)));
  } catch (error) {
    return liveErrorResponse(error);
  }
});
