import { errorJson, isMissingTable, mapError, rule } from '@/lib/http/errors';
import { AppSecurityError, legacyAccessError, securityErrorResponse } from '@/lib/services/appSecurity';
import { InvalidPostRequest } from '@/lib/services/aiPost';
import { MarketingWorkflowError } from '@/lib/services/marketingBrief';
import { FacebookNotConfigured, FacebookPublishFailed } from '@/lib/services/facebookPage';
import { ImageGenerationFailed, InvalidPostImage } from '@/lib/services/postImages';
import { PostLocked, PostNotFound, PostsDatabaseNotConfigured } from '@/lib/services/postsPostgres';

export function requireDashboardKey(request: Request): Response | null {
  return legacyAccessError(request) ?? null;
}

const POSTS_RULES = [
  rule(AppSecurityError, securityErrorResponse),
  rule(MarketingWorkflowError, e => errorJson(e.message, e.status)),
  rule(InvalidPostRequest, e => errorJson(e.message, 400)),
  rule(InvalidPostImage, e => errorJson(e.message, 400)),
  rule(ImageGenerationFailed, e => errorJson(e.message, 502)),
  rule(PostNotFound, e => errorJson(e.message, 404)),
  rule(PostLocked, e => errorJson(e.message, 409)),
  rule(PostsDatabaseNotConfigured, () => errorJson('Chưa kết nối database (DATABASE_URL) nên chưa lưu được bài viết.', 503, { code: 'NO_DATABASE' })),
  rule(FacebookNotConfigured, e => errorJson(e.message, 503, { code: 'NO_FACEBOOK' })),
  rule(FacebookPublishFailed, e => errorJson(e.message, 502)),
];

export function postsErrorResponse(error: unknown): Response {
  const mapped = mapError(error, POSTS_RULES);
  if (mapped) return mapped;
  if (isMissingTable(error)) {
    return errorJson('Database chưa có đủ bảng bài đăng (marketing_posts, marketing_post_images). Chạy npm run db:migrate rồi thử lại.', 503, { code: 'NO_TABLE' });
  }
  console.error('Marketing posts request failed.');
  return errorJson('Không truy cập được database. Vui lòng thử lại.', 503);
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new InvalidPostRequest('Nội dung yêu cầu không phải JSON hợp lệ.');
  }
}
/** Đổi lỗi thành response, không đưa chi tiết lỗi database (có thể chứa thông tin kết nối) ra ngoài. */
