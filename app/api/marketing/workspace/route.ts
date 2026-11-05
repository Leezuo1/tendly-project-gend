import { requireAppAccess, sameOrigin, withAppAccess } from '@/lib/services/appSecurity';
import { marketingErrorResponse, marketingPageId, readMarketingJson } from '@/lib/services/marketingApi';
import { MarketingWorkflowError } from '@/lib/services/marketingBrief';
import { marketingWorkspaceAction, marketingWorkspaceView } from '@/lib/services/marketingWorkspace';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const GET = withAppAccess(async function GET() {
  try { return Response.json(await marketingWorkspaceView(marketingPageId())); }
  catch (error) { return marketingErrorResponse(error); }
});
export const POST = withAppAccess(async function POST(request: Request) {
  try {
    sameOrigin(request);
    const session = await requireAppAccess(request);
    const body = await readMarketingJson(request);
    if (!Number.isSafeInteger(body.revision) || Number(body.revision) < 0 || typeof body.action !== 'string' || !body.input || typeof body.input !== 'object' || Array.isArray(body.input)) throw new MarketingWorkflowError('Yêu cầu không hợp lệ.');
    const pageId = marketingPageId();
    await marketingWorkspaceAction(pageId, session.username, Number(body.revision), body.action, body.input as Record<string, unknown>);
    return Response.json(await marketingWorkspaceView(pageId));
  } catch (error) {
    if (error instanceof MarketingWorkflowError) return Response.json({ error: error.message }, { status: error.status });
    return marketingErrorResponse(error);
  }
});
