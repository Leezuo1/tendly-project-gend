import { withAppAccess } from '@/lib/services/appSecurity';
import { getSourcingRequest } from '@/lib/services/sourcingApi';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const GET = withAppAccess(async (request: Request, context: { params: Promise<{ id: string }> }) =>
  getSourcingRequest(request, (await context.params).id));
