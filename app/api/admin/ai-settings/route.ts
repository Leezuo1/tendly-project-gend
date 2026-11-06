import { withAppAccess } from '@/lib/services/appSecurity';
import { readMarketingJson, marketingErrorResponse } from '@/lib/services/marketingApi';
import { readAiGlobalSettings, requireAiAdministrator, saveAiGlobalSettings } from '@/lib/services/aiGlobalSettings';

export const runtime = 'nodejs';
export const GET = withAppAccess(async (request: Request) => {
  try { await requireAiAdministrator(request); return Response.json(await readAiGlobalSettings()); }
  catch (error) { return marketingErrorResponse(error); }
});
export const PUT = withAppAccess(async (request: Request) => {
  try {
    const session = await requireAiAdministrator(request);
    return Response.json(await saveAiGlobalSettings(await readMarketingJson(request), session.username));
  } catch (error) { return marketingErrorResponse(error); }
});
