import { withAppAccess } from '@/lib/services/appSecurity';
import { startSourcingRequest } from '@/lib/services/sourcingApi';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const POST = withAppAccess(request => startSourcingRequest(request, 'tiktok'));
