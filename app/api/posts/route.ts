import { parseNewPost } from '@/lib/services/aiPost';
import { facebookPublishConfigured } from '@/lib/services/facebookPage';
import { postsErrorResponse, readJson, requireDashboardKey } from '@/lib/services/postsApi';
import { createPost, listPosts } from '@/lib/services/postsPostgres';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    return Response.json({ posts: await listPosts(), facebookReady: facebookPublishConfigured() });
  } catch (error) {
    return postsErrorResponse(error);
  }
}

/** Lưu một bản nháp (sau khi chủ shop đã xem/sửa nội dung AI viết). */
export async function POST(request: Request) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const post = await createPost(parseNewPost(await readJson(request)));
    return Response.json({ post }, { status: 201 });
  } catch (error) {
    return postsErrorResponse(error);
  }
}
