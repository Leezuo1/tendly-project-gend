import { legacyAccessError } from '@/lib/services/appSecurity';
import { InvalidPostRequest } from '@/lib/services/aiPost';
import { FacebookNotConfigured, FacebookPublishFailed } from '@/lib/services/facebookPage';
import { ImageGenerationFailed, InvalidPostImage } from '@/lib/services/postImages';
import { PostLocked, PostNotFound, PostsDatabaseNotConfigured } from '@/lib/services/postsPostgres';

export function requireDashboardKey(request: Request): Response | null {
  return legacyAccessError(request) ?? null;
}

/** Đổi lỗi thành response, không đưa chi tiết lỗi database (có thể chứa thông tin kết nối) ra ngoài. */
export function postsErrorResponse(error: unknown): Response {
  if (error instanceof InvalidPostRequest || error instanceof InvalidPostImage) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ImageGenerationFailed) return Response.json({ error: error.message }, { status: 502 });
  if (error instanceof PostNotFound) return Response.json({ error: error.message }, { status: 404 });
  if (error instanceof PostLocked) return Response.json({ error: error.message }, { status: 409 });
  if (error instanceof PostsDatabaseNotConfigured) {
    return Response.json({ error: 'Chưa kết nối database (DATABASE_URL) nên chưa lưu được bài viết.', code: 'NO_DATABASE' }, { status: 503 });
  }
  if (error instanceof FacebookNotConfigured) return Response.json({ error: error.message, code: 'NO_FACEBOOK' }, { status: 503 });
  if (error instanceof FacebookPublishFailed) return Response.json({ error: error.message }, { status: 502 });
  if ((error as { code?: unknown })?.code === '42P01') {
    return Response.json({ error: 'Database chưa có đủ bảng bài đăng (marketing_posts, marketing_post_images). Chạy npm run db:migrate rồi thử lại.', code: 'NO_TABLE' }, { status: 503 });
  }
  console.error('Marketing posts request failed.');
  return Response.json({ error: 'Không truy cập được database. Vui lòng thử lại.' }, { status: 503 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new InvalidPostRequest('Nội dung yêu cầu không phải JSON hợp lệ.');
  }
}
