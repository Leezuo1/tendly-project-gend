import { requireAppAccess, withAppAccess } from '@/lib/services/appSecurity';
import { liveErrorResponse, liveJson, parseSessionId } from '@/lib/services/live/api';
import { approveLivePreparation, buildSnapshot } from '@/lib/services/live/engine';
import { marketingPageId, readMarketingJson } from '@/lib/services/marketingApi';
import { requireDashboardKey } from '@/lib/services/postsApi';
export const runtime = 'nodejs';
export const POST = withAppAccess(async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const session = await requireAppAccess(request);
    const id = parseSessionId((await params).id), pageId = marketingPageId(), body = await readMarketingJson(request);
    await approveLivePreparation(pageId, id, body.revision, body.confirmed, session.username);
    return liveJson(await buildSnapshot(pageId, id));
  } catch (error) { return liveErrorResponse(error); }
});
