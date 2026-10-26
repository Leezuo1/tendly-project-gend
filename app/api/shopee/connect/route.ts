import { randomBytes } from 'node:crypto';
import { inboxAccessError } from '@/lib/services/inboxAccess';
import { shopeeAuthUrl, shopeeConfig, shopeeErrorResponse, shopeeRedirect } from '@/lib/services/shopee';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  const denied = inboxAccessError(request);
  if (denied) return denied;
  try {
    const config = shopeeConfig();
    const redirect = shopeeRedirect();
    if (new URL(request.url).origin !== redirect.origin) {
      return Response.json({ error: 'Mở Tendly bằng đúng domain SHOPEE_REDIRECT_URL trước khi kết nối.' }, { status: 400 });
    }
    const state = randomBytes(32).toString('hex');
    return Response.json({ url: shopeeAuthUrl(config, state) }, { headers: {
      'Cache-Control': 'no-store',
      'Set-Cookie': `tendly_shopee_state=${state}; Path=/api/shopee/callback; HttpOnly; SameSite=Lax; Max-Age=600${redirect.protocol === 'https:' ? '; Secure' : ''}`,
    } });
  } catch (error) { return shopeeErrorResponse(error); }
}
