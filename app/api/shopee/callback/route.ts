import { withAppAccess } from '@/lib/services/appSecurity';
import { timingSafeEqual } from 'node:crypto';
import { shopeeConfig, shopeeErrorResponse, shopeeRedirect } from '@/lib/services/shopee';
import { authorizeShopee } from '@/lib/services/shopeeStorage';

export const runtime = 'nodejs';
export const GET = withAppAccess(async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') || '';
  const cookie = request.headers.get('cookie')?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith('tendly_shopee_state='))?.slice('tendly_shopee_state='.length) || '';
  const headers = new Headers({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    'Set-Cookie': `tendly_shopee_state=; Path=/api/shopee/callback; HttpOnly; SameSite=Lax; Max-Age=0${url.protocol === 'https:' ? '; Secure' : ''}` });
  if (!/^[a-f0-9]{64}$/.test(state) || !/^[a-f0-9]{64}$/.test(cookie) || !timingSafeEqual(Buffer.from(state), Buffer.from(cookie))) {
    return Response.json({ error: 'Phiên kết nối Shopee không hợp lệ hoặc đã hết hạn. Hãy bấm Kết nối Shopee lại trong Tendly.' }, { status: 400, headers });
  }
  try {
    const config = shopeeConfig();
    const redirect = shopeeRedirect();
    const code = url.searchParams.get('code') || '';
    if (url.origin !== redirect.origin || url.searchParams.get('shop_id') !== config.shopId || !code || code.length > 2048 || url.searchParams.has('error')) {
      return Response.json({ error: 'Cấp quyền chưa thành công. Hãy đăng nhập tài khoản shop đúng SHOPEE_SHOP_ID, không dùng tài khoản chính nhiều shop.' }, { status: 400, headers });
    }
    await authorizeShopee(config, code);
    headers.set('Location', new URL('/cau-hinh-ai?tab=products&shopee=connected', redirect.origin).href);
    return new Response(null, { status: 303, headers });
  } catch (error) {
    const response = shopeeErrorResponse(error);
    headers.forEach((value, key) => response.headers.set(key, value));
    return response;
  }
});
