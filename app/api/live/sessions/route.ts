import { parseAiKnowledge } from '@/lib/services/aiKnowledge';
import { liveErrorResponse, liveJson } from '@/lib/services/live/api';
import { createSession, listSessions } from '@/lib/services/live/engine';
import { facebookSourcePostId } from '@/lib/services/live/sources';
import { InvalidMarketingRequest, marketingPageId, readMarketingJson } from '@/lib/services/marketingApi';
import { requireDashboardKey } from '@/lib/services/postsApi';
import type { LiveSourceKind } from '@/lib/types/live';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    return liveJson({ sessions: await listSessions(marketingPageId()) });
  } catch (error) {
    return liveErrorResponse(error);
  }
}

/**
 * Bắt đầu phiên: { platform: 'facebook', sourceKind: 'auto'|'live_video'|'post', sourceId?, title, knowledge } (knowledge = Cấu hình AI).
 * sourceKind 'auto': tạo phiên trước, Tendly tự nhận video Live khi người bán bật stream trên Facebook.
 */
export async function POST(request: Request) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const pageId = marketingPageId();
    const body = await readMarketingJson(request);
    const platform = body.platform;
    if (platform !== 'facebook') throw new InvalidMarketingRequest('Nền tảng không hợp lệ.');
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 200)
      : 'Phiên live Facebook';
    let sourceKind: LiveSourceKind | null = null;
    let sourceId: string | null = null;
    let sourcePostId: string | null = null;
    const waitForLive = body.sourceKind === 'auto';
    if (!waitForLive) {
      if (body.sourceKind !== 'live_video' && body.sourceKind !== 'post') throw new InvalidMarketingRequest('Loại nguồn không hợp lệ.');
      if (typeof body.sourceId !== 'string' || !/^\d{1,64}(_\d{1,64})?$/.test(body.sourceId)) {
        throw new InvalidMarketingRequest('Nguồn bình luận không hợp lệ.');
      }
      if (body.sourceKind === 'post' && !body.sourceId.startsWith(`${pageId}_`)) {
        throw new InvalidMarketingRequest('Bài đăng không thuộc Fanpage.');
      }
      sourceKind = body.sourceKind;
      sourceId = body.sourceId;
      sourcePostId = await facebookSourcePostId(pageId, body.sourceKind, body.sourceId);
    }
    const knowledge = parseAiKnowledge(body.knowledge);
    const session = await createSession(pageId, { platform, sourceKind, sourceId, sourcePostId, title, waitForLive }, knowledge);
    return liveJson({ session }, 201);
  } catch (error) {
    return liveErrorResponse(error);
  }
}
