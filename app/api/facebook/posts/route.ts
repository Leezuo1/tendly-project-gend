import { requireDashboardKey } from '@/lib/services/postsApi';
import { marketingErrorResponse } from '@/lib/services/marketingApi';
import { FacebookCommentError } from '@/lib/services/facebookComments';
import { parseFacebookCursor, readFacebookFeed, readFacebookPostComments } from '@/lib/services/facebookFeed';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const pageId = process.env.PAGE_ID?.trim();
    if (!pageId || !/^\d{1,64}$/.test(pageId)) throw new FacebookCommentError('Chưa cấu hình PAGE_ID của Fanpage.', 503);
    const params = new URL(request.url).searchParams;
    const after = parseFacebookCursor(params.get('after'));
    const postId = params.get('postId');
    const result = postId === null ? await readFacebookFeed(pageId, after) : await readFacebookPostComments(pageId, postId, after);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return error instanceof FacebookCommentError ? Response.json({ error: error.message }, { status: error.status }) : marketingErrorResponse(error);
  }
}
