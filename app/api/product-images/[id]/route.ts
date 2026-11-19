import { withAppAccess } from '@/lib/services/appSecurity';
import { deleteProductImage, productImageErrorResponse, readProductImage } from '@/lib/services/productImages';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

function pageIdOrError() {
  const pageId = process.env.PAGE_ID?.trim();
  return pageId && /^\d{1,64}$/.test(pageId) && process.env.DATABASE_URL ? { pageId } : Response.json({ error: 'Chưa cấu hình Fanpage hoặc database.' }, { status: 503 });
}

/** Hình thu nhỏ trong form sản phẩm và hộp thoại; chỉ người đã đăng nhập xem được. */
export const GET = withAppAccess(async function GET(_request: Request, { params }: Context) {
  const found = pageIdOrError();
  if (found instanceof Response) return found;
  try {
    const image = await readProductImage(found.pageId, (await params).id);
    if (!image) return Response.json({ error: 'Ảnh không còn tồn tại.' }, { status: 404 });
    return new Response(new Uint8Array(image.data), { headers: { 'Content-Type': image.mime, 'Cache-Control': 'private, max-age=3600' } });
  } catch (error) { return productImageErrorResponse(error); }
});

export const DELETE = withAppAccess(async function DELETE(_request: Request, { params }: Context) {
  const found = pageIdOrError();
  if (found instanceof Response) return found;
  try {
    return await deleteProductImage(found.pageId, (await params).id)
      ? Response.json({ ok: true })
      : Response.json({ error: 'Ảnh không còn tồn tại.' }, { status: 404 });
  } catch (error) { return productImageErrorResponse(error); }
});
