import { AppSecurityError, requireAppAccess, sameOrigin, withAppAccess } from '@/lib/services/appSecurity';
import { readShopCatalog, saveShopCatalog, ShopCatalogError } from '@/lib/services/shopCatalog';

export const runtime = 'nodejs';

async function handle(request: Request) {
  const pageId = process.env.PAGE_ID?.trim();
  if (!pageId || !/^\d{1,64}$/.test(pageId)) return Response.json({ error: 'Chưa cấu hình Fanpage.' }, { status: 503 });
  try {
    if (request.method === 'GET') {
      const row = await readShopCatalog(pageId);
      return Response.json({ catalog: row?.catalog ?? null, revision: row?.revision ?? 0 }, { headers: { 'Cache-Control': 'no-store' } });
    }
    sameOrigin(request);
    await requireAppAccess(request);
    const raw = await request.text();
    if (raw.length > 1_500_000) return Response.json({ error: 'Danh mục quá lớn.' }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new ShopCatalogError('JSON không hợp lệ.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ShopCatalogError('Yêu cầu không hợp lệ.');
    const { catalog, revision } = body as { catalog?: unknown; revision?: unknown };
    return Response.json(await saveShopCatalog(pageId, catalog, revision), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ShopCatalogError) return Response.json({ error: error.message }, { status: error.status });
    // Authorization errors are handled by withAppAccess, including a session revoked during the request.
    if (error instanceof AppSecurityError) throw error;
    return Response.json({ error: 'Chưa lưu được danh mục. Kiểm tra kết nối và chạy npm run db:migrate rồi thử lại.' }, { status: 503 });
  }
}
export const GET = withAppAccess(handle);
export const PUT = withAppAccess(handle);
