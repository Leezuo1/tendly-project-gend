import { withAppAccess } from '@/lib/services/appSecurity';
import { parsePostEdit } from '@/lib/services/aiPost';
import { postsErrorResponse, readJson, requireDashboardKey } from '@/lib/services/postsApi';
import { deletePost, updateDraft } from '@/lib/services/postsPostgres';
import { managedMarketingPost } from '@/lib/services/marketingWorkspace';
import { MarketingWorkflowError } from '@/lib/services/marketingBrief';

async function guardCampaignPost(id: string) {
  const pageId = process.env.PAGE_ID?.trim();
  if (pageId && await managedMarketingPost(pageId, id)) throw new MarketingWorkflowError('Mở chiến dịch trong Marketing để sửa hoặc quản lý bài này.', 409);
}

export const runtime = 'nodejs';

export const PATCH = withAppAccess(async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    await guardCampaignPost(id);
    return Response.json({ post: await updateDraft(id, parsePostEdit(await readJson(request))) });
  } catch (error) {
    return postsErrorResponse(error);
  }
});

/** Chỉ xoá khỏi Tendly; bài đã đăng trên Fanpage vẫn giữ nguyên. */
export const DELETE = withAppAccess(async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    await guardCampaignPost(id);
    await deletePost(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return postsErrorResponse(error);
  }
});
