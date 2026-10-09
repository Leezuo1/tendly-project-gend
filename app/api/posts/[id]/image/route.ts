import { checkPostImage, InvalidPostImage, MAX_IMAGE_BYTES } from '@/lib/services/postImages';
import { postsErrorResponse, requireDashboardKey } from '@/lib/services/postsApi';
import { deletePostImage, getPostImage, PostNotFound, setPostImage } from '@/lib/services/postsPostgres';
import type { PostImageSource } from '@/lib/types/posts';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

/** Ảnh nháp chưa công khai nên cũng khoá bằng mã quản trị (trình duyệt tải bằng fetch có header). */
export async function GET(request: Request, { params }: Context) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const image = await getPostImage((await params).id);
    if (!image) throw new PostNotFound('Bài viết chưa có ảnh.');
    return new Response(new Uint8Array(image.data), {
      headers: { 'Content-Type': image.mime, 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return postsErrorResponse(error);
  }
}

/** Body là bytes ảnh; header X-Image-Source cho biết ảnh do AI tạo hay chủ shop tải lên. */
export async function PUT(request: Request, { params }: Context) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    if (Number(request.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) {
      throw new InvalidPostImage('Ảnh lớn quá 4MB, chọn ảnh nhỏ hơn nhé.');
    }
    const data = Buffer.from(await request.arrayBuffer());
    const mime = checkPostImage(data);
    const source: PostImageSource = request.headers.get('x-image-source') === 'ai' ? 'ai' : 'upload';
    return Response.json({ post: await setPostImage((await params).id, { mime, data, source }) });
  } catch (error) {
    return postsErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    return Response.json({ post: await deletePostImage((await params).id) });
  } catch (error) {
    return postsErrorResponse(error);
  }
}
