import { inboxAccessError } from '@/lib/services/inboxAccess';
import { shopeeConfig, shopeeErrorResponse } from '@/lib/services/shopee';
import { readShopee } from '@/lib/services/shopeeStorage';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const denied = inboxAccessError(request);
  if (denied) return denied;
  try {
    const snapshot = await readShopee(shopeeConfig());
    return Response.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return shopeeErrorResponse(error); }
}
