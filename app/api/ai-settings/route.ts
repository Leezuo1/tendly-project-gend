import { withAppAccess } from '@/lib/services/appSecurity';
import { readMarketingJson, marketingErrorResponse } from '@/lib/services/marketingApi';
import { readPageProfile, requirePageOwner, savePageProfile } from '@/lib/services/aiGlobalSettings';

export const runtime = 'nodejs';
export const GET = withAppAccess(async (request: Request) => {
  try {
    const owner = await requirePageOwner(request, new URL(request.url).searchParams.get('pageId'));
    return Response.json(await readPageProfile(owner.pageId));
  } catch (error) { return marketingErrorResponse(error); }
});
export const PUT = withAppAccess(async (request: Request) => {
  try {
    const body = await readMarketingJson(request);
    return Response.json(await savePageProfile(await requirePageOwner(request, body.pageId), body));
  } catch (error) { return marketingErrorResponse(error); }
});
