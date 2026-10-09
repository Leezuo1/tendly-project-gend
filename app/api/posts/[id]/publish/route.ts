import { composePostMessage, InvalidPostRequest } from '@/lib/services/aiPost';
import { publishToFacebookPage } from '@/lib/services/facebookPage';
import { postsErrorResponse, readJson, requireDashboardKey } from '@/lib/services/postsApi';
import { getPost, getPostImage, markPublished, PostLocked } from '@/lib/services/postsPostgres';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * mode "page": đăng thật lên Fanpage (chỉ bài Facebook).
 * mode "manual": chủ shop tự đăng (TikTok/email hoặc copy tay) — chỉ đánh dấu đã đăng.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await readJson(request) as { mode?: unknown };
    if (body?.mode !== 'page' && body?.mode !== 'manual') throw new InvalidPostRequest('Cách đăng không hợp lệ.');

    const post = await getPost(id);
    if (post.status !== 'draft') throw new PostLocked('Bài viết đã được đăng trước đó.');

    if (body.mode === 'manual') {
      return Response.json({ post: await markPublished(id, { id: null, url: null }) });
    }
    if (post.channel !== 'facebook') throw new InvalidPostRequest('Chỉ bài Facebook mới đăng thẳng lên Fanpage được.');
    // Có ảnh thì đăng kèm ảnh; đọc bytes ngay lúc đăng để đúng ảnh mới nhất.
    const image = post.image ? await getPostImage(id) : null;
    const published = await publishToFacebookPage(composePostMessage(post), image ?? undefined);
    return Response.json({ post: await markPublished(id, published) });
  } catch (error) {
    return postsErrorResponse(error);
  }
}
