import { inboxAccessError } from '@/lib/services/inboxAccess';
import { shopeeConfig, shopeeErrorResponse } from '@/lib/services/shopee';
import { syncShopee } from '@/lib/services/shopeeStorage';

export const runtime = 'nodejs';
export const maxDuration = 150;
export async function POST(request: Request) {
  const denied = inboxAccessError(request);
  if (denied) return denied;
  try {
    return Response.json(await syncShopee(shopeeConfig()), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return shopeeErrorResponse(error); }
}
