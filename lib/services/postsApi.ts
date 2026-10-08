import { createHash, timingSafeEqual } from 'node:crypto';
import { InvalidPostRequest } from '@/lib/services/aiPost';
import { FacebookNotConfigured, FacebookPublishFailed } from '@/lib/services/facebookPage';
import { PostLocked, PostNotFound, PostsDatabaseNotConfigured } from '@/lib/services/postsPostgres';

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Dashboard chưa có đăng nhập, nên API bài đăng (đặc biệt là đăng lên Fanpage thật) khoá bằng DASHBOARD_KEY.
 * Chưa đặt key: chỉ cho phép khi chạy local (next dev), production thì từ chối.
 */
export function requireDashboardKey(request: Request): Response | null {
  const key = process.env.DASHBOARD_KEY?.trim();
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      return Response.json({ error: 'Chưa cấu hình DASHBOARD_KEY trên máy chủ.', code: 'NO_DASHBOARD_KEY' }, { status: 503 });
    }
    return null;
  }
  const header = request.headers.get('authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!given || !timingSafeEqual(digest(given), digest(key))) {
    return Response.json({ error: 'Cần nhập đúng mã quản trị để dùng chức năng này.', code: 'NEED_DASHBOARD_KEY' }, { status: 401 });
  }
  return null;
}

/** Đổi lỗi thành response, không đưa chi tiết lỗi database (có thể chứa thông tin kết nối) ra ngoài. */
export function postsErrorResponse(error: unknown): Response {
  if (error instanceof InvalidPostRequest) return Response.json({ error: error.message }, { status: 400 });
  if (error instanceof PostNotFound) return Response.json({ error: error.message }, { status: 404 });
  if (error instanceof PostLocked) return Response.json({ error: error.message }, { status: 409 });
  if (error instanceof PostsDatabaseNotConfigured) {
    return Response.json({ error: 'Chưa kết nối database (DATABASE_URL) nên chưa lưu được bài viết.', code: 'NO_DATABASE' }, { status: 503 });
  }
  if (error instanceof FacebookNotConfigured) return Response.json({ error: error.message, code: 'NO_FACEBOOK' }, { status: 503 });
  if (error instanceof FacebookPublishFailed) return Response.json({ error: error.message }, { status: 502 });
  if ((error as { code?: unknown })?.code === '42P01') {
    return Response.json({ error: 'Database chưa có bảng marketing_posts. Chạy npm run db:migrate rồi thử lại.', code: 'NO_TABLE' }, { status: 503 });
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
