import { requireAppAccess, sameOrigin, withAppAccess } from '@/lib/services/appSecurity';
import { changeMarketingImage, marketingWorkspaceView } from '@/lib/services/marketingWorkspace';
import { marketingPageId } from '@/lib/services/marketingApi';
import { checkPostImage, MAX_IMAGE_BYTES } from '@/lib/services/postImages';
import { postsErrorResponse } from '@/lib/services/postsApi';
import { MarketingWorkflowError } from '@/lib/services/marketingBrief';

export const runtime = 'nodejs';
async function handle(request: Request) {
  try {
    sameOrigin(request); await requireAppAccess(request);
    const params = new URL(request.url).searchParams;
    const postId = params.get('postId'), revision = Number(params.get('revision'));
    if (!postId || !params.has('revision') || !Number.isSafeInteger(revision) || revision < 0) throw new MarketingWorkflowError('Bài hoặc phiên bản không hợp lệ.');
    let image = null;
    if (request.method === 'PUT') {
      const reader = request.body?.getReader(); if (!reader) throw new MarketingWorkflowError('Chọn ảnh để tải lên.');
      const chunks: Uint8Array[] = []; let size = 0;
      try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > MAX_IMAGE_BYTES) { await reader.cancel(); throw new MarketingWorkflowError('Ảnh tối đa 4MB.'); } chunks.push(value); } }
      finally { reader.releaseLock(); }
      const data = Buffer.concat(chunks), mime = checkPostImage(data);
      image = { data, mime, source: 'upload' as const };
    }
    const pageId = marketingPageId(); await changeMarketingImage(pageId, revision, postId, image);
    return Response.json(await marketingWorkspaceView(pageId));
  } catch (error) { return postsErrorResponse(error); }
}
export const PUT = withAppAccess(handle);
export const DELETE = withAppAccess(handle);
