import { withAppAccess } from '@/lib/services/appSecurity';
import { MAX_IMAGE_BYTES } from '@/lib/services/postImages';
import { addProductImage, listProductImages, productImageErrorResponse } from '@/lib/services/productImages';

export const runtime = 'nodejs';

function target(request: Request) {
  const pageId = process.env.PAGE_ID?.trim();
  if (!pageId || !/^\d{1,64}$/.test(pageId) || !process.env.DATABASE_URL) return Response.json({ error: 'Chưa cấu hình Fanpage hoặc database.' }, { status: 503 });
  const productId = new URL(request.url).searchParams.get('productId') ?? '';
  if (!productId || productId.length > 200) return Response.json({ error: 'Thiếu mã sản phẩm hợp lệ.' }, { status: 400 });
  return { pageId, productId };
}

export const GET = withAppAccess(async function GET(request: Request) {
  const found = target(request);
  if (found instanceof Response) return found;
  try { return Response.json({ images: await listProductImages(found.pageId, found.productId) }); }
  catch (error) { return productImageErrorResponse(error); }
});

/** Thân là byte ảnh thô (một ảnh mỗi yêu cầu, ≤ 4 MB). */
export const PUT = withAppAccess(async function PUT(request: Request) {
  const found = target(request);
  if (found instanceof Response) return found;
  if (Number(request.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES + 1024) {
    return Response.json({ error: 'Ảnh lớn quá 4MB, chọn ảnh nhỏ hơn nhé.' }, { status: 413 });
  }
  try { return Response.json(await addProductImage(found.pageId, found.productId, new Uint8Array(await request.arrayBuffer()))); }
  catch (error) { return productImageErrorResponse(error); }
});
