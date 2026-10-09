import { parseAiKnowledge } from '@/lib/services/aiKnowledge';
import { marketingErrorResponse, marketingPageId, readMarketingJson } from '@/lib/services/marketingApi';
import { productMatchers, readMarketingCustomers } from '@/lib/services/marketingInsights';
import { requireDashboardKey } from '@/lib/services/postsApi';

export const runtime = 'nodejs';

/**
 * Khách Messenger thật kèm nhóm hoạt động. POST vì cần danh sách sản phẩm trong Cấu hình AI
 * (đang lưu trên trình duyệt) để dò khách đã hỏi sản phẩm nào.
 */
export async function POST(request: Request) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const pageId = marketingPageId();
    const knowledge = parseAiKnowledge((await readMarketingJson(request)).knowledge);
    const now = Date.now();
    const customers = await readMarketingCustomers(pageId, productMatchers(knowledge.products, knowledge.shop.name), now);
    return Response.json({ customers, now }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return marketingErrorResponse(error);
  }
}
