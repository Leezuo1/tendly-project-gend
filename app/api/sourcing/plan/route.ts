import { readSecurityJson, withAppAccess } from '@/lib/services/appSecurity';
import { prepareSourcingSearch, SourcingInputError } from '@/lib/services/sourcingSearch';

export const runtime = 'nodejs';

export const POST = withAppAccess(async function POST(request: Request) {
  const input = await readSecurityJson(request);
  try {
    return Response.json(prepareSourcingSearch(input));
  } catch (error) {
    if (error instanceof SourcingInputError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
});
