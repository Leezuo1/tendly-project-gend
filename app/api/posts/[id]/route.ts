import { parsePostEdit } from '@/lib/services/aiPost';
import { postsErrorResponse, readJson, requireDashboardKey } from '@/lib/services/postsApi';
import { deletePost, updateDraft } from '@/lib/services/postsPostgres';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    return Response.json({ post: await updateDraft(id, parsePostEdit(await readJson(request))) });
  } catch (error) {
    return postsErrorResponse(error);
  }
}

/** Chỉ xoá khỏi Tendly; bài đã đăng trên Fanpage vẫn giữ nguyên. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    await deletePost(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return postsErrorResponse(error);
  }
}
